from datetime import datetime, timezone

from pydantic import BaseModel, field_serializer, field_validator, Field
from enum import Enum

from app.conversations.reactions.types import ReactionKind, Reaction


class MessageReaction(BaseModel):
    """
    Response model for reactions in ConversationMessage. Only exposes id and kind.
    """
    id: str
    kind: ReactionKind = Field(
        description=f"Must be one of: {', '.join(ReactionKind.__members__.keys())}"
    )

    @classmethod
    def from_reaction(cls, reaction: Reaction) -> 'MessageReaction':
        """
        Convert business model to response model.

        :param reaction: Reaction business model
        :return: MessageReaction response model
        """
        if not reaction.id:
            raise ValueError("Cannot convert Reaction without an id to MessageReaction")
        return cls(
            id=reaction.id,
            kind=reaction.kind
        )

    class Config:
        extra = "forbid"


class ConversationMessageSender(int, Enum):
    USER = 0
    COMPASS = 1


# TODO: The UserConversationMessage and CompassConversationmessage types have diverged
# add a type for each
class ConversationMessage(BaseModel):
    """
    Represents a message in a conversation.
    """
    message_id: str
    """The unique id of the message"""
    message: str
    """The message content"""
    sent_at: datetime
    """The time the message was sent, in ISO format, in UTC"""
    sender: ConversationMessageSender
    """The sender of the message, either USER or COMPASS"""
    reaction: MessageReaction | None = None
    """Optional reaction to the message"""

    @field_serializer('sent_at')
    def serialize_sent_at(self, value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat()

    @field_serializer("sender")
    def serialize_sender(self, sender: ConversationMessageSender, _info) -> str:
        return sender.name

    @field_validator("sender", mode='before')
    def deserialize_sender(cls, value: str | ConversationMessageSender) -> ConversationMessageSender:
        if isinstance(value, str):
            return ConversationMessageSender[value]
        elif isinstance(value, ConversationMessageSender):
            return value
        else:
            raise ValueError(f"Invalid conversation sender: {value}")

    class Config:
        extra = "forbid"


# The current phase of the conversation.
# There should be a contract between this enum with the frontend.
# Refer to the file frontend-new/src/chat/chatProgressbar/types.ts#ConversationPhase.
# And the user-friendly message is located in the frontend on this module.
# If you are adding a new phase, please add it to the frontend as well.
class CurrentConversationPhaseResponse(Enum):
    INTRO = "INTRO"
    COLLECT_EXPERIENCES = "COLLECT_EXPERIENCES"
    DIVE_IN = "DIVE_IN"
    ENDED = "ENDED"

    # An unknown phase, used for error handling and fallbacks.
    UNKNOWN = "UNKNOWN"


class ConversationPhaseResponse(BaseModel):
    percentage: float
    """The percentage of the conversation completed, from 0 to 100"""

    phase: CurrentConversationPhaseResponse
    """The current phase of the conversation. Used for getting a user-friendly message in the frontend"""

    current: int | None = None
    """
    The current entity (work type/experience) in the conversation.
    """

    total: int | None = None
    """
    Total number of entities (work types/experiences) in the conversation.
    """

    class Config:
        extra = "forbid"
        use_enum_values = True


class ConversationResponse(BaseModel):
    messages: list[ConversationMessage]
    """The messages in the conversation"""
    conversation_completed: bool = False
    """Whether the conversation is finished"""
    conversation_conducted_at: datetime | None = None
    """The time the conversation was conducted"""
    experiences_explored: int = 0
    """The number of experiences explored"""
    current_phase: ConversationPhaseResponse
    """The current phase of the conversation"""

    @field_serializer('conversation_conducted_at')
    def serialize_conversation_conducted_at(self, value: datetime | None) -> str | None:
        return value.astimezone(timezone.utc).isoformat() if value else None

    class Config:
        extra = "forbid"


class ConversationInput(BaseModel):
    user_input: str
    """The user input"""

    class Config:
        extra = "forbid"


