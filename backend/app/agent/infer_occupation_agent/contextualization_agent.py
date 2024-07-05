from textwrap import dedent

from app.agent.agent import Agent
from app.agent.experience.experience_entity import ExperienceEntity
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LOW_TEMPERATURE_GENERATION_CONFIG, LLMConfig
                                   
def get_system_prompt_for_contextual_title(country_of_interest: str):
    """Writes a prompt to find the contextual title from the attributes
    of an ExperienceEntity
    """
    return dedent(f"""You are an expert who needs to classify jobs from {country_of_interest} to a European framework. The jobs are described in the context of {country_of_interest} and use specific terminology from {country_of_interest}. You should return a job description that does not include terminology from {country_of_interest}, but rather European standards.

        ## Input Structure
        The input structure is composed of a job title, the employer name and the type of employment, among wage employment, unpaid labor or freelance work.
        You should use the employer information only to infer the context and you shouldn't return it as output. 

        ## Output Structure
        The output needs to be exclusively the contextualized job title. Don't output anything else. Do not include the employer information.
        """)


def get_request_prompt_for_contextual_title(experience_entity: ExperienceEntity):
    return dedent(f"""Job description: {experience_entity.experience_title}
        Employer name: {experience_entity.company if experience_entity.company is not None else "Undefined"}
        Employment type: {experience_entity.work_type if experience_entity.work_type is not None else "Undefined"}
        Contextualized job title: """)

class ContextualizationAgent(Agent):
    """Agent to find a contextualized job title
    for a given experience.
    """
    def __init__(self):
        self._experience: ExperienceEntity | None = None
        self.country_of_interest : str | None = None

    def set_experience(self, experience: ExperienceEntity):
        """
        Sets the experience entity of the agent.

        """
        if experience.experience_title is None:
            raise ValueError("Input experience should have experience_title.")
        self._experience = experience

    def set_country_of_interest(self, country_of_interest: str):
        """Sets the country of interest of the agent
        """
        # TODO: Add logic and Enum
        self.country_of_interest = country_of_interest
        
    async def execute(
            self,
            config: LLMConfig = LLMConfig(
                generation_config=LOW_TEMPERATURE_GENERATION_CONFIG
            ),
    ) -> str:
        """Runs an LLM query to get the contextualized title
        given the experience entity and the country of interest
        for the localization.

        Args:
            config (LLMConfig, optional): config file for the LLM.
                Defaults to LLMConfig( generation_config=LOW_TEMPERATURE_GENERATION_CONFIG ).

        Returns:
            str: contextualized title to be returned
        """
        if not self.country_of_interest:
            raise ValueError("Country of interest needs to be set.")
        if not self._experience:
            raise ValueError("Experience Entity needs to be set")
        contextual_system_prompt = get_system_prompt_for_contextual_title(
            self.country_of_interest
        )
        contextual_request = get_request_prompt_for_contextual_title(
            self._experience
        )
        llm = GeminiGenerativeLLM(
            system_instructions=contextual_system_prompt, config=config
        )
        response = await llm.generate_content(contextual_request)
        # TODO: how to use agent input and output for this case?
        return response