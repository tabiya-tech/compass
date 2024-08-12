import json
import logging
from textwrap import dedent
from typing import Optional, TypeVar, Generic, Literal

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.vector_search.esco_entities import BaseEntity
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import ZERO_TEMPERATURE_GENERATION_CONFIG, LLMConfig, JSON_GENERATION_CONFIG

T = TypeVar('T', bound=BaseEntity)


class _RelevantEntityClassifierLLMOutput(BaseModel):
    reasoning: Optional[str]
    most_relevant: list[str]
    remaining: list[str]


class RelevantEntityClassifierOutput(BaseModel, Generic[T]):
    most_relevant: list[T]
    remaining: list[T]
    llm_stats: list[LLMStats]


def _get_job_title(experience_title: str, contextual_title: str):
    _aka_title = f"{(' aka ' + experience_title if experience_title and experience_title != contextual_title else '')}"
    return f"{contextual_title}{_aka_title}"


class RelevantEntitiesClassifierLLM(Generic[T]):
    def __init__(self, entity_type: Literal['skill', 'occupation']):
        self._entity_type_singular: Literal['skill', 'occupation'] = entity_type
        self._entity_types_plural = self._entity_type_singular + 's'
        self._entity_types_plural_capitalized = self._entity_types_plural.capitalize()
        self._llm = GeminiGenerativeLLM(
            system_instructions=RelevantEntitiesClassifierLLM._get_system_instructions(entity_type_singular=entity_type),
            config=LLMConfig(generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG)
        )
        self._llm_caller: LLMCaller[_RelevantEntityClassifierLLMOutput] = LLMCaller[_RelevantEntityClassifierLLMOutput](
            model_response_type=_RelevantEntityClassifierLLMOutput)
        self._logger = logging.getLogger(self.__class__.__name__)

    async def execute(
            self,
            *,
            experience_title: str,
            contextual_title: str,
            responsibilities: list[str],
            entities_to_classify: list[T],
            top_k: int = 5
    ) -> RelevantEntityClassifierOutput:
        """
        Given
        - an experience_title,
        - a contextual_title,
        - and list of responsibilities
        classify a list of entities in:
        - top_k most relevant entities
        - remaining entities

        If the experience title is different from the contextual title,
        then job title is the contextual title followed by "aka" and the experience title.
        """
        # create a dict with the entity text as key and the entity as value
        _entities_dict: dict[str, T] = {}
        for entity in entities_to_classify:
            _entities_dict[entity.preferredLabel] = entity

        prompt = RelevantEntitiesClassifierLLM._get_prompt(
            entity_type_singular=self._entity_type_singular,
            experience_title=experience_title,
            contextual_title=contextual_title,
            responsibilities=responsibilities,
            entities_to_classify=entities_to_classify,
            top_k=top_k)
        llm_output, llm_stats = await self._llm_caller.call_llm(llm=self._llm, llm_input=prompt, logger=self._logger)

        # log a warning if the two lists are disjoint and the union is the original list
        diff_len = len(llm_output.most_relevant) + len(llm_output.remaining) - len(entities_to_classify)
        if diff_len != 0:
            self._logger.warning(
                f"The list of {self._entity_types_plural} returned by the LLM is the same as the original list of {self._entity_types_plural}. There is a difference of %d {self._entity_types_plural}.",
                diff_len)

        if len(set(llm_output.most_relevant).intersection(set(llm_output.remaining))) != 0:
            self._logger.warning(f"The most relevant {self._entity_types_plural} and the remaining {self._entity_types_plural} are not disjoint.")

        # Since we cannot trust the LLM to always return the correct entities
        # We will return the original entities removing the ones that have been classified as "remaining"
        remaining_entities = []
        remaining_entities_uuids = []
        if llm_output:
            for entity_from_output in llm_output.remaining:
                entity_from_output = entity_from_output.strip(
                    '\'"')  # The llm sometimes returns the entity with quotes, especially if the entity contains a single quote
                entity = _entities_dict.get(entity_from_output, None)
                if entity:
                    remaining_entities.append(entity)
                    remaining_entities_uuids.append(entity.UUID)
                else:
                    self._logger.warning(f"The {self._entity_type_singular} %s is not in the original list of {self._entity_types_plural}.", entity_from_output)

        # Create the most relevant entities list by removing the remaining entities from the original list of entities
        # use the UUID to compare if the entities are the same
        most_relevant_entities = [entity for entity in entities_to_classify if entity.UUID not in remaining_entities_uuids]

        self._logger.info(f"For title: '%s'  and responsibilities: '%s'  relevant {self._entity_types_plural} response is: %s",
                          _get_job_title(experience_title, contextual_title),
                          json.dumps(responsibilities), llm_output)
        return RelevantEntityClassifierOutput(
            most_relevant=most_relevant_entities,
            remaining=remaining_entities,
            llm_stats=llm_stats)

    @staticmethod
    def _get_system_instructions(entity_type_singular: Literal['skill', 'occupation']):
        entity_types_plural = entity_type_singular + 's'
        entity_types_plural_capitalized = entity_types_plural.capitalize()
        system_prompt_template = dedent("""\
            <System Instructions>
            You are an expert in the labour market.
            
            You will be given a job title, a list of responsibilities/activities/skills/behaviours, a list of {entity_types_plural}, 
            and the number of the most relevant {entity_types_plural} to return.
            
            You will inspect '{entity_type_singular} title' and the '{entity_type_singular} description' of each {entity_type_singular} in '{entity_types_plural_capitalized}'
            to determine the most relevant {entity_types_plural} for the given 'Job Title' and 'Responsibilities'.
            
            You should return the titles of the most relevant {entity_types_plural} as a list of json strings and return the remaining {entity_type_singular} titles in an another list of json strings.
            Each {entity_type_singular} title from the input list must be present in one of the two lists.
            
            #Input Structure
                The input structure is composed of: 
                'Job Title': The job title 
                'Responsibilities' : The list of responsibilities/activities/skills/behaviours
                '{entity_types_plural_capitalized}': The list of {entity_types_plural} title with their descriptions to be classified
                'Number of {entity_types_plural} to return': The number of the most relevant {entity_types_plural} to return
            #JSON Output instructions
                Your response must always be a JSON object with the following schema:
                {
                    "reasoning": Why the {entity_types_plural} where selected as most relevant or not
                    "most_relevant": The most relevant {entity_type_singular} titles, an array of a json strings 
                    "remaining": The remaining {entity_types_plural}, an array of a json strings
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
                    experience_title: str,
                    contextual_title: str,
                    responsibilities: list[str],
                    entities_to_classify: list[T],
                    top_k: int = 5):

        entity_types_plural = entity_type_singular + 's'
        entity_types_plural_capitalized = entity_types_plural.capitalize()
        prompt_template = dedent("""\
                                <Input>
                                'Job Title': {job_title}
                                'Responsibilities': {responsibilities}
                                '{entity_types_plural_capitalized}': {entities_to_classify}
                                'Number of {entity_types_plural} to return': {top_k}
                                </Input>
                                """)

        job_title = _get_job_title(experience_title, contextual_title)
        _entities_to_classify = [{f'{entity_type_singular} title': entity.preferredLabel, f'{entity_type_singular} description': entity.description} for entity
                                 in entities_to_classify]
        return replace_placeholders_with_indent(prompt_template,
                                                entity_types_plural=entity_types_plural,
                                                entity_types_plural_capitalized=entity_types_plural_capitalized,
                                                job_title=job_title,
                                                responsibilities=json.dumps(responsibilities),
                                                entities_to_classify=json.dumps(_entities_to_classify, indent=4),
                                                top_k=f"{top_k}")