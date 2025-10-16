import json
import logging
from textwrap import dedent
from typing import Optional, TypeVar

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.linking_and_ranking_pipeline.deduplicate_entities import deduplicate_entities
from app.agent.llm_caller import LLMCaller
from app.agent.penalty import get_penalty, get_penalty_for_multiple_errors
from app.agent.prompt_template.agent_prompt_template import STD_LANGUAGE_STYLE, STD_AGENT_CHARACTER
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.vector_search.esco_entities import BaseEntity, SkillEntity
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, get_config_variation
from common_libs.retry import Retry

T = TypeVar('T', bound=BaseEntity)


class EvaluationEntry(BaseModel):
    """
    A single entry in the evaluation dictionary.
    """

    reasoning: Optional[str] = None
    """
    Let the model articulate how it evaluates the relevance to help it 'rationalize' the selection process.
    """

    score: Optional[int] = None
    """
    The score of the skill from 0 to 10, where 0 is not relevant and 10 is very relevant.
    """


class _PickTopSkillsLLMOutput(BaseModel):
    evaluation: Optional[dict[str, EvaluationEntry]] = None
    """
    The evaluation of each entity, as a key-value pair of JSON strings, 
    where the key is the entity's preferred label.
    """


class PickTopSkillsToolOutput(BaseModel):
    picked_skills: list[SkillEntity]
    remaining_skills: list[SkillEntity]
    llm_stats: list[LLMStats]


def _get_llm(temperature_config: dict) -> GeminiGenerativeLLM:
    """
    Get the LLM to use for clustering.
    As we do not know how the PickTopSkillsTool will be used in the async context,
    and to avoid any race conditions, we create a new LLM instance for each call.
    """
    return GeminiGenerativeLLM(
        system_instructions=PickTopSkillsTool.get_system_instructions(),
        config=LLMConfig(generation_config=temperature_config | JSON_GENERATION_CONFIG)
    )


class PickTopSkillsTool:
    def __init__(self):
        self._llm_caller: LLMCaller[_PickTopSkillsLLMOutput] = LLMCaller[_PickTopSkillsLLMOutput](
            model_response_type=_PickTopSkillsLLMOutput)
        self._logger = logging.getLogger(self.__class__.__name__)

    async def execute(
            self,
            *,
            job_titles: list[str],
            responsibilities_group_name: str,
            responsibilities: list[str],
            skills_to_rank: list[SkillEntity],
            top_k: int,
            threshold: int
    ) -> PickTopSkillsToolOutput:
        """
        Picks top_k skills from the list of skills that best matches the job titles, responsibilities group name and responsibilities.
        May return fewer than top_k skills if the LLM does not return enough skills above the threshold.
        :param job_titles: The list of job titles.
        :param responsibilities_group_name: The name of the group of responsibilities.
        :param responsibilities: The list of responsibilities.
        :param skills_to_rank: The list of skills to rank.
        :param top_k: The number of skills to pick.
        :param threshold: The threshold to use for picking the skills. If the score is below this threshold, the skill is not picked.
                          If there are no skills above the threshold, then the top_k skills are picked regardless of the threshold.
        :return: The picked skills and the remaining skills.
        """
        if not skills_to_rank or len(skills_to_rank) == 0:
            # No need to call the LLM if there are no skills
            self._logger.error("The list of skills is empty!")
            return PickTopSkillsToolOutput(
                picked_skills=[],
                remaining_skills=[],
                llm_stats=[]
            )

        async def _callback(attempt: int, max_retries: int) -> tuple[PickTopSkillsToolOutput, float, BaseException | None]:
            # Call the LLM to pick one skill.
            # Add some temperature and top_p variation to prompt the LLM to return different results on each retry.
            # Exponentially increase the temperature and top_p to avoid the LLM to return the same result every time.
            temperature_config = get_config_variation(start_temperature=0.0, end_temperature=1,
                                                      start_top_p=0.8, end_top_p=1,
                                                      attempt=attempt, max_retries=max_retries)
            llm = _get_llm(temperature_config=temperature_config)
            self._logger.debug("Calling LLM with temperature: %s, top_p: %s",
                               temperature_config["temperature"],
                               temperature_config["top_p"])
            return await self._internal_execute(llm=llm,
                                                job_titles=job_titles,
                                                responsibilities_group_name=responsibilities_group_name,
                                                responsibilities=responsibilities,
                                                skills_to_rank=skills_to_rank,
                                                top_k=top_k,
                                                threshold=threshold
                                                )

        result, _result_penalty, _error = await Retry[PickTopSkillsToolOutput].call_with_penalty(callback=_callback, logger=self._logger)
        return result

    async def _internal_execute(
            self,
            *,
            llm: GeminiGenerativeLLM,
            job_titles: list[str],
            responsibilities_group_name: str,
            responsibilities: list[str],
            skills_to_rank: list[SkillEntity],
            top_k: int,
            threshold: int
    ) -> tuple[PickTopSkillsToolOutput, float, BaseException | None]:

        # Penalty levels, the higher the level, the more severe the penalty
        no_llm_output_penalty_level = 4
        skills_missing_penalty_level = 3
        scores_missing_penalty_level = 2
        not_from_input_penalty_level = 0

        errors: list[Exception] = []
        result_penalty: float = 0.0
        # Deduplicate the skills to classify as the taxonomy model does not impose any constraint on the uniqueness of the preferredLabel or the altLabels.
        # The skills_lookup_dict is used to map the label (preferredLabel or altLabel) back to the original skill
        # The deduplicated_skills_to_classify is used to pass the skills to the LLM for performing any task and contains a copy of the skills
        # with the preferredLabel set to the preferredLabel or altLabel used to represent it.
        skills_lookup_dict, deduplicated_skills_to_classify = deduplicate_entities(skills_to_rank, self._logger)
        number_of_skills_to_classify = len(deduplicated_skills_to_classify)

        if number_of_skills_to_classify < top_k:
            self._logger.warning(f"The number of skills to classify {number_of_skills_to_classify} is less than the top_k which is {top_k}.")

        prompt = PickTopSkillsTool.get_prompt(

            job_titles=job_titles,
            responsibilities_group_name=responsibilities_group_name,
            responsibilities=responsibilities,
            skills=deduplicated_skills_to_classify
        )
        llm_output, llm_stats = await self._llm_caller.call_llm(llm=llm, llm_input=prompt, logger=self._logger)

        if not llm_output:
            # This may happen if the LLM fails to return a JSON object
            # Instead of completely failing, we log a warning and return the skill with the highest search score
            penalty = get_penalty(no_llm_output_penalty_level)
            sorted_skills = _sort_skills_with_highest_search_scores(skills_to_rank)
            top_skills = sorted_skills[:top_k]
            remaining_skills = sorted_skills[top_k:]
            self._logger.warning("The LLM did not return any output. "
                                 f"\n  - Picked top skills with the highest search score: {', '.join([skill.preferredLabel for skill in top_skills])}"
                                 f"\n  - Penalty incurred: {penalty}."
                                 f"\n  - Updated total penalty: {penalty}.")
            return PickTopSkillsToolOutput(
                picked_skills=top_skills,
                remaining_skills=remaining_skills,
                llm_stats=llm_stats
            ), penalty, ValueError("LLM did not return any output and the picked skills are picked with the highest search score")

        if self._logger.isEnabledFor(logging.INFO):
            self._logger.info(
                "The LLM PickTopSkillsTool for"
                "\n  - job titles: '%s' "
                "\n  - responsibilities group name: '%s' "
                "\n  - responsibilities: '%s'"
                "\n  - skills: '%s'"
                "\nreturned response is:"
                "\n%s",
                json.dumps(job_titles, ensure_ascii=False),
                responsibilities_group_name,
                json.dumps(responsibilities, ensure_ascii=False),
                json.dumps([skill.preferredLabel for skill in deduplicated_skills_to_classify], ensure_ascii=False),
                llm_output.model_dump_json(indent=2))

        skills_ordered_by_score: list[tuple[SkillEntity, float]] = []
        not_from_input_skills_count = 0
        missing_score_count = 0
        for skill_title, evaluation_entry in llm_output.evaluation.items():
            skill = skills_lookup_dict.get(skill_title, None)
            if skill:
                score = evaluation_entry.score
                if score is None:
                    score = 5  # Default score if the LLM does not return a score
                    missing_score_count += 1
                skills_ordered_by_score.append((skill, score))
            else:
                self._logger.warning("The skill '%s' is not in the original list of skills.", skill_title)
                not_from_input_skills_count += 1

        # Sort the skills by score in descending order
        skills_ordered_by_score.sort(key=lambda x: x[1], reverse=True)

        # Verify that is all the entities to be classified are present in the LLM output
        missing_skills_count = number_of_skills_to_classify - len(skills_ordered_by_score)
        if missing_skills_count > 0:
            errors.append(ValueError("Some of the skills where missing from the LLM output"))
            penalty = get_penalty_for_multiple_errors(skills_missing_penalty_level,
                                                      actual_errors_counted=missing_skills_count,
                                                      max_number_of_errors_expected=number_of_skills_to_classify)
            result_penalty += penalty
            self._logger.warning(f"Some of the skills where missing from the LLM output"
                                 f"\n - Skills missing from the LLM output: {missing_skills_count}."
                                 f"\n - Penalty incurred: {penalty}."
                                 f"\n - Updated total penalty: {result_penalty}.")

        # Verify that the LLM returned a score for each skill
        if missing_score_count > 0:
            errors.append(ValueError("Some of the skills where missing a score"))
            penalty = get_penalty_for_multiple_errors(scores_missing_penalty_level,
                                                      actual_errors_counted=missing_score_count,
                                                      max_number_of_errors_expected=number_of_skills_to_classify)
            result_penalty += penalty
            self._logger.warning(f"Some of the skills where missing a score"
                                 f"\n - Entities missing a score: {missing_score_count}."
                                 f"\n - Penalty incurred: {penalty}."
                                 f"\n - Updated total penalty: {result_penalty}.")

        # Verify that the LLM returned skills from the input list
        if not_from_input_skills_count > 0:
            errors.append(ValueError("Some of the returned skills were not from the input list of skills"))
            penalty = get_penalty_for_multiple_errors(not_from_input_penalty_level,
                                                      actual_errors_counted=not_from_input_skills_count,
                                                      max_number_of_errors_expected=number_of_skills_to_classify)
            result_penalty += penalty
            self._logger.warning(f"Some of the returned skills were not from the input list of skills"
                                 f"\n - Entities not from the input list: {not_from_input_skills_count}."
                                 f"\n - Penalty incurred: {penalty}."
                                 f"\n - Updated total penalty: {result_penalty}.")

        # get the top_k most relevant skills that are above the threshold
        most_relevant_skills = [
                                   skill for skill, score in skills_ordered_by_score
                                   if score >= threshold
                               ][:top_k]

        if len(most_relevant_skills) == 0:
            self._logger.warning(f"Not enough skills above the threshold {threshold}.")
            # If there are not enough skills above the threshold, we take the top_k skills
            most_relevant_skills = [
                                       skill for skill, score in skills_ordered_by_score
                                   ][:top_k]

        # Remove the most relevant skills from the original list to get the remaining skills
        most_relevant_skills_uuids = {e.UUID for e in most_relevant_skills}
        remaining_entities = [
            entity for entity in skills_to_rank
            if entity.UUID not in most_relevant_skills_uuids
        ]
        
        # Deduplicate the remaining skills to avoid duplicates in the output
        # This is necessary because the original skills_to_rank list may contain duplicates
        remaining_entities = list({entity.UUID: entity for entity in remaining_entities}.values())

        _return_error = None
        if errors:
            if len(errors) > 1:
                _return_error = ExceptionGroup("Multiple errors occurred", errors)
            else:
                _return_error = errors[0]

        return PickTopSkillsToolOutput(
            picked_skills=most_relevant_skills,
            remaining_skills=remaining_entities,
            llm_stats=llm_stats
        ), result_penalty, _return_error

    @staticmethod
    def get_system_instructions():
        system_instructions = dedent("""\
            <System Instructions>
            You are a labour market expert.
            
            You will be given a list of job titles, a responsibilities group name, a list of responsibilities, and a list of skills with their descriptions.
            You will inspect the 'skill description' and 'skill title' of each skill in 'Given Skills' to evaluate in detail how relevant it is to all of the 
            'Given Responsibilities', the 'Given Responsibilities Group Name', and the 'Given Job Titles' of the <Input> 
            and assign a score from 0 to 10, where 0 is not relevant and 10 is very relevant.
            
            Make sure that all the skills are evaluated and reported in the output.
            
            # Input Structure
                The input structure is composed of: 
                'Given Job Titles': The list of job titles
                'Given Responsibilities Group Name': The name of the group of responsibilities
                'Given Responsibilities': The responsibilities/activities/skills/behaviours
                'Given Skills': The list of skills with their titles and descriptions
            # JSON Output Instructions
                Your response must always be a JSON object with the following schema:
                {
                    "evaluation": The evaluation result is a JSON object dictionary where the key is the evaluated skill's title and should follow the following schema:
                        {
                            "skill title": { 
                                "reasoning": Detailed, step-by-step explanation of how the skill was scored as a JSON string.,
                                "score": The score of the skill as an integer
                                }
                        }
                }
            </System Instructions>
            """)
        return system_instructions

    @staticmethod
    def get_prompt(*,
                   job_titles: list[str],
                   responsibilities_group_name: str,
                   responsibilities: list[str],
                   skills: list[BaseEntity],
                   ):

        prompt_template = dedent("""\
                                <Input>
                                'Given Job Titles': {job_titles}
                                'Given Responsibilities Group Name': {responsibilities_group_name}
                                'Given Responsibilities': {responsibilities}
                                'Given Skills': {skills}
                                </Input>
                                """)

        _skills = [{'skill title': entity.preferredLabel, 'skill description': entity.description} for entity in skills]
        return replace_placeholders_with_indent(prompt_template,
                                                job_titles=json.dumps(job_titles, ensure_ascii=False),
                                                responsibilities_group_name=responsibilities_group_name,
                                                responsibilities=json.dumps(responsibilities, ensure_ascii=False),
                                                skills=json.dumps(_skills, indent=2, ensure_ascii=False))


def _sort_skills_with_highest_search_scores(skills: list[SkillEntity]) -> list[SkillEntity]:
    """
    Return the skills sorted by their search score in descending order.

    The search score criteria is not the best one to use as it represents "similarity" to the query that produced it.
    So it is a bit better than picking random skills from the list, but not much better.
    """
    return sorted(skills, key=lambda x: x.score, reverse=True)
