import asyncio
import logging

from pydantic import BaseModel

from app.countries import Country
from app.agent.agent_types import LLMStats
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.infer_occupation_tool._contextualization_llm import _ContextualizationLLM

from app.vector_search.esco_entities import OccupationSkillEntity
from app.vector_search.esco_search_service import OccupationSkillSearchService
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings

MONGO_SETTINGS = MongoDbSettings()


class InferredOccupationResult(BaseModel):
    contextualized_title: str
    esco_occupations: list[OccupationSkillEntity]
    stats: LLMStats

    class Config:
        extra = "forbid"


class InferOccupationTool:

    def __init__(
            self,
            occupation_skill_search_service: OccupationSkillSearchService,
    ):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._occupation_skill_search_service = occupation_skill_search_service

    async def execute(self,
                      country_of_interest: Country,
                      experience: ExperienceEntity,
                      top_k: int = 10) -> InferredOccupationResult:
        """
        TODO: Add description
        """

        contextualization_llm = _ContextualizationLLM(country_of_interest, self._logger)
        contextualized_title, llm_stats = await contextualization_llm.execute(experience)
        tasks = [self._occupation_skill_search_service.search(query=contextualized_title, k=top_k)]
        if contextualized_title.lower() != experience.experience_title.lower():
            tasks.append(self._occupation_skill_search_service.search(query=experience.experience_title, k=top_k))

        list_of_occupation_list = await asyncio.gather(*tasks)
        occupations_skills = flattern(list_of_occupation_list)
        return InferredOccupationResult(contextualized_title=contextualized_title,
                                        esco_occupations=occupations_skills,
                                        stats=llm_stats
                                        )


def flattern(list_of_occupation_list: list[list[OccupationSkillEntity]]) -> list[OccupationSkillEntity]:
    # Flatten the list of lists
    flattened_results: list[OccupationSkillEntity] = [item for sublist in list_of_occupation_list for item in sublist]

    # Filter out duplicates based on uuid
    seen_uuids = set()
    unique_results: list[OccupationSkillEntity] = []
    for item in flattened_results:
        if item.occupation.UUID not in seen_uuids:
            seen_uuids.add(item.occupation.UUID)
            unique_results.append(item)

    return unique_results
