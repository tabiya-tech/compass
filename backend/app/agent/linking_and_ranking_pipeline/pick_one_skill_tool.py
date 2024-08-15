import json
import logging
from textwrap import dedent
from typing import Optional, TypeVar

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.vector_search.esco_entities import BaseEntity, SkillEntity
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import ZERO_TEMPERATURE_GENERATION_CONFIG, LLMConfig, JSON_GENERATION_CONFIG

T = TypeVar('T', bound=BaseEntity)


class _PickOneSkillLLMOutput(BaseModel):
    reasoning: Optional[str]
    picked_skill: str
    remaining_skills: list[str]


class PickOneSkillOutput(BaseModel):
    picked_skill: Optional[SkillEntity]
    remaining_skills: list[SkillEntity]
    llm_stats: list[LLMStats]


class PickOneSkillTool:
    def __init__(self):
        self._llm = GeminiGenerativeLLM(
            system_instructions=PickOneSkillTool._get_system_instructions(),
            config=LLMConfig(generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG)
        )
        self._llm_caller: LLMCaller[_PickOneSkillLLMOutput] = LLMCaller[_PickOneSkillLLMOutput](
            model_response_type=_PickOneSkillLLMOutput)
        self._logger = logging.getLogger(self.__class__.__name__)

    async def execute(
            self,
            *,
            job_titles: list[str],
            responsibilities_group_name: str,
            responsibilities: list[str],
            skills: list[SkillEntity]
    ) -> PickOneSkillOutput:
        """
        Picks one skill from the list of skills that best matches the job titles, responsibilities group name and responsibilities.
        """
        if not skills or len(skills) == 0:
            self._logger.error("The list of skills is empty!")
            return PickOneSkillOutput(
                picked_skill=None,
                remaining_skills=[],
                llm_stats=[]
            )
        # create a dict with the skill text as key and the entity as value
        _skills_dict: dict[str, T] = {}
        for skill in skills:
            _skills_dict[skill.preferredLabel] = skill

        prompt = PickOneSkillTool._get_prompt(
            job_titles=job_titles,
            responsibilities_group_name=responsibilities_group_name,
            responsibilities=responsibilities,
            skills=skills)
        llm_output, llm_stats = await self._llm_caller.call_llm(llm=self._llm, llm_input=prompt, logger=self._logger)

        # log a warning if the two lists are disjoint and the union is the original list
        diff_len = len(llm_output.remaining_skills) + 1 - len(skills)
        if diff_len != 0:
            self._logger.warning(
                "The list of skills returned by the LLM is the same as the original list of skills. There is a difference of %d skills.",
                diff_len)

        if llm_output.picked_skill in llm_output.remaining_skills:
            self._logger.warning("The picked skill cannot be also in the remaining list")

        picked_skill = _skills_dict.get(llm_output.picked_skill, None)
        remaining_skills = []
        remaining_skills_uuids = []
        for skill_from_output in llm_output.remaining_skills:
            # The llm sometimes returns the entity with quotes, especially if the entity contains a single quote
            skill_from_output = skill_from_output.strip('\'"')
            entity = _skills_dict.get(skill_from_output, None)
            if entity:
                remaining_skills.append(entity)
                remaining_skills_uuids.append(entity.UUID)
            else:
                self._logger.warning("The skill %s is not in the original list of skills.", skill_from_output)

        # Create the most relevant entities list by removing the remaining entities from the original list of entities
        # use the UUID to compare if the entities are the same

        if self._logger.isEnabledFor(logging.INFO):
            self._logger.info(
                "Picked skill: '%s' from skills: %s for job titles: '%s' and responsibilities group: '%s' and responsibilities: %s. The llm output was '%s'",
                picked_skill.preferredLabel if picked_skill else None,
                json.dumps([entity.preferredLabel for entity in skills]),
                json.dumps(job_titles),
                responsibilities_group_name,
                json.dumps(responsibilities),
                llm_output)
        return PickOneSkillOutput(
            picked_skill=picked_skill,
            remaining_skills=remaining_skills,
            llm_stats=llm_stats
        )

    @staticmethod
    def _get_system_instructions():
        system_instructions = dedent("""\
            <System Instructions>
            You are an expert in the labour market and in writing CVs.
            
            You will be given a list of job titles, a group of responsibilities (group name and list of responsibilities), and a list of skills with their descriptions.
            You will inspect the 'skill title' and the 'skill description' of each skill in 'Skills' and pick one skill to 
            that matches the most to the given 'Job Titles', 'Responsibilities Group Name' and 'Responsibilities'.
            
            You will return the title of the skill you picked and return the remaining skills titles in another list of json strings.
    
            #Input Structure
                The input structure is composed of: 
                'Job Titles': The list of job titles
                'Responsibilities Group Name' : The name of the group of responsibilities
                'Responsibilities' : The responsibilities/activities/skills/behaviours
                'Skills': The list of skills with their title with their descriptions
            #JSON Output instructions
                Your response must always be a JSON object with the following schema:
                {
                    "reasoning": Why the skill was selected, as a JSON string
                    "picked_skill": The title of the skill that was picked, as a JSON string 
                    "remaining_skills": The remaining skill titles, as an array of a JSON strings
                }
            </System Instructions>
            """)

        return system_instructions

    @staticmethod
    def _get_prompt(*,
                    job_titles: list[str],
                    responsibilities_group_name: str,
                    responsibilities: list[str],
                    skills: list[SkillEntity],
                    ):

        prompt_template = dedent("""\
                                <Input>
                                'Job Titles': {job_titles}
                                'Responsibilities Group Name': {responsibilities_group_name}
                                'Responsibilities': {responsibilities}
                                'Skills': {skills}
                                </Input>
                                """)

        _skills = [{'skill title': entity.preferredLabel, 'skill description': entity.description} for entity in skills]
        return replace_placeholders_with_indent(prompt_template,
                                                job_titles=json.dumps(job_titles),
                                                responsibilities_group_name=responsibilities_group_name,
                                                responsibilities=json.dumps(responsibilities),
                                                skills=json.dumps(_skills, indent=4))
