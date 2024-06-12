import logging
from abc import ABC, abstractmethod
from enum import Enum

from pydantic import BaseModel

from app.agent.agent import Agent
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.experiences_explorer_agent import ExperiencesExplorerAgent
from app.agent.farewell_agent import FarewellAgent
from app.agent.skill_explore_agent import SkillExplorerAgent
from app.agent.welcome_agent import WelcomeAgent
from app.conversation_memory.conversation_memory_manager import \
    ConversationMemoryManager
from app.vector_search.similarity_search_service import SimilaritySearchService


class AgentState(BaseModel):
    """
    Abstract base class for all agent-specific states.
    """
    pass


class ConversationPhase(Enum):
    """
    An enumeration for conversation phases
    """
    INTRO = 0
    CONSULTING = 1
    CONSULTING_EXPERIENCES = 2
    CHECKOUT = 3
    ENDED = 4

class AgentDirectorState(BaseModel):
    """
    The state of the agent director
    """
    session_id: int
    current_phase: ConversationPhase

    def __init__(self, session_id):
        super().__init__(session_id=session_id,
                         current_phase=ConversationPhase.INTRO)

class AbstractAgentDirector(ABC):
    """
    An abstract class for an agent director. Receives user input,
    understands the conversation context and the latest user message and routes the user input to the appropriate agent.
    It maintains the state of the conversation which is divided into phases.
    """

    def __init__(self, conversation_manager: ConversationMemoryManager):
        # Initialize the logger
        self._logger = logging.getLogger(self.__class__.__name__)

        # set the conversation manager
        self._conversation_manager = conversation_manager

        self._state: AgentDirectorState | None = None

    def set_state(self, state: AgentDirectorState):
        """
        Set the agent director state
        :param state: the agent director state
        """
        self._state = state

    @abstractmethod
    async def execute(self, user_input: AgentInput) -> AgentOutput:
        """
        Run the conversation task for the current user input and specific state.
        :param user_input:
        :return:
        """
        raise NotImplementedError()


class AgentDirector(AbstractAgentDirector):
    """
    A simple implementation of an agent director. It transitions sequentially through the conversation phases and
    delegates the conversation to the appropriate agent for each phase.
    There is always one agent responsible for each phase.
    """

    def __init__(self, conversation_manager: ConversationMemoryManager,
                 similarity_search_service: SimilaritySearchService):
        super().__init__(conversation_manager)

        # initialize the agents
        self._agents: dict[ConversationPhase, Agent] = {
            ConversationPhase.INTRO: WelcomeAgent(),
            ConversationPhase.CONSULTING_EXPERIENCES: ExperiencesExplorerAgent(similarity_search_service),
            ConversationPhase.CONSULTING: SkillExplorerAgent(),
            ConversationPhase.CHECKOUT: FarewellAgent()
        }

    def get_experiences_explorer_agent(self):
        return self._agents[ConversationPhase.CONSULTING_EXPERIENCES]

    def _get_current_agent(self) -> Agent | None:
        """
        Get the current agent for a specific state.
        :return: The current agent for the state, or None if conversation has ended
        """
        return self._agents.get(self._state.current_phase, None)

    def _transition_to_next_phase(self):
        """
        Transition to the next phase of the conversation.
        """
        if self._state.current_phase != ConversationPhase.ENDED:
            self._state.current_phase = ConversationPhase(self._state.current_phase.value + 1)

    async def execute(self, user_input: AgentInput) -> AgentOutput:
        """
        Run the conversation task for the current user input and specific state.
        When all agents are done, return a message to the user that the conversation is finished.
        :param user_input: The user input
        :return: The output from the agent
        """

        try:
            current_agent = self._get_current_agent()
            if current_agent:
                context = await self._conversation_manager.get_conversation_context()
                agent_output = await current_agent.execute(user_input, context)
                if agent_output.finished:  # If the agent is finished, move to the next agent
                    self._transition_to_next_phase()
                    # Update the conversation history
                await self._conversation_manager.update_history(user_input, agent_output)
            else:
                # No more agents to run
                agent_output = AgentOutput(
                    message_for_user="Conversation finished, all agents are done!",
                    finished=True, agent_type=None)
            return agent_output
        # executing an agent can raise any number of unknown exceptions
        except Exception as e:  # pylint: disable=broad-except
            self._logger.error("Error while executing the agent director: %s", e, exc_info=True)
            return AgentOutput(message_for_user="Conversation forcefully ended",
                               finished=True, agent_type=None)
