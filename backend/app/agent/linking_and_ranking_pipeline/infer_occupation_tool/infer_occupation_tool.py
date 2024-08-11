import asyncio
import logging
from typing import Optional

from pydantic import BaseModel

from app.agent.experience.work_type import WorkType
from app.countries import Country
from app.agent.agent_types import LLMStats
from ._contextualization_llm import _ContextualizationLLM

from app.vector_search.esco_entities import OccupationSkillEntity
from app.vector_search.esco_search_service import OccupationSkillSearchService
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings

MONGO_SETTINGS = MongoDbSettings()


class InferOccupationResult(BaseModel):
    contextual_title: str
    esco_occupations: list[OccupationSkillEntity]
    responsibilities: list[str]
    llm_stats: list[LLMStats]

    class Config:
        extra = "forbid"


class InferOccupationTool:

    def __init__(
            self,
            occupation_skill_search_service: OccupationSkillSearchService,
    ):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._occupation_skill_search_service = occupation_skill_search_service

    async def execute(self, *,
                      experience_title: str,
                      company: Optional[str] = None,
                      work_type: Optional[WorkType] = None,
                      responsibilities: list[str],
                      country_of_interest: Country,
                      top_k: int = 5) -> InferOccupationResult:
        """
        Infers most likely matching occupations based on the experience and the country of interest.
        It uses the experience title to search for the top_k matching occupations.
        Additionally, it infers a contextual title based on the country of interest and information from the experience
        and searches for the top_k matching occupations based on the contextual title.
        The final list of occupations is a list of unique occupations from the two searches, so it may contain from top_k to 2*top_k occupations.
        It returns the contextual title, the list of mathing occupations and the stats of the LLM

        The experience is not changed by this method.
        """

        contextualization_llm = _ContextualizationLLM(country_of_interest, self._logger)
        contextualization_response = await contextualization_llm.execute(
            experience_title=experience_title,
            company=company,
            work_type=work_type,
            responsibilities=responsibilities
        )
        #  create a set to remove duplicates and convert to lowercase
        titles: set[str] = {contextualization_response.contextual_title.lower(), experience_title.lower()}
        # create a task for each title
        tasks = [self._occupation_skill_search_service.search(query=title, k=top_k) for title in titles]

        list_of_occupation_list = await asyncio.gather(*tasks)
        occupations_skills = flattern(list_of_occupation_list)
        return InferOccupationResult(contextual_title=contextualization_response.contextual_title,
                                     esco_occupations=occupations_skills,
                                     responsibilities=responsibilities,
                                     llm_stats=contextualization_response.llm_stats
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