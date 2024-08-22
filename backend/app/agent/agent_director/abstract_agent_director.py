import logging
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Optional
from datetime import datetime

from pydantic import BaseModel, Field, field_serializer, field_validator
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
    current_phase: ConversationPhase = Field(default=ConversationPhase.INTRO)
    conversation_completed_at: Optional[datetime] = None

    class Config:
        extra = "forbid"

    # Serialize the conversation_completed_at datetime to ensure it's stored as UTC
    @field_serializer("conversation_completed_at")
    def serialize_conversation_completed_at(self, conversation_completed_at: Optional[datetime]) -> Optional[str]:
        return conversation_completed_at.isoformat() if conversation_completed_at else None

    # Deserialize the conversation_completed_at datetime and ensure it's interpreted as UTC
    @field_validator("conversation_completed_at", mode='before')
    def deserialize_conversation_completed_at(cls, value: Optional[str | datetime]) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, str):
            dt = datetime.fromisoformat(value)
        else:
            dt = value
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    # override the dict method to return the enum value instead of the enum object
    def dict(self, *args, **kwargs):
        return super().dict(exclude={"current_phase"}) | {
            "current_phase": self.current_phase.value
        }

    def __init__(self, session_id: int, **data: Any):
        super().__init__(session_id=session_id, **data)


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
