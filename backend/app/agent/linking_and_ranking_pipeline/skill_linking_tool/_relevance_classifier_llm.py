import json
import logging
from textwrap import dedent
from typing import Optional

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.vector_search.esco_entities import SkillEntity
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import ZERO_TEMPERATURE_GENERATION_CONFIG, LLMConfig, JSON_GENERATION_CONFIG


class _RelevanceClassifierLLMOutput(BaseModel):
    reasoning: Optional[str]
    most_relevant_skills: list[str]
    remaining_skills: list[str]


class RelevanceClassifierResponse(BaseModel):
    most_relevant_skills: list[SkillEntity]
    remaining_skills: list[SkillEntity]


def _get_system_instructions():
    system_prompt_template = dedent("""\
        <System Instructions>
        You are an expert in the labour market.
        
        You will be given a job title, a responsibility/activity/skill/behaviour description, a list of skills, 
        and the number of the most relevant skills to return.
        
        You should return the most relevant skills for the given responsibility within the job title in a list of json strings.
        and also return the remaining skills in an another list of json strings.
        Each skill from the input list must be present in one of the two lists.
        
        #Input Structure
        The input structure is composed of: 
        'Job Title': The job title
        'Responsibility' : The responsibility/activity/skill/behaviour
        'Skills': The list of skills to be ranked
        'Number of skills to return': The number of the most relevant skills to return
        #JSON Output instructions
            Your response must always be a JSON object with the following schema:
            {
                "reasoning": Why the skills where selected as most relevant or not
                "most_relevant_skills": The most relevant skills, an array of a json strings 
                "remaining_skills": The remaining skills, an array of a json strings
            }
        </System Instructions>
        """)
    return system_prompt_template


def _get_prompt(experience_title: str, contextual_title: str, responsibility: str, skills: list[str], top_k: int = 5):
    prompt_template = dedent("""\
                            <Input>
                            'Job Title': {job_title}
                            'Responsibility': {responsibility}
                            'Skills': {skills}
                            'Number of skills to return': {top_k}
                            </Input>
                            """)
    _aka_title = f"{(' aka ' + experience_title if experience_title and experience_title != contextual_title else '')}"
    job_title = f"{contextual_title}{_aka_title}"
    return replace_placeholders_with_indent(prompt_template,
                                            job_title=job_title,
                                            responsibility=responsibility,
                                            skills=json.dumps(skills),
                                            top_k=f"{top_k}")


class _RelevanceClassifierLLM:
    def __init__(self):
        self._llm = GeminiGenerativeLLM(
            system_instructions=_get_system_instructions(),
            config=LLMConfig(generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG)
        )
        self._llm_caller: LLMCaller[_RelevanceClassifierLLMOutput] = LLMCaller[_RelevanceClassifierLLMOutput](
            model_response_type=_RelevanceClassifierLLMOutput)
        self._logger = logging.getLogger(self.__class__.__name__)

    async def execute(
            self,
            *,
            experience_title: str,
            contextual_title: str,
            responsibility: str,
            skills: list[SkillEntity],
            top_k: int = 5
    ) -> tuple[RelevanceClassifierResponse, list[LLMStats]]:
        """
        Given a experience_title and a responsibility, classify a list of skills in:
        - top_k most relevant and
        - remaining skills

        If the experience title is different from the contextual title,
        then job title is the contextual title followed by "aka" and the experience title.
        """
        # create a dict with skill text as key and the skill entity as value
        _skills_dict: dict[str, SkillEntity] = {}
        _skills: list[str] = []
        for skill in skills:
            _skills_dict[skill.preferredLabel] = skill
            _skills.append(skill.preferredLabel)

        prompt = _get_prompt(experience_title, contextual_title, responsibility, _skills, top_k)
        llm_output, llm_stats = await self._llm_caller.call_llm(llm=self._llm, llm_input=prompt, logger=self._logger)

        # log a warning if the two lists are disjoint and the union is the original list
        diff_len = len(llm_output.most_relevant_skills) + len(llm_output.remaining_skills) - len(_skills)
        if diff_len != 0:
            self._logger.warning("The list of skills returned by the LLM is the same as the original list of skills. There is a difference of %d skills.",
                                 diff_len)

        if len(set(llm_output.most_relevant_skills).intersection(set(llm_output.remaining_skills))) != 0:
            self._logger.warning("The most relevant skills and the remaining skills are not disjoint.")

        # Since we cannot trust the LLM to always return the correct skills
        # We will return the original skills removing the ones that have been classified as "remaining"
        remaining_skills = []
        remaining_skills_uuids = []
        if llm_output:
            for skill_from_output in llm_output.remaining_skills:
                skill_from_output = skill_from_output.strip('\'"')  # The llm sometimes returns the skills with quotes. espe
                skill = _skills_dict.get(skill_from_output, None)
                if skill:
                    remaining_skills.append(skill)
                    remaining_skills_uuids.append(skill.UUID)
                else:
                    self._logger.warning("The skill %s is not in the original list of skills.", skill_from_output)

        # Create the most relevant skills list by removing the remaining skills from the original list of skills
        # use the UUID to compare if the skills are the same
        most_relevant_skills = [skill for skill in skills if skill.UUID not in remaining_skills_uuids]

        return RelevanceClassifierResponse(
            most_relevant_skills=most_relevant_skills,
            remaining_skills=remaining_skills), llm_stats
