from datetime import datetime
from typing import Literal
from app.conversations.reactions.types import ReactionKind, DislikeReason
from pydantic import BaseModel, Field, field_serializer
from app.metrics.constants import EventType
from app.app_config import get_application_config
from common_libs.time_utilities._time_utils import get_now
import hashlib

class CompassMetricEvent(BaseModel):
    """
    environment_name - the name of the environment the event was recorded in
    """
    environment_name: str = Field(default_factory=lambda: get_application_config().environment_name)
    """
    version - the version of the application the event was recorded in
    """
    version: str = Field(default_factory=lambda:get_application_config().version_info.to_version_string())
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
    timestamp: datetime = Field(default_factory=get_now)
    """
    anonymized_user_id - a bson representation of the md5 hash of the user_id for the user whose request triggered the event
    """
    anonymized_user_id: str

    @field_serializer('event_type')
    def serialize_event_type(self, event_type: EventType) -> int:
        return event_type.value

    class Config:
        extra = "forbid"


class UserAccountCreatedEvent(CompassMetricEvent):
    """
    A metric event representing a user account creation.
    """

    def __init__(self, *,
                 user_id: str):
        # obfuscate the user_id using md5, and store it as anonymized_user_id
        # usedForSecurity is set to False to avoid linting error, since we do not need a cryptographically secure hash
        anonymized_user_id = hashlib.md5(user_id.encode(), usedforsecurity=False).hexdigest()
        super().__init__(
            event_type=EventType.USER_ACCOUNT_CREATED,
            event_type_name = EventType.USER_ACCOUNT_CREATED.name,
            anonymized_user_id=anonymized_user_id
        )

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
    phase - the phase of the conversation
    """
    phase: ConversationPhase

    def __init__(self, *,
                 anonymized_user_id: str,
                 phase: ConversationPhase,
                 anonymized_session_id: str):
        super().__init__(
            event_type=EventType.CONVERSATION_PHASE,
            event_type_name = EventType.CONVERSATION_PHASE.name,
            anonymized_user_id=anonymized_user_id,
            phase=phase,
            anonymized_session_id=anonymized_session_id
        )
    class Config:
        extra = "forbid"

class MessageCreatedEvent(CompassConversationEvent):
    """
    message_id - the id of the message
    """
    message_id: str

    def __init__(self, *,
                 anonymized_user_id: str,
                 message_id: str,
                 anonymized_session_id: str):
        super().__init__(
            event_type=EventType.MESSAGE_CREATED,
            event_type_name = EventType.MESSAGE_CREATED.name,
            anonymized_user_id=anonymized_user_id,
            message_id=message_id,
            anonymized_session_id=anonymized_session_id
        )

    class Config:
        extra = "forbid"

FeedbackType = Literal["NPS", "CSAT", "CES"]

class FeedbackScoreUpdatedEvent(CompassConversationEvent):
    """
    type - the type of the feedback score
    """
    type: FeedbackType
    """
    value - the value of the feedback score
    """
    value: int

    def __init__(self, *,
                 anonymized_user_id: str,
                 type: FeedbackType,
                 value: int,
                 anonymized_session_id: str):
        super().__init__(
            event_type=EventType.FEEDBACK_SCORE_UPDATED,
            event_type_name = EventType.FEEDBACK_SCORE_UPDATED.name,
            anonymized_user_id=anonymized_user_id,
            type=type,
            value=value,
            anonymized_session_id=anonymized_session_id
        )

    class Config:
        extra = "forbid"

class MessageReactionCreatedEvent(CompassConversationEvent):
    """
    message_id - the id of the message
    """
    message_id: str
    """
    kind - the kind of the reaction
    """
    kind: ReactionKind
    """
    reasons - the reasons for the reaction
    """
    reasons: list[DislikeReason]

    def __init__(self, *,
                 anonymized_user_id: str,
                 message_id: str,
                 kind: ReactionKind,
                 reasons: list[DislikeReason],
                 anonymized_session_id: str):
        super().__init__(
            event_type=EventType.MESSAGE_REACTION_CREATED,
            event_type_name = EventType.MESSAGE_REACTION_CREATED.name,
            anonymized_user_id=anonymized_user_id,
            message_id=message_id,
            kind=kind,
            reasons=reasons,
            anonymized_session_id=anonymized_session_id
        )

    class Config:
        extra = "forbid"

