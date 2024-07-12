import logging
from abc import ABC, abstractmethod
from enum import Enum

from pydantic import BaseModel

from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_memory_manager import \
    ConversationMemoryManager


class ConversationPhase(Enum):
    """
    An enumeration for conversation phases
    """
    INTRO = 0
    COUNSELING = 1
    CHECKOUT = 2
    ENDED = 3


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
