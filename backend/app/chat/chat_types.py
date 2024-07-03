from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, field_serializer
from enum import Enum


class ConversationMessageSender(Enum):
    USER = "USER"
    COMPASS = "COMPASS"


class ConversationMessage(BaseModel):
    message: str
    """The message content"""
    sent_at: datetime
    """The time the message was sent, in ISO format, in UTC"""
    sender: ConversationMessageSender
    """The sender of the message, either USER or COMPASS"""
    finished: Optional[bool] = None
    """Whether the conversation is finished after this message, only present for COMPASS messages"""
    @field_serializer('sent_at')
    def serialize_sent_at(self, value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat()
