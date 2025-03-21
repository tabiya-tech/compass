import hashlib
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, root_validator, field_serializer, model_validator

from app.app_config import get_application_config
from app.conversations.reactions.types import ReactionKind, DislikeReason
from app.metrics.constants import EventType
from common_libs.time_utilities._time_utils import get_now


class CompassMetricEvent(BaseModel):
    """
    environment_name - the name of the environment the event was recorded in
    """
    environment_name: str = Field(default_factory=lambda: get_application_config().environment_name)
    """
    version - the version of the application the event was recorded in
    """
    version: str = Field(default_factory=lambda: get_application_config().version_info.to_version_string())
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

    @field_serializer('event_type')
    def serialize_event_type(self, event_type: EventType) -> int:
        return event_type.value

    class Config:
        extra = "forbid"


class CompassUserAccountEvent(CompassMetricEvent):
    """
    anonymized_user_id - a bson representation of the md5 hash of the user_id for the user whose request triggered the event
    """
    anonymized_user_id: str

    # a model validator that obfuscates the "user_id" field passed by any children and replaces it with the field "anonymized_user_id"
    # the "anonymized_user_id" field is a hash of the "user_id" field
    @model_validator(mode="before")
    def obfuscate_user_id(cls, values):
        if 'user_id' in values:
            values['anonymized_user_id'] = hashlib.md5(values['user_id'].encode(), usedforsecurity=False).hexdigest()
            del values['user_id']
        return values

    class Config:
        extra = "forbid"


class UserAccountCreatedEvent(CompassUserAccountEvent):
    """
    A metric event representing a user account creation.
    """
    def __init__(self, *, user_id: str):
        super().__init__(
            user_id=user_id,
            event_type=EventType.USER_ACCOUNT_CREATED,
            event_type_name=EventType.USER_ACCOUNT_CREATED.name,
        )

    class Config:
        extra = "forbid"


class CompassConversationEvent(CompassUserAccountEvent):
    """
    anonymized_session_id - a bson representation of the md5 hash of the session_id for the session that triggered the event
    """
    anonymized_session_id: str

    # a model validator that obfuscates the "session_id" field passed by any children and replaces it with the field "anonymized_session_id"
    # the "anonymized_session_id" field is a hash of the stringified version of the "session_id" field
    @model_validator(mode="before")
    def obfuscate_session_id(cls, values):
        if 'session_id' in values:
            values['anonymized_session_id'] = hashlib.md5(str(values['session_id']).encode(), usedforsecurity=False).hexdigest()
            del values['session_id']
        return values

    class Config:
        extra = "forbid"


ConversationPhaseLiteral = Literal["INTRO", "COUNSELING", "CHECKOUT", "ENDED"]


class ConversationPhaseEvent(CompassConversationEvent):
    """
    phase - the phase of the conversation
    """
    phase: ConversationPhaseLiteral

    def __init__(self, *, user_id: str, session_id: int, phase: ConversationPhaseLiteral):
        super().__init__(
            user_id=user_id,
            session_id=session_id,
            event_type=EventType.CONVERSATION_PHASE,
            event_type_name=EventType.CONVERSATION_PHASE.name,
            phase=phase
        )

    class Config:
        extra = "forbid"


class MessageCreatedEvent(CompassConversationEvent):
    """
    message_id - the id of the message
    """
    message_id: str

    def __init__(self, *, user_id: str, session_id: int, message_id: str):
        super().__init__(
            user_id=user_id,
            session_id=session_id,
            event_type=EventType.MESSAGE_CREATED,
            event_type_name=EventType.MESSAGE_CREATED.name,
            message_id=message_id
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

    def __init__(self, *, user_id: str, session_id: int, type: FeedbackType, value: int):
        super().__init__(
            user_id=user_id,
            session_id=session_id,
            event_type=EventType.FEEDBACK_SCORE_UPDATED,
            event_type_name=EventType.FEEDBACK_SCORE_UPDATED.name,
            type=type,
            value=value
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

    def __init__(self, *, user_id: str, session_id: int, message_id: str, kind: ReactionKind, reasons: list[DislikeReason]):
        super().__init__(
            user_id=user_id,
            session_id=session_id,
            event_type=EventType.MESSAGE_REACTION_CREATED,
            event_type_name=EventType.MESSAGE_REACTION_CREATED.name,
            message_id=message_id,
            kind=kind,
            reasons=reasons
        )

    class Config:
        extra = "forbid"
