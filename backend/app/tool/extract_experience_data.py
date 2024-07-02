import logging

from textwrap import dedent

from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience.work_type import WorkType
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, LOW_TEMPERATURE_GENERATION_CONFIG

logger = logging.getLogger(__name__)


def extract_work_type(llm_output_field:str) -> WorkType:
    if "FORMAL" in llm_output_field:
        return WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
    # TODO: cover all enum values
    else:
        return None


class ExtractExperienceTool:
    """
    This tool takes a user input text and uses an LLM to decide what past experiences is the user talking about.
    The experience can be a formal work experience (e.g. baker) or an informal experience (e.g. cooking for the family).

    Note that we don't link to ESCO data in this tool.
    """

    def __init__(self):
        config:LLMConfig = LLMConfig(generation_config=LOW_TEMPERATURE_GENERATION_CONFIG)
        # TODO: Consider using json (now we use a CSV-like format) to be consistent with the agents.
        self._system_instructions = dedent(""" 
                    Given a conversation between a user and an assistant of an employment agency, list all the 
                    relevant occupations, places of work, dates and whether it was in the unseen economy or not. The 
                    format should be:

                    {JOB_TITLE}; {UNSEEN_OR_FORMAL_ECONOMY}; {PLACE_OF_WORK}; {COMPANY}; {DATES_WORKED}
                    
                    each variable should be separated by semicolon and each position should be separated by a newline. 
                    If you are unsure about a variable, return NOT_CLEAR
              """)
        self._llm = GeminiGenerativeLLM(system_instructions=self._system_instructions, config=config)

    async def extract_experience_data(self, user_str: str) -> list[ExperienceEntity]:
        llm_response = await self._llm.generate_content(user_str)
        response_text = llm_response.text
        experiences: list[ExperienceEntity] = []
        for line in response_text.split("\n"):
            if line.strip() == "":
                continue
            elements = line.split(";")
            experience = ExperienceEntity(experience_title=elements[0])
            # TODO: extract the other fields too (e.g. work_type, location)
            # experience.work_type =  extract_work_type(elements[1])
            experiences.append(experience)
        return experiences
