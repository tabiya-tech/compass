from datetime import datetime, timezone
from pydantic import BaseModel, field_serializer
from enum import Enum
from typing import Optional
from app.conversations.reactions.types import ReactionKind


class ConversationMessageSender(Enum):
    USER = "USER"
    COMPASS = "COMPASS"


class MessageReaction(BaseModel):
    """
    Represents a reaction in a message response.
    """
    id: str
    kind: ReactionKind


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
    reaction: Optional[MessageReaction] = None
    """Optional reaction to the message"""

    @field_serializer('sent_at')
    def serialize_sent_at(self, value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat()

    class Config:
        extra = "forbid"


class ConversationResponse(BaseModel):
    messages: list[ConversationMessage]
    """The messages in the conversation"""
    conversation_completed: bool = False
    """Whether the conversation is finished"""
    conversation_conducted_at: Optional[datetime] = None
    """The time the conversation was conducted"""
    experiences_explored: int = 0
    """The number of experiences explored"""

    @field_serializer('conversation_conducted_at')
    def serialize_conversation_conducted_at(self, value: Optional[datetime]) -> Optional[str]:
        return value.astimezone(timezone.utc).isoformat() if value else None

    class Config:
        extra = "forbid"


class ConversationInput(BaseModel):
    user_input: str
    """The user input"""

    class Config:
        extra = "forbid"