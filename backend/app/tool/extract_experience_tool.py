import logging
from abc import ABC
from textwrap import dedent
from typing import List, Optional

from pydantic.main import BaseModel

from app.vector_search.esco_entities import OccupationEntity
from app.vector_search.similarity_search_service import SimilaritySearchService
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, LOW_TEMPERATURE_GENERATION_CONFIG

logger = logging.getLogger(__name__)


class ExperienceEntity(BaseModel):
    """
    A class to represent a work experience (formal, informal or unseen economy).
    """

    # The job title as referred by the user (i.e. not necessarily the official ESCO occupation label)
    job_title: str
    # The occupation records in the ESCO db that we think are related to this experience
    esco_occupations: Optional[List[OccupationEntity]] = []
    # TODO: Add more fields, especially the skills. Also decide whether we want skills to be directly connected to
    #  each occupation or not.


class ExtractExperienceTool:
    """
    This tool takes a user input text and uses an LLM to decide what past experiences is the user talking about.
    The experience can be a formal work experience (e.g. baker) or an informal experience (e.g. cooking for the family).
    Those are then parsed, looked-up in ESCO and returned as a list of ExperienceEntity.
    """

    def __init__(self, occupation_search_service: SimilaritySearchService[OccupationEntity],
                 config: LLMConfig = LLMConfig(generation_config=LOW_TEMPERATURE_GENERATION_CONFIG)):
        # TODO: Consider using json (now we use a CSV-like format) to be consistent with the agents.
        self._system_instructions = dedent(""" 
                    Given a conversation between a user and an assistant of an employment agency, list all the 
                    relevant occupations, places of work, dates and whether it was in the unseen economy or not. The 
                    format should be:

                    {JOB_TITLE}; {UNSEEN_OR_FORMAL_ECONOMY}; {PLACE_OF_WORK}; {DATES_WORKED}
                    
                    each variable should be separated by semicolon and each position should be separated by a newline. 
                    If you are unsure about a variable, return NOT_CLEAR
              """)
        self._llm = GeminiGenerativeLLM(system_instructions=self._system_instructions, config=config)
        self._occupation_search_service = occupation_search_service

    async def extract_experience_from_user_reply(self, user_str: str) -> List[ExperienceEntity]:
        # Use the LLM to find out what was the experiences the user is talking about
        llm_response = await self._llm.generate_content(user_str)
        response_text = llm_response.text
        experiences: List[ExperienceEntity] = []
        for line in response_text.split("\n"):
            if line.strip() == "":
                continue
            elements = line.split(";")
            experience = ExperienceEntity(job_title=elements[0])
            experience.esco_occupations = await self._occupation_search_service.search(elements[0])
            # TODO: Add more fields, especially the skills.
            experiences.append(experience)
        return experiences
