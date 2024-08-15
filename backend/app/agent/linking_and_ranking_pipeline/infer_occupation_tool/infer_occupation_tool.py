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
from ._relevant_occupations_classifier_llm import _RelevantOccupationsClassifierLLM

MONGO_SETTINGS = MongoDbSettings()


class InferOccupationToolOutput(BaseModel):
    contextual_titles: list[str]
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
                      number_of_titles: int,
                      top_k: int,
                      top_p: int
                      ) -> InferOccupationToolOutput:
        """
        Finds the top_k matching occupations to the experience title, company, work type and responsibilities and country of interest.
        1. Contextualize the experience title based on the country of interest, company, work type and responsibilities
          and infer the contextual title.
        2. Search for the top_p occupations matching the title
        2.1 Search for the top_p occupations matching the experience title
        2.2 Search for the top_p occupations matching the contextual title
        3. Filter out the irrelevant occupations based on the responsibilities and keep the top_k most relevant ones
        """

        # 1. Contextualize the experience title based on the country of interest, company, work type and responsibilities
        #    and infer the contextual title.
        contextualization_llm = _ContextualizationLLM(
            country_of_interest=country_of_interest,
            number_of_titles=number_of_titles,
            logger=self._logger)
        contextualization_response = await contextualization_llm.execute(
            experience_title=experience_title,
            company=company,
            work_type=work_type,
            responsibilities=responsibilities,
            number_of_titles=number_of_titles
        )
        # 2. Search for the top_p occupations matching the title
        #  create a set to remove duplicates and convert to lowercase as the esco titles in the db are lowercase and
        #  using a different case yields imprecise results
        titles: set[str] = {experience_title.strip().lower()}.union(
            {title.strip().lower() for title in contextualization_response.contextual_titles})
        # create a task for each title
        # search for the top_p matching occupations for each title initially, and later filter out the irrelevant ones
        tasks = [self._occupation_skill_search_service.search(query=title, k=top_p) for title in titles]

        list_of_occupation_list = await asyncio.gather(*tasks)
        occupations_skills = flattern(list_of_occupation_list)

        # 3. Filter out the irrelevant occupations based on the responsibilities and keep the top_k most relevant ones
        relevant_occupations_tool = _RelevantOccupationsClassifierLLM()
        relevant_occupations_output = await relevant_occupations_tool.execute(
            job_titles=list(titles),
            occupations=[occupation_skill.occupation for occupation_skill in occupations_skills],
            responsibilities=responsibilities,
            top_k=top_k
        )
        relevant_occupations_uuids = {occupation.UUID for occupation in relevant_occupations_output.most_relevant}
        relevant_occupations_skills = [occupation_skill for occupation_skill in occupations_skills if
                                       occupation_skill.occupation.UUID in relevant_occupations_uuids]

        return InferOccupationToolOutput(contextual_titles=contextualization_response.contextual_titles,
                                         esco_occupations=relevant_occupations_skills,
                                         responsibilities=responsibilities,
                                         llm_stats=contextualization_response.llm_stats + relevant_occupations_output.llm_stats
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
