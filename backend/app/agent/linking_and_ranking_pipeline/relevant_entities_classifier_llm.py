import asyncio
import json
import logging
from math import ceil
from textwrap import dedent
from typing import Optional, TypeVar, Generic, Literal

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.linking_and_ranking_pipeline.deduplicate_entities import deduplicate_entities
from app.agent.llm_caller import LLMCaller
from app.agent.penalty import get_penalty, get_penalty_for_multiple_errors
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.vector_search.esco_entities import BaseEntity
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
    The score of the entity from 0 to 10, where 0 is not relevant and 10 is very relevant.
    """


class _RelevantEntityClassifierLLMOutput(BaseModel):
    evaluation: Optional[dict[str, EvaluationEntry]] = None
    """
    The evaluation of each entity, as a key-value pair of JSON strings, 
    where the key is the entity's preferred label.
    """


class BatchResult(BaseModel, Generic[T]):
    """
    A single batch result.
    """

    batch_number: int
    """
    The batch number of the result.
    """

    scored_entities: list[tuple[T, int]]
    """
    The scored entities, as a list of tuples of the entity and its score.
    """

    llm_stats: list[LLMStats]
    """
    The LLM stats for the batch.
    """


class RelevantEntityClassifierOutput(BaseModel, Generic[T]):
    most_relevant: list[T]
    remaining: list[T]
    llm_stats: list[LLMStats]


def calculate_batch_size(element_count: int, max_batch_size: int = 20) -> int:
    """
    Calculates the optimal even batch size for distributing `element_count`
    elements into batches of size no more than `max_batch_size`.
    """
    if element_count <= 0:
        return 0

    batch_count = ceil(element_count / max_batch_size)
    return ceil(element_count / batch_count)


class RelevantEntitiesClassifierLLM(Generic[T]):
    def __init__(self, entity_type: Literal['skill', 'occupation']):
        self._entity_type = entity_type
        self._entity_type_singular: Literal['skill', 'occupation'] = entity_type
        self._entity_types_plural = self._entity_type_singular + 's'
        self._entity_types_plural_capitalized = self._entity_types_plural.capitalize()
        self._llm_caller: LLMCaller[_RelevantEntityClassifierLLMOutput] = LLMCaller[_RelevantEntityClassifierLLMOutput](
            model_response_type=_RelevantEntityClassifierLLMOutput)
        self._logger = logging.getLogger(self.__class__.__name__)

    async def execute(
            self,
            *,
            job_titles: list[str],
            responsibilities: list[str],
            entities_to_classify: list[T],
            top_k: int = 5
    ) -> RelevantEntityClassifierOutput:
        """
        Given
        - a list of job titles,
        - and list of responsibilities
        classify a list of entities in:
        - top_k most relevant entities
        - remaining entities
         """
        # Batch entities to classify to avoid exceeding the LLM token limit
        batch_size = calculate_batch_size(element_count=len(entities_to_classify), max_batch_size=15)
        batched_entities_to_classify = [entities_to_classify[i:i + batch_size] for i in range(0, len(entities_to_classify), batch_size)]
        # Process all batches in parallel
        tasks = [
            self._execute_batch(
                batch_number=batch_number,
                job_titles=job_titles,
                responsibilities=responsibilities,
                entities_to_classify=batch)
            for batch_number, batch in enumerate(batched_entities_to_classify)
        ]
        # Wait for all batches to finish
        results = await asyncio.gather(*tasks)
        # Combine the results of all batches
        all_scored_entities: list[tuple[T, int]] = []
        all_llm_stats: list[LLMStats] = []
        for batch_result in results:
            all_scored_entities.extend(batch_result.scored_entities)
            all_llm_stats.extend(batch_result.llm_stats)
        # Sort the scored entities by score in descending order
        all_scored_entities.sort(key=lambda x: x[1], reverse=True)
        if len(all_scored_entities) < top_k:
            self._logger.warning(
                f"The number of {self._entity_types_plural} to classify {len(all_scored_entities)} is less than the top_k which is {top_k}.")

        # Get the top_k most relevant entities
        most_relevant_entities = [entity for entity, score in all_scored_entities[:top_k]]
        # To get the remaining entities, we need to remove the most relevant entities from the original list.
        # We cannot be sure that the returned entities are the same as the input entities, that is why we use the UUID to identify them.
        most_relevant_entities_uuids = {e.UUID for e in most_relevant_entities}
        remaining_entities = [
            entity for entity in entities_to_classify
            if entity.UUID not in most_relevant_entities_uuids
        ]
        return RelevantEntityClassifierOutput(
            most_relevant=most_relevant_entities,
            remaining=remaining_entities,
            llm_stats=all_llm_stats)

    async def _execute_batch(self,
                             *,
                             batch_number: int,
                             job_titles: list[str],
                             responsibilities: list[str],
                             entities_to_classify: list[T]) -> BatchResult:

        async def _callback(attempt: int, max_retries: int) -> tuple[BatchResult, float, BaseException | None]:
            # Call the LLM to classify the entities
            # Add some temperature and top_p variation to prompt the LLM to return different results on each retry.
            # Exponentially increase the temperature and top_p to avoid the LLM to return the same result every time.
            temperature_config = get_config_variation(start_temperature=0.0, end_temperature=1,
                                                      start_top_p=0.8, end_top_p=1,
                                                      attempt=attempt, max_retries=max_retries)
            llm = RelevantEntitiesClassifierLLM._get_llm(entity_type=self._entity_type, temperature_config=temperature_config)
            self._logger.debug("Calling LLM with temperature: %s, top_p: %s",
                               temperature_config["temperature"],
                               temperature_config["top_p"])
            return await self._process_batch(llm=llm,
                                             batch_number=batch_number,
                                             job_titles=job_titles,
                                             responsibilities=responsibilities,
                                             entities_to_classify=entities_to_classify)

        result, _result_penalty, _error = await Retry[RelevantEntityClassifierOutput].call_with_penalty(callback=_callback, logger=self._logger)
        return result

    async def _process_batch(
            self,
            *,
            batch_number: int,
            llm: GeminiGenerativeLLM,
            job_titles: list[str],
            responsibilities: list[str],
            entities_to_classify: list[T]
    ) -> tuple[BatchResult, float, BaseException | None]:

        # Penalty levels, the higher the level, the more severe the penalty
        no_llm_output_penalty_level = 4
        entities_missing_penalty_level = 3
        scores_missing_penalty_level = 2
        not_from_input_penalty_level = 0

        default_score = 5  # Default score for ranking an entity if the LLM does not return a score
        errors: list[Exception] = []
        result_penalty: float = 0.0
        # Deduplicate the entities to classify as the taxonomy model does not impose any constraint on the uniqueness of the preferredLabel or the altLabels.
        # The entities_lookup_dict is used to map the label (preferredLabel or altLabel) back to the original entity
        # The deduplicated_entities_to_classify is used to pass the entities to the LLM for performing any task and contains a copy of the entities
        # with the preferredLabel set to the preferredLabel or altLabel used to represent it.
        entities_lookup_dict, deduplicated_entities_to_classify = deduplicate_entities(entities_to_classify, self._logger)
        number_of_entities_to_classify = len(deduplicated_entities_to_classify)

        prompt = RelevantEntitiesClassifierLLM._get_prompt(
            entity_type_singular=self._entity_type_singular,
            job_titles=job_titles,
            responsibilities=responsibilities,
            entities_to_classify=deduplicated_entities_to_classify)
        llm_output, llm_stats = await self._llm_caller.call_llm(llm=llm, llm_input=prompt, logger=self._logger)

        if not llm_output:
            # This may happen if the LLM fails to return a JSON object
            # Instead of completely failing, we will return all the entities and assign them a default score of 5.
            penalty = get_penalty(no_llm_output_penalty_level)
            self._logger.warning(
                f"The RelevantEntitiesClassifier could not return any {self._entity_types_plural}. "
                f"Assigning all {self._entity_types_plural} a default score of {default_score}."
                f"\n  - Batch number: {batch_number}"
                f"\n  - Penalty incurred: {penalty}."
                f"\n  - Updated total penalty: {penalty}.")
            return BatchResult(
                batch_number=batch_number,
                scored_entities=[(entity, default_score) for entity in entities_to_classify],
                llm_stats=llm_stats), penalty, ValueError("LLM did not return any output so all entities are assigned the default score")

        if self._logger.isEnabledFor(logging.INFO):
            self._logger.info(
                f"The LLM {self._entity_types_plural_capitalized} RelevantEntitiesClassifier for"
                f"\n  - Batch number: {batch_number}"
                f"\n  - Job titles: '%s' "
                f"\n  - Responsibilities: '%s'"
                f"\nreturned response is:"
                f"\n%s",
                json.dumps(job_titles, ensure_ascii=False),
                json.dumps(responsibilities, ensure_ascii=False),
                llm_output.model_dump_json(indent=2))

        entities_ordered_by_score: list[tuple[T, int]] = []
        not_from_input_entities_count = 0
        missing_score_count = 0
        for entity_title, evaluation_entry in llm_output.evaluation.items():
            entity = entities_lookup_dict.get(entity_title, None)
            if entity:
                score = evaluation_entry.score
                if score is None:
                    score = 5  # Default score if the LLM does not return a score
                    missing_score_count += 1
                entities_ordered_by_score.append((entity, score))
            else:
                self._logger.warning(f"The {self._entity_type_singular} is not in the original list of {self._entity_types_plural}:"
                                     f"\n  - Batch number: {batch_number}"
                                     f"\n  - {self._entity_type_singular} title: '%s'", entity_title)
                not_from_input_entities_count += 1

        # Verify that all the entities to be classified are present in the LLM output
        missing_entities_count = number_of_entities_to_classify - len(entities_ordered_by_score)
        if missing_entities_count > 0:
            errors.append(ValueError(f"Some of the {self._entity_types_plural} where missing from the LLM output"))
            penalty = get_penalty_for_multiple_errors(entities_missing_penalty_level,
                                                      actual_errors_counted=missing_entities_count,
                                                      max_number_of_errors_expected=number_of_entities_to_classify)
            result_penalty += penalty
            self._logger.warning(f"Some of the {self._entity_types_plural} where missing from the LLM output"
                                 f"\n  - Batch number: {batch_number}"
                                 f"\n  - Entities missing from the LLM output: {missing_entities_count}."
                                 f"\n  - Penalty incurred: {penalty}."
                                 f"\n  - Updated total penalty: {result_penalty}.")

        # Verify that the LLM returned a score for each entity
        if missing_score_count > 0:
            errors.append(ValueError(f"Some of the {self._entity_types_plural} where missing a score"))
            penalty = get_penalty_for_multiple_errors(scores_missing_penalty_level,
                                                      actual_errors_counted=missing_score_count,
                                                      max_number_of_errors_expected=number_of_entities_to_classify)
            result_penalty += penalty
            self._logger.warning(f"Some of the {self._entity_types_plural} where missing a score"
                                 f"\n  - Entities missing a score: {missing_score_count}."
                                 f"\n  - Batch number: {batch_number}"
                                 f"\n  - Penalty incurred: {penalty}."
                                 f"\n  - Updated total penalty: {result_penalty}.")

        # Verify that the LLM returned entities from the input list
        if not_from_input_entities_count > 0:
            errors.append(ValueError(f"Some of the returned {self._entity_types_plural} were not from the input list of {self._entity_types_plural}"))
            penalty = get_penalty_for_multiple_errors(not_from_input_penalty_level,
                                                      actual_errors_counted=not_from_input_entities_count,
                                                      max_number_of_errors_expected=number_of_entities_to_classify)
            result_penalty += penalty
            self._logger.warning(f"Some of the returned {self._entity_types_plural} were not from the input list of {self._entity_types_plural}"
                                 f"\n  - Entities not from the input list: {not_from_input_entities_count}."
                                 f"\n  - Batch number: {batch_number}"
                                 f"\n  - Penalty incurred: {penalty}."
                                 f"\n  - Updated total penalty: {result_penalty}.")

        _return_error = None
        if errors:
            if len(errors) > 1:
                _return_error = ExceptionGroup("Multiple errors occurred", errors)
            else:
                _return_error = errors[0]

        return BatchResult(
            batch_number=batch_number,
            scored_entities=entities_ordered_by_score,
            llm_stats=llm_stats), result_penalty, _return_error

    @staticmethod
    def _get_llm(entity_type: Literal['skill', 'occupation'], temperature_config: dict) -> GeminiGenerativeLLM:
        """
        Get the LLM to use for clustering.
        As we do not know how the RelevantEntitiesClassifierLLM will be used in the async context,
        and to any avoid race conditions, we create a new LLM instance for each call.
        """
        return GeminiGenerativeLLM(
            system_instructions=RelevantEntitiesClassifierLLM._get_system_instructions(entity_type_singular=entity_type),
            config=LLMConfig(generation_config=temperature_config | JSON_GENERATION_CONFIG | {
                # "max_output_tokens": 3000  # Limit the output to 3000 tokens to avoid the "reasoning recursion issues"
            })
        )

    @staticmethod
    def _get_system_instructions(entity_type_singular: Literal['skill', 'occupation']) -> str:
        entity_types_plural = entity_type_singular + 's'
        entity_types_plural_capitalized = entity_types_plural.capitalize()
        system_prompt_template = dedent("""\
            <System Instructions>
            You are an expert in the labour market.
            
            You will be given a list of job titles, a list of responsibilities/activities/skills/behaviours and a list of {entity_types_plural}.
            You will inspect the '{entity_type_singular} description' and '{entity_type_singular} title' of each {entity_type_singular} in the 'Given {entity_types_plural_capitalized}' 
            to evaluate in detail how relevant it is to all of the 'Given Responsibilities' and 'Given Job Titles' of the <Input> 
            and assign a score from 0 to 10, where 0 is not relevant and 10 is very relevant.
            
            Make sure that all the {entity_types_plural} are evaluated and reported in the output.
            
            # Input Structure
                The input structure is composed of: 
                'Given Job Titles': A list of job titles 
                'Given Responsibilities': The list of responsibilities/activities/skills/behaviours
                'Given {entity_types_plural_capitalized}': A JSON array of {entity_types_plural} to be scored based on their descriptions and titles.
             
            # JSON Output Instructions
                Your response must always be a JSON object with the following schema:
                {
                    "evaluation": { The evaluation result is a JSON object dictionary where the key is the evaluated {entity_types_plural}'s title and should follow the following schema:
                        "{entity_type_singular} title": { 
                            "reasoning": Detailed, step-by-step explanation of how the {entity_type_singular} was scored as a JSON string.,
                            "score": The score of the {entity_type_singular} as an integer
                        }
                    }
                }
            </System Instructions>
            """)

        return replace_placeholders_with_indent(system_prompt_template,
                                                entity_type_singular=entity_type_singular,
                                                entity_types_plural=entity_types_plural,
                                                entity_types_plural_capitalized=entity_types_plural_capitalized)

    @staticmethod
    def _get_prompt(*,
                    entity_type_singular: Literal['skill', 'occupation'],
                    job_titles: list[str],
                    responsibilities: list[str],
                    entities_to_classify: list[T]):

        entity_types_plural = entity_type_singular + 's'
        entity_types_plural_capitalized = entity_types_plural.capitalize()
        prompt_template = dedent("""\
                                <Input>
                                'Given Job Titles': {job_titles}
                                'Given Responsibilities': {responsibilities}
                                'Given {entity_types_plural_capitalized}': {entities_to_classify}
                                </Input>
                                """)

        _entities_to_classify = [{f'{entity_type_singular} title': entity.preferredLabel, f'{entity_type_singular} description': entity.description} for entity
                                 in entities_to_classify]
        # When json.dumps is used ensure_ascii is False to avoid escaping non-ascii characters.
        # Otherwise, the entities in the response will not match the entities in the input
        return replace_placeholders_with_indent(prompt_template,
                                                entity_types_plural=entity_types_plural,
                                                entity_types_plural_capitalized=entity_types_plural_capitalized,
                                                job_titles=json.dumps(job_titles, ensure_ascii=False),
                                                responsibilities=json.dumps(responsibilities, ensure_ascii=False),
                                                entities_to_classify=json.dumps(_entities_to_classify, indent=4, ensure_ascii=False))
