from datetime import datetime
from typing import Literal
from app.conversations.reactions.types import ReactionKind, DislikeReason
from pydantic import BaseModel, field_validator
from app.metrics.constants import EventType


class CompassMetricEvent(BaseModel):
    """
    id - a unique identifier for the event, typically assigned by the db
    """
    id: str | None = None
    """
    environment_name - the name of the environment the event was recorded in
    """
    environment_name: str
    """
    version - the version of the application the event was recorded in
    """
    version: str
    """
    event_type - the type of the metric event
    """
    event_type: EventType
    """
    event_type_name - the name of the event type
    """
    event_type_name: str
    """
    timestamp - the timestamp of the event
    """
    timestamp: datetime
    """
    anonymized_user_id - a bson representation of the md5 hash of the user_id for the user whose request triggered the event
    """
    anonymized_user_id: str

    class Config:
        extra = "forbid"


class UserAccountCreatedEvent(CompassMetricEvent):
    """
    event_type - the type of the event
    """
    event_type: EventType

    @field_validator("event_type")
    def validate_event_type(cls, v):
        if v != EventType.USER_ACCOUNT_CREATED:
            raise ValueError("event_type must be EventType.USER_ACCOUNT_CREATED")
        return v

    class Config:
        extra = "forbid"


class CompassConversationEvent(CompassMetricEvent):
    """
    anonymized_session_id - a bson representation of the md5 hash of the session_id for the session that triggered the event
    """
    anonymized_session_id: str

    class Config:
        extra = "forbid"


# we can add more phases as we add more events fot intermediate phases
ConversationPhase = Literal["INTRO", "COUNSELING", "CHECKOUT", "ENDED"]


class ConversationPhaseEvent(CompassConversationEvent):
    """
    event_type - the type of the event
    """
    event_type: EventType

    @field_validator("event_type")
    def validate_event_type(cls, v):
        if v != EventType.CONVERSATION_PHASE:
            raise ValueError("event_type must be EventType.CONVERSATION_PHASE")
        return v
    """
    phase - the phase of the conversation
    """
    phase: ConversationPhase

    class Config:
        extra = "forbid"

class MessageCreatedEvent(CompassConversationEvent):
    """
    event_type - the type of the event
    """
    event_type: EventType

    @field_validator("event_type")
    def validate_event_type(cls, v):
        if v != EventType.MESSAGE_CREATED:
            raise ValueError("event_type must be EventType.MESSAGE_CREATED")
        return v
    """
    message_id - the id of the message
    """
    message_id: str

    class Config:
        extra = "forbid"

FeedbackType = Literal["NPS", "CSAT", "CES"]

class FeedbackScoreUpdatedEvent(CompassConversationEvent):
    """
    event_type - the type of the event
    """
    event_type: EventType

    @field_validator("event_type")
    def validate_event_type(cls, v):
        if v != EventType.FEEDBACK_SCORE_UPDATED:
            raise ValueError("event_type must be EventType.FEEDBACK_SCORE_UPDATED")
        return v
    """
    type - the type of the feedback
    """
    type: FeedbackType
    """
    value - the value of the feedback
    """
    value: int

    class Config:
        extra = "forbid"

class MessageReactionCreatedEvent(CompassConversationEvent):
    """
    event_type - the type of the event
    """
    event_type: EventType

    @field_validator("event_type")
    def validate_event_type(cls, v):
        if v != EventType.MESSAGE_REACTION_CREATED:
            raise ValueError("event_type must be EventType.MESSAGE_REACTION_CREATED")
        return v
    """
    message_id - the id of the message
    """
    message_id: str
    """
    kind - the kind of the reaction
    """
    kind: ReactionKind
    """
    reasons: a list of dislike reasons
    """
    reasons: list[DislikeReason]

    class Config:
        extra = "forbid"
