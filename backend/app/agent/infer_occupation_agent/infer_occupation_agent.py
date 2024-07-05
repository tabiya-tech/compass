from enum import Enum
from time import time

from motor.motor_asyncio import AsyncIOMotorClient
from typing import List

from app.agent.agent import Agent
from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.infer_occupation_agent.contextualization_agent import ContextualizationAgent
from app.agent.infer_occupation_agent.infer_llm_caller import InferLLMCaller
from app.conversation_memory.conversation_memory_manager import \
    ConversationContext
from app.vector_search.embeddings_model import GoogleGeckoEmbeddingService
from app.vector_search.esco_entities import OccupationSkillEntity, OccupationEntity
from app.vector_search.esco_search_service import OccupationSkillSearchService
from app.vector_search.similarity_search_service import SimilaritySearchService
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings

MONGO_SETTINGS = MongoDbSettings()

class InferAgentStates(Enum):
    """The InferOccupationAgent has four possible states,
    each representing a task it should solve. The agent
    should
        1. Find a contextual title for the input experience;
        2. Link the contextual title to ESCO if a country
            of interest is provided.
        3. Infer one among the linked occupation through
            chat history or additional conversation with the user.

    When in INFERENCE_PHASE, the agent can either continue the conversation, exit because
    the ESCO results are unsatisfactory or return the correct occupation and close the task.
    """

    # Beginning of the conversation, experience needs to be set.
    INIT = 0
    # Contextualized title needs to be linked to ESCO taxonomy
    LINKING_PHASE = 1
    # Validated ESCO job should be returned
    INFERENCE_PHASE = 2


class InferOccupationAgent(Agent):
    """LLMAgent class with the following tasks:
    1. Retrieve a contextualized job title for the location of interest.
    2. Retrieve ESCO nodes matching the contextualized job title.
    3. Verifying and inferring which of the ESCO nodes is correct.
    """

    def __init__(
            self,
    ):
        """Initialized the agent and set it to INIT state.
        """
        super().__init__(agent_type=AgentType.INFER_OCCUPATIONS_AGENT,
                         is_responsible_for_conversation_history=True)  # Not sure
        compass_db = AsyncIOMotorClient(MONGO_SETTINGS.mongodb_uri).get_database(
            MONGO_SETTINGS.database_name
        )
        gecko_embedding_service = GoogleGeckoEmbeddingService()
        self.occupation_search_service: SimilaritySearchService[OccupationSkillEntity] = (
            OccupationSkillSearchService(compass_db, gecko_embedding_service)
        )
        self._experience: ExperienceEntity | None = None
        self.country_of_interest : str | None = None
        self.state = InferAgentStates.INIT
        self.contextualization_agent = ContextualizationAgent()
        self.infer_llm_caller = InferLLMCaller()

    def set_experience(self, experience: ExperienceEntity):
        """
        Sets the experience entity of the agent.
        Args:
            experience_entity (ExperienceEntities): The experience entity is partially initialized
                from a previous iteration of the CollectExperienceInformation agent, which returns
                fields such as experience title, company, work type, location and timeline.
                Experience title is a required field, while the other can be set to None.
                We admit contextualized title and esco occupations to be already filled, but this should
                be the task of this agent.
        """
        if self._experience:
            raise ValueError("Experience already set")
        # Needs experience_title for localization and linking
        if not experience.experience_title:
            raise ValueError("Input experience should have experience_title.")
        self._experience = experience
        if self._experience.esco_occupations:
            self.state = InferAgentStates.INFERENCE_PHASE
        else:
            self.state = InferAgentStates.LINKING_PHASE

    def set_country_of_interest(self, country_of_interest: str):
        # TODO: Add logic and Enum
        if self._experience.contextual_title:
            raise ValueError("Contextual title already set")
        self.country_of_interest = country_of_interest
        # TODO: Decide if adding a country of interest after
        # Linking leads to repeating the linking or to error.
        # It currently leads to repeating the linking
        self._experience.esco_occupations = []
        self.state = InferAgentStates.LINKING_PHASE


    async def link_to_occupations(self, experience_title: str, top_k: int = 10) -> List[OccupationEntity]:
        """Calls ESCO search on the agent's experience entity
        contextualized title to get the top_k occupations. Sets
        the corresponding esco_occupations attribute of the
        agent's experience entity variable as the output of the ESCO
        search.

        Args:
            experience_title (str): string to be linked to ESCO.
            top_k (int, optional): Number of occupations to return
                from ESCO search. Defaults to 10.

        Returns:
            List[OccupationEntity]: list of top_k occupation entities
                linked to the input string.
        """
        occupations = await self.occupation_search_service.search(experience_title, top_k)
        return [
            occupation.occupation for occupation in occupations
        ]


    async def execute(self, agent_input: AgentInput, conversation_context: ConversationContext) -> AgentOutput:
        """Executes the main tasks of the InferOccupationAgent,
        depending on the state. In particular, depending on the state 
        it will perform different actions as follows:
        1. INIT - Initialize an experience entity.
        2. LINKING_PHASE - Find contextualized title if country of interest 
            is provided and then link it (or the experience title) to ESCO occupations.
        3. INFERENCE_PHASE - Validate one of the possible occupations using either
            chat history or a conversation with the user.
        The Agent fails if no ESCO match can be validated. 

        Args:
            agent_input (AgentInput): the AgentInput potentially containing a
                message from the user if in a conversation at INFERENCE_PHASE.
            conversation_context (ConversationContext): conversation history of
                the agents up to that point.

        Returns:
            AgentOutput: Output including potential message to the user, 
                whether the agent is finished or whether it failed.
        """
        s = time()
        if self.state == InferAgentStates.INIT:
            raise ValueError("Experience Entity needs to be set using InferOccupationAgent.set_experience.")
        if self.state == InferAgentStates.LINKING_PHASE:
            if self.country_of_interest is not None:
                # Finds a contextual title from the set experience and country of interest.
                self.contextualization_agent.set_experience(self._experience)
                self.contextualization_agent.set_country_of_interest(self.country_of_interest)
                response_from_agent = await self.contextualization_agent.execute()
                self._experience.contextual_title = response_from_agent.text
                # Links the contextual title to ESCO
                self._experience.esco_occupations = await self.link_to_occupations(self._experience.contextual_title)
            else:
                # Links the experience title to ESCO
                self._experience.esco_occupations = await self.link_to_occupations(self._experience.experience_title)
            self.state = InferAgentStates.INFERENCE_PHASE
        if self.state == InferAgentStates.INFERENCE_PHASE:
            # Initializes the experience on the first call
            if not self.infer_llm_caller._experience:
                self.infer_llm_caller.set_experience(self._experience)
            response, stats = await self.infer_llm_caller.execute(agent_input, conversation_context)
            return AgentOutput(
                finished=response.finished,
                data= response, #We store here the necessary elements
                agent_type=AgentType.INFER_OCCUPATIONS_AGENT,
                reasoning=response.reasoning,
                agent_response_time_in_sec=round(time() - s, 2),
                llm_stats=stats,
                message_for_user=response.response,
            )
