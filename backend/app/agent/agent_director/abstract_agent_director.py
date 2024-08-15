import logging
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Optional, Mapping
from datetime import datetime, timezone

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
        json_encoders = {
            # ensure datetime values are serialized as a ISODate object
            datetime: lambda dt: dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)
        }

    def __setattr__(self, key, value):
        if key == "conversation_completed_at":
            value = _parse_data(value)
        super().__setattr__(key, value)

    # use a field serializer to serialize the current_phase
    # we use the name of the Enum instead of the value because that makes the code less brittle
    @field_serializer("current_phase")
    def serialize_current_phase(self, current_phase: ConversationPhase, _info):
        return current_phase.name

    # Deserialize the current_phase from the enum name
    @field_validator("current_phase", mode='before')
    def deserialize_current_phase(cls, value: str | ConversationPhase) -> ConversationPhase:
        if isinstance(value, str):
            return ConversationPhase[value]
        return value

    # Deserialize the conversation_completed_at datetime and ensure it's interpreted as UTC
    @field_validator("conversation_completed_at", mode='before')
    def deserialize_conversation_completed_at(cls, value: Optional[datetime]) -> Optional[datetime]:
        return _parse_data(value)

    @staticmethod
    def from_document(_doc: Mapping[str, Any]) -> "AgentDirectorState":
        return AgentDirectorState(session_id=_doc["session_id"],
                                  current_phase=_doc["current_phase"],
                                  conversation_completed_at=_doc["conversation_completed_at"])


def _parse_data(value: Optional[datetime | str]) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            # Convert string to datetime
            value = datetime.fromisoformat(value)
        except ValueError:
            raise ValueError(f"Invalid datetime string: {value}")

    # Always assume UTC timezone even for naive datetimes. This is important because MongoDB stores implicitly datetimes as UTC
    # but returns them as naive datetimes.
    # Convert to UTC and truncate microseconds to milliseconds as MongoDB does not support microseconds

    return value.replace(tzinfo=timezone.utc).replace(microsecond=(value.microsecond // 1000 * 1000))


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
