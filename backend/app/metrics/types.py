import hashlib
from datetime import datetime
from typing import Literal, final

from pydantic import BaseModel, Field, model_validator

from app.app_config import get_application_config
from app.conversations.reactions.types import ReactionKind, DislikeReason
from app.metrics.constants import EventType
from common_libs.time_utilities import get_now


class AbstractCompassMetricEvent(BaseModel):
    """
    Abstract base class for a metric event. It is not meant to be instantiated directly.
    """

    # using the __new__ method to prevent instantiation of the abstract class before the __init__ method is called
    # this is used in lieu of extending the ABC class since multiple inheritance is not working properly with ABCs
    # and allows instance creation
    def __new__(cls, *args, **kwargs):
        if cls is AbstractCompassMetricEvent:
            raise TypeError(f"{cls.__name__} is an abstract class and cannot be instantiated directly")
        return super().__new__(cls)

    environment_name: str = Field(default_factory=lambda: get_application_config().environment_name)
    """
    environment_name - the name of the environment the event was recorded in
    """

    version: str = Field(default_factory=lambda: get_application_config().version_info.to_version_string())
    """
    version - the version of the application the event was recorded in
    """

    event_type: EventType
    """
    event_type - the type of the metric event
    """

    timestamp: datetime = Field(default_factory=get_now)
    """
    timestamp - the timestamp of the event
    """

    class Config:
        extra = "forbid"


class AbstractUserAccountEvent(AbstractCompassMetricEvent):
    """
    Abstract base class for a metric event representing a user account event. It is not meant to be instantiated directly.
    """

    # using the __new__ method to prevent instantiation of the abstract class before the __init__ method is called
    # this is used in lieu of extending the ABC class since multiple inheritance is not working properly with ABCs
    # and allows instance creation
    def __new__(cls, *args, **kwargs):
        if cls is AbstractUserAccountEvent:
            raise TypeError(f"{cls.__name__} is an abstract class and cannot be instantiated directly")
        return super().__new__(cls)

    anonymized_user_id: str
    """
    anonymized_user_id - a hex representation of the md5 hash of the user_id for the user whose request triggered the event
    """

    # using a model_validator instead of an __init__ to obfuscate user_id without needing to pass extra fields to the parent constructor
    # because the __init__ method of the parent class would be called before the __init__ method of the child class
    # and the parent class doesnt know about the user_id field
    @model_validator(mode="before")
    def obfuscate_user_id(cls, values):
        if 'user_id' in values:
            values['anonymized_user_id'] = hashlib.md5(values['user_id'].encode(), usedforsecurity=False).hexdigest()
            del values['user_id']
        return values

    class Config:
        extra = "forbid"


@final
class UserAccountCreatedEvent(AbstractUserAccountEvent):
    """
    A metric event representing a user account creation.
    """

    def __init__(self, *, user_id: str):
        super().__init__(
            user_id=user_id,
            event_type=EventType.USER_ACCOUNT_CREATED,
        )

    class Config:
        extra = "forbid"


class AbstractConversationEvent(AbstractUserAccountEvent):
    """
    Abstract base class for a metric event representing a conversation event. It is not meant to be instantiated directly.
    """

    # using the __new__ method to prevent instantiation of the abstract class before the __init__ method is called
    # this is used in lieu of extending the ABC class since multiple inheritance is not working properly with ABCs
    # and allows instance creation
    def __new__(cls, *args, **kwargs):
        if cls is AbstractConversationEvent:
            raise TypeError(f"{cls.__name__} is an abstract class and cannot be instantiated directly")
        return super().__new__(cls)

    anonymized_session_id: str
    """
    anonymized_session_id - a hex representation of the md5 hash of the session_id for the session that triggered the event
    """

    # using a model_validator instead of an __init__ to obfuscate session_id without needing to pass extra fields to the parent constructor
    # because the __init__ method of the parent class would be called before the __init__ method of the child class
    # and the parent class doesnt know about the session_id field
    @model_validator(mode="before")
    def obfuscate_session_id(cls, values):
        if 'session_id' in values:
            values['anonymized_session_id'] = hashlib.md5(str(values['session_id']).encode(),
                                                          usedforsecurity=False).hexdigest()
            del values['session_id']
        return values

    class Config:
        extra = "forbid"


ConversationPhaseLiteral = Literal["INTRO", "COUNSELING", "CHECKOUT", "ENDED", "EXPERIENCE_EXPLORED"]


class ConversationPhaseEvent(AbstractConversationEvent):
    """
    A metric event representing a change in the phase of a conversation
    """
    phase: ConversationPhaseLiteral
    """
    phase - the phase of the conversation
    """

    def __init__(self, *, user_id: str, session_id: int, phase: ConversationPhaseLiteral):
        super().__init__(
            user_id=user_id,
            session_id=session_id,
            event_type=EventType.CONVERSATION_PHASE,
            phase=phase
        )

    class Config:
        extra = "forbid"


FeedbackTypeLiteral = Literal["NPS", "CSAT", "CES"]


class FeedbackProvidedEvent(AbstractConversationEvent):
    """
    A metric event representing the provision of feedback by a user
    """

    def __init__(self, *, user_id: str, session_id: int):
        super().__init__(
            user_id=user_id,
            session_id=session_id,
            event_type=EventType.FEEDBACK_PROVIDED,
        )

    class Config:
        extra = "forbid"


class FeedbackScoreEvent(AbstractConversationEvent):
    """
    A metric event representing the update of a feedback score
    """

    feedback_type: FeedbackTypeLiteral
    """
    feedback_type - the type of the feedback score
    """

    value: int
    """
    value - the value of the feedback used to calculate the score.
        - For NPS, the value is -1, 0, or 1  for Detractor, Passive, Promoter respectively. In a 1-5 scale 1,2,3 are detractors, 4 passive, 5 promoter.
        - For CSAT, the value is 0 or 1, with 1 being the of respondents who select the highest 2 options on a 1–5 satisfaction scale and 0 being the rest.
        - For CES, the value is 0 or 1, with 1 being the of respondents who select the highest 2 options on a 1–5 ease scale and 0 being the rest.
    """

    def __init__(self, *, user_id: str, session_id: int, feedback_type: FeedbackTypeLiteral, value: int):
        super().__init__(
            user_id=user_id,
            session_id=session_id,
            event_type=EventType.FEEDBACK_SCORE,
            feedback_type=feedback_type,
            value=value
        )

    class Config:
        extra = "forbid"


MessageCreatedEventSourceLiteral = Literal["USER", "COMPASS"]


class MessageCreatedEvent(AbstractConversationEvent):
    """
    A metric event representing the creation of a message in a conversation
    """
    message_source: MessageCreatedEventSourceLiteral

    def __init__(self, *, user_id: str, session_id: int, message_source: MessageCreatedEventSourceLiteral):
        super().__init__(
            user_id=user_id,
            session_id=session_id,
            event_type=EventType.MESSAGE_CREATED,
            message_source=message_source
        )

    class Config:
        extra = "forbid"


class MessageReactionCreatedEvent(AbstractConversationEvent):
    """
    A metric event representing the creation of a reaction to a message
    """

    message_id: str
    """
    message_id - the id of the message, required as newer events should overwrite previous reactions
    """

    kind: str
    """
    kind - the kind of the reaction
    """

    reasons: list[str]
    """
    reasons - the reasons for the reaction
    """

    def __init__(self, *, user_id: str, session_id: int, message_id: str, kind: ReactionKind,
                 reasons: list[DislikeReason]):
        super().__init__(
            user_id=user_id,
            session_id=session_id,
            event_type=EventType.MESSAGE_REACTION_CREATED,
            message_id=message_id,
            kind=kind.name,
            reasons=[reason.name for reason in reasons]
        )

    class Config:
        extra = "forbid"
