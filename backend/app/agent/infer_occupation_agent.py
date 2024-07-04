from enum import Enum
from time import time

from motor.motor_asyncio import AsyncIOMotorClient

from app.agent.agent import Agent
from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.llm_response import InferOccupationModelResponse
from app.conversation_memory.conversation_memory_manager import \
    ConversationContext
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_entities import OccupationSkillEntity
from app.vector_search.esco_search_service import OccupationSkillSearchService
from app.vector_search.similarity_search_service import SimilaritySearchService
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import (LOW_TEMPERATURE_GENERATION_CONFIG, LLMConfig, JSON_GENERATION_CONFIG)
from common_libs.text_formatters.extract_json import extract_json

MONGO_SETTINGS = MongoDbSettings()


class InferAgentStates(Enum):
    """The InferOccupationAgent has four possible states,
    each representing a task it should solve. The agent
    should
        1. Find a contextual title for the input experience;
        2. Link the contextual title to ESCO;
        3. Infer one among the linked occupation through
            chat history or additional conversation with the user.

    When in UNINFERRED, the agent can either continue the conversation, exit because
    the ESCO results are unsatisfactory or return the correct occupation and close the task.
    """

    # Beginning of the conversation, contextualized title needs to be retrieved
    UNCONTEXTUALIZED = 0
    # Contextualized title needs to be linked to ESCO taxonomy
    UNLINKED = 1
    # Validated ESCO job should be returned
    UNINFERRED = 2


def get_system_prompt_for_contextual_title(experience_entity: ExperienceEntity):
    """Writes a prompt to find the contextual title from the attributes
    of an ExperienceEntity
    """
    return f"""You are an expert who needs to classify jobs from {experience_entity.location} to a European framework. The jobs are described in the context of {experience_entity.location} and use specific terminology from {experience_entity.location}. You should return a job description that does not include terminology from {experience_entity.location}, but rather European standards.

## Input Structure
The input structure is composed of a job title, the employer name and the type of employment, among wage employment, unpaid labor or freelance work.
You should use the employer information only to infer the context and you shouldn't return it as output. 

## Output Structure
The output needs to be exclusively the contextualized job title. Don't output anything else. Do not include the employer information.
"""


def get_request_prompt_for_contextual_title(experience_entity: ExperienceEntity):
    return f"""Job description: {experience_entity.experience_title}
Employer name: {experience_entity.company if experience_entity.company is not None else "Undefined"}
Employment type: {experience_entity.work_type if experience_entity.work_type is not None else "Undefined"}
Contextualized job title: """


OCCUPATION_INFERENCE_SYSTEM_PROMPT = """You work for an employment agency helping users outline their previous experiences.

**Main Task**: You are tasked with understanding the proper definition of one of the user's occupations from the entire conversation history. 
**Available Data**: You are given a list of options between which you can choose. If none of the options apply, you can ask for more options in the appropriate field.
**Address the user**: In case the context does not provide enough information, you can ask additional questions to the user to differentiate between the options.
**Tone**: Maintain a concise and professional tone, while being polite and empathetic.

Your response must always be a JSON object with the following schema:

        - reasoning: A string explanation of the decisions taken regarding the following parameters.  
        - needs_more_info: A boolean flag to signal that you need more information from the user.
            Set to True if you need more information. Set to False if you are ready.
        - response: A string request of more information to the user in case needs_more_info is set to True. Empty string otherwise.
        - finished: A boolean flag to signal that the task is finished and a single correct occupation among the options has been found.
            Set True if the occupation has been found. False otherwise.
        - correct_occupation: a string containing the correct occupation among the options if finished is set to True. Empty string otherwise."""


def get_prompt_for_occupation_inference(
        experience_entity: ExperienceEntity,
        conversation_context: ConversationContext,
        message: str,
):
    """Writes a prompt to infer the correct occupation for an ExperienceEntity"""
    esco_occupation_string = "\n".join(
        [entity.preferredLabel for entity in experience_entity.esco_occupations]
    )
    conversation_history_string = ConversationHistoryFormatter.format_to_string(conversation_context, message)
    return f"""## Occupation of interest: 
{experience_entity.experience_title}
## ESCO Occupation options: 
{esco_occupation_string}
## Conversation history:
{conversation_history_string}
"""


class InferOccupationAgent(Agent):
    """LLMAgent class with the following tasks:
    1. Retrieve a contextualized job title for the location of interest.
    2. Retrieve ESCO nodes matching the contextualized job title.
    3. Verifying and inferring which of the ESCO nodes is correct.
    """

    def __init__(
            self,
    ):
        """The Agent should be initialized based on an ExperienceEntities class, as well as
        the conversation context up until that moment.

        Args:
            experience_entity (ExperienceEntities): The experience entity is partially initialized
                from a previous iteration of the CollectExperienceInformation agent, which returns
                fields such as experience title, company, work type, location and timeline.
                Experience title and location are required fields, while the other can be set to None.
                We admit contextualized title and esco occupations to be already filled, but this should
                be the task of this agent.
        """
        super().__init__(agent_type=AgentType.INFER_OCCUPATIONS_AGENT,
                         is_responsible_for_conversation_history=False)  # Not sure
        compass_db = AsyncIOMotorClient(MONGO_SETTINGS.mongodb_uri).get_database(
            MONGO_SETTINGS.database_name
        )
        gecko_embedding_service = GoogleGeckoEmbeddingService()
        self.occupation_search_service: SimilaritySearchService[OccupationSkillEntity] = (
            OccupationSkillSearchService(compass_db, gecko_embedding_service)
        )
        self._experience: ExperienceEntity | None = None

    def set_experience(self, experience: ExperienceEntity):
        # Needs experience_title for localization and linking
        if experience.experience_title is None:
            raise ValueError("Input experience should have experience_title.")
        # Needs location for localization
        if experience.location is None:
            raise ValueError("Input experience should have location.")
        self._experience = experience
        if self._experience.contextual_title is None:
            self.state = InferAgentStates.UNCONTEXTUALIZED
        elif self._experience.esco_occupations is None:
            self.state = InferAgentStates.UNLINKED
        else:
            self.state = InferAgentStates.UNINFERRED

    async def find_contextual_title(
            self,
            config: LLMConfig = LLMConfig(
                generation_config=LOW_TEMPERATURE_GENERATION_CONFIG
            ),
    ):
        """Runs an LLM query to get the contextualized title
        given the experience entity. Sets the corresponding attribute
        of the experience entity with the result of the LLM call.
        """
        contextual_system_prompt = get_system_prompt_for_contextual_title(
            self._experience
        )
        contextual_request = get_request_prompt_for_contextual_title(
            self._experience
        )

        llm = GeminiGenerativeLLM(
            system_instructions=contextual_system_prompt, config=config
        )
        response = await llm.generate_content(contextual_request)
        # TODO: validate response
        self._experience.contextual_title = response.text

    async def link_to_occupations(self, top_k: int = 10):
        """Calls ESCO search on the agent's experience entity
        contextualized title to get the top_k occupations. Sets
        the corresponding esco_occupations attribute of the
        agent's experience entity variable as the output of the ESCO
        search.

        Args:
            top_k (int, optional): Number of occupations to return
                from ESCO search. Defaults to 10.
        """
        query = self._experience.contextual_title
        occupations = await self.occupation_search_service.search(query, top_k)
        self._experience.esco_occupations = [
            occupation.occupation for occupation in occupations
        ]

    async def return_response(
            self,
            message: str,
            conversation_context: ConversationContext,
            config: LLMConfig = LLMConfig(
                generation_config=LOW_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG
            ),
    ) -> InferOccupationModelResponse:
        """Returns the output of the inference once the experience entity
        is enriched with the contextualized title and the esco occupations.

        Returns:
            Dict[str,str]: A dictionary with the following keys:
            - needs_more_info: A boolean flag to signal that the model needs more information from the user.
            - response: A string request of more information to the user in case needs_more_info is set to True. Empty string otherwise.
            - more_options: A boolean flag to signal that no answer can be found within the available ESCO Occupations.
            - finished: A boolean flag to signal that the task is finished and a single correct occupation among the options has been found.
            - correct_occupation: a string containing the correct occupation among the options if finished is set to True. Empty string otherwise.

        """
        if not self._experience.esco_occupations:
            raise ValueError("Experience should be linked to ESCO occupations before return_response is called.")
        llm = GeminiGenerativeLLM(
            system_instructions=OCCUPATION_INFERENCE_SYSTEM_PROMPT, config=config
        )
        inference_prompt = get_prompt_for_occupation_inference(
            self._experience, conversation_context, message
        )
        full_response = await llm.generate_content(inference_prompt)
        response = extract_json(
            full_response.text,
            InferOccupationModelResponse
        )
        return response

    async def execute(self, agent_input: AgentInput, conversation_context: ConversationContext) -> AgentOutput:
        """Executes the main tasks of the InferOccupationAgent,
        depending on the state. In particular, depending on the state 
        it will:
        1. UNCONTEXTUALIZED - Find a contextualized title for the experience entity
        2. UNLINKED - Link the contextualized title to ESCO occupations
        3. UNINFERRED - Validate one of the possible occupations using either
            chat history or a conversation with the user.
        The Agent fails if no ESCO match can be validated. 

        Args:
            agent_input (AgentInput): the AgentInput potentially containing a
                message from the user if in a conversation at UNINFERRED.
            conversation_context (ConversationContext): conversation history of
                the agents up to that point.

        Returns:
            AgentOutput: Output including potential message to the user, 
                whether the agent is finished or whether it failed.
        """
        s = time()
        if self.state == InferAgentStates.UNCONTEXTUALIZED:
            await self.find_contextual_title()
            self.state = InferAgentStates.UNLINKED
        if self.state == InferAgentStates.UNLINKED:
            await self.link_to_occupations()
            self.state = InferAgentStates.UNINFERRED
        if self.state == InferAgentStates.UNINFERRED:
            message = agent_input.message
            response = await self.return_response(message, conversation_context)
            # TODO: is this the right way to deal with conversation history?
            if response.response:
                self.is_responsible_for_conversation_history = True
            else:
                self.is_responsible_for_conversation_history = False
            return AgentOutput(
                finished=response.finished,
                agent_type=AgentType.INFER_OCCUPATIONS_AGENT,
                reasoning=response.reasoning,
                agent_response_time_in_sec=round(time() - s, 2),
                llm_stats=[],
                message_for_user=response.response,
            )
