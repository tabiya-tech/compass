from datetime import datetime, timezone
from pydantic import BaseModel, field_serializer, field_validator
from enum import Enum
from app.conversations.reactions.types import MessageReaction


class ConversationMessageSender(int, Enum):
    USER = 0
    COMPASS = 1


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


class ConversationResponse(BaseModel):
    messages: list[ConversationMessage]
    """The messages in the conversation"""
    conversation_completed: bool = False
    """Whether the conversation is finished"""
    conversation_conducted_at: datetime | None = None
    """The time the conversation was conducted"""
    experiences_explored: int = 0
    """The number of experiences explored"""

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
