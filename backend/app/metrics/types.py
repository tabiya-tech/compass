from datetime import datetime, timezone
from typing import Literal, final

from pydantic import BaseModel, Field, model_validator

from .common import hash_metric_value
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

    user_id: str | None = None
    """
    user_id - the actual user_id of the user, kept for use downstream and should be deleted before saving
    """
    anonymized_user_id: str
    """
    anonymized_user_id - a hex representation of the md5 hash of the user_id for the user whose request triggered the event
    """
    relevant_experiments: dict[str, str] = Field(default_factory=dict)
    """
    relevant_experiments - a dictionary mapping experiment IDs to their corresponding groups,
    will be empty for frontend events until the service populates the field with values from user preferences
    """

    anonymized_client_id: str | None = None
    """
    The anonymized client ID (device ID) of the user, used for tracking purposes.
    """

    # using a model_validator instead of an __init__ to obfuscate user_id without needing to pass extra fields to the parent constructor
    # because the __init__ method of the parent class would be called before the __init__ method of the child class
    # and the parent class doesn't know about the user_id field
    @model_validator(mode="before")
    def validator(cls, values):
        if 'user_id' in values:
            values['anonymized_user_id'] = hash_metric_value(values['user_id'])
        if 'relevant_experiments' in values and values['relevant_experiments'] is None:
            values['relevant_experiments'] = {}

        # anonymize client_id if it exists, otherwise set it to None.
        if 'client_id' in values:
            if values['client_id'] is not None:
                values['anonymized_client_id'] = hash_metric_value(values['client_id'])
            else:
                values['anonymized_client_id'] = None

            del values['client_id'] # remove the client_id field as it is not needed in the event

        return values

    class Config:
        extra = "forbid"


@final
class UserAccountCreatedEvent(AbstractUserAccountEvent):
    """
    A metric event representing a user account creation.
    """
    def __init__(self, *, user_id: str, client_id: str | None = None, relevant_experiments: dict[str, str] = None):
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            event_type=EventType.USER_ACCOUNT_CREATED,
            relevant_experiments=relevant_experiments or {}
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

    session_id: int
    """
    session_id - the actual session_id of the session, kept for use downstream and should be deleted before saving
    """
    anonymized_session_id: str
    """
    anonymized_session_id - a hex representation of the md5 hash of the session_id for the session that triggered the event
    """

    # using a model_validator instead of an __init__ to obfuscate session_id without needing to pass extra fields to the parent constructor
    # because the __init__ method of the parent class would be called before the __init__ method of the child class
    # and the parent class doesn't know about the session_id field
    @model_validator(mode="before")
    def obfuscate_session_id(cls, values):
        if 'session_id' in values:
            values['anonymized_session_id'] = hash_metric_value(str(values['session_id']))
        return values

    class Config:
        extra = "forbid"


# INTRO: The agent director is in the intro phase.
# COUNSELING: The agent director is in the counseling phase.
# CHECKOUT: The agent director is in the checkout phase.
# ENDED: The agent director has ended the conversation.
# COLLECT_EXPERIENCES: The user is being prompted to collect experiences.
# DIVE_IN: The user has entered the exploration phase for an experience.
# EXPERIENCE_EXPLORED: An experience has entered the PROCESSED phase and has top skills.
ConversationPhaseLiteral = Literal[
    "INTRO", "COUNSELING", "CHECKOUT", "ENDED", "COLLECT_EXPERIENCES", "DIVE_IN", "UNKNOWN"]


class ConversationPhaseEvent(AbstractConversationEvent):
    """
    A metric event representing a change in the phase of a conversation
    """
    phase: ConversationPhaseLiteral
    """
    phase - the phase of the conversation
    """

    def __init__(self, *, user_id: str, session_id: int, phase: ConversationPhaseLiteral, client_id: str | None = None, relevant_experiments: dict[str, str] = None):
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            session_id=session_id,
            event_type=EventType.CONVERSATION_PHASE,
            phase=phase,
            relevant_experiments=relevant_experiments or {}
        )

    class Config:
        extra = "forbid"


class ExperienceDiscoveredEvent(AbstractConversationEvent):
    """
    A metric event representing the number of experiences discovered by a user
    """
    experience_count: int
    """
    experience_count - the number of experiences discovered by a user
    """
    experiences_by_work_type: dict[str, int]
    """
    experiences_by_work_type - a dictionary mapping {work types : the number of experiences discovered for each type }
    """

    def __init__(self, *, user_id: str, session_id: int, experience_count: int, experiences_by_work_type: dict[str, int], client_id: str | None = None, relevant_experiments: dict[str, str] = None, timestamp: str | None = None):
        # construct a dict with a timestamp field only if the timestamp is provided
        # we do this to avoid having to pass None to the super constructor
        timestamp_argument = dict(timestamp=datetime.fromisoformat(timestamp).astimezone(timezone.utc)) if timestamp else {}
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            session_id=session_id,
            event_type=EventType.EXPERIENCE_DISCOVERED,
            experience_count=experience_count,
            experiences_by_work_type=experiences_by_work_type,
            relevant_experiments=relevant_experiments or {},
            **timestamp_argument
        )

    class Config:
        extra = "forbid"


class ExperienceExploredEvent(AbstractConversationEvent):
    """
    A metric event representing the number of experiences explored by a user
    """
    experience_count: int
    """
    experience_count - the number of experiences explored by a user
    """

    experiences_by_work_type: dict[str, int]
    """
    experiences_by_work_type - a dictionary mapping {work types : the number of experiences explored for each type }
    """

    def __init__(self,
                 *,
                 user_id: str,
                 session_id: int,
                 experience_count: int,
                 experiences_by_work_type: dict[str, int],
                 client_id: str | None = None,
                 relevant_experiments: dict[str, str] = None):
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            session_id=session_id,
            event_type=EventType.EXPERIENCE_EXPLORED,
            experience_count=experience_count,
            experiences_by_work_type=experiences_by_work_type,
            relevant_experiments=relevant_experiments or {},
        )

    class Config:
        extra = "forbid"


FeedbackTypeLiteral = Literal["NPS", "CSAT", "CES"]


class FeedbackProvidedEvent(AbstractConversationEvent):
    """
    A metric event representing the provision of feedback by a user
    """

    def __init__(self, *, user_id: str, session_id: int, client_id: str | None = None, relevant_experiments: dict[str, str] = None):
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            session_id=session_id,
            event_type=EventType.FEEDBACK_PROVIDED,
            relevant_experiments=relevant_experiments or {}
        )

    class Config:
        extra = "forbid"


class FeedbackRatingValueEvent(AbstractConversationEvent):
    """
    A metric event representing the update of a feedback rating value
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

    def __init__(self, *, user_id: str, session_id: int, feedback_type: FeedbackTypeLiteral, value: int, client_id: str | None = None, relevant_experiments: dict[str, str] = None):
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            session_id=session_id,
            event_type=EventType.FEEDBACK_RATING_VALUE,
            feedback_type=feedback_type,
            value=value,
            relevant_experiments=relevant_experiments or {}
        )

    class Config:
        extra = "forbid"


class ConversationTurnEvent(AbstractConversationEvent):
    """
    A metric event representing the counts of user and compass turns in a conversation
    """
    compass_message_count: int
    user_message_count: int

    def __init__(self, *, user_id: str, session_id: int, compass_message_count: int, user_message_count: int, client_id: str | None = None, relevant_experiments: dict[str, str] = None):
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            session_id=session_id,
            event_type=EventType.CONVERSATION_TURN,
            compass_message_count=compass_message_count,
            user_message_count=user_message_count,
            relevant_experiments=relevant_experiments or {}
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
                 reasons: list[DislikeReason], client_id: str | None = None, relevant_experiments: dict[str, str] = None):
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            session_id=session_id,
            event_type=EventType.MESSAGE_REACTION_CREATED,
            message_id=message_id,
            kind=kind.name,
            reasons=[reason.name for reason in reasons],
            relevant_experiments=relevant_experiments or {}
        )

    class Config:
        extra = "forbid"


"""
------- Frontend only metrics -------
"""

CVFormatLiteral = Literal["PDF", "DOCX"]


class CVDownloadedEvent(AbstractConversationEvent):
    """
    A Frontend only metric event representing the download of a CV
    """
    cv_format: CVFormatLiteral
    """
    format - the format of the CV
    """

    def __init__(self, *, user_id: str, session_id: int, cv_format: CVFormatLiteral, timestamp: str, client_id: str | None = None, relevant_experiments: dict[str, str] = None):
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            session_id=session_id,
            event_type=EventType.CV_DOWNLOADED,
            cv_format=cv_format,
            timestamp=datetime.fromisoformat(timestamp).astimezone(timezone.utc),
            relevant_experiments=relevant_experiments or {}
        )

    class Config:
        extra = "forbid"


class DemographicsEvent(AbstractUserAccountEvent):
    """
    A Frontend only metric event representing the demographics of a user
    """
    age: str
    """
    age - the age of the user
    """
    gender: str
    """
    gender - the gender of the user
    """
    education: str
    """
    education - the education of the user
    """
    employment_status: str
    """
    employment_status - the employment status of the user
    """

    def __init__(self, *, user_id: str, age: int, gender: str, education: str, employment_status: str, client_id: str | None = None, relevant_experiments: dict[str, str] = None):
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            event_type=EventType.DEMOGRAPHICS,
            age=age,
            gender=gender,
            education=education,
            employment_status=employment_status,
            relevant_experiments=relevant_experiments or {}
        )

    class Config:
        extra = "forbid"


class UserLocationEvent(AbstractUserAccountEvent):
    """
    A Frontend only metric event representing the location of a user
    """
    coordinates: tuple[float, float]
    """
    coordinates - the coordinates of the user
    """

    def __init__(self, *, user_id: str, coordinates: tuple[float, float], timestamp: str, client_id: str | None = None, relevant_experiments: dict[str, str] = None):
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            event_type=EventType.USER_LOCATION,
            coordinates=coordinates,
            timestamp=datetime.fromisoformat(timestamp).astimezone(timezone.utc),
            relevant_experiments=relevant_experiments or {}
        )

    class Config:
        extra = "forbid"


class DeviceSpecificationEvent(AbstractUserAccountEvent):
    """
    A Frontend only metric event representing the device specification of a user
    """
    device_type: str
    """
    device_type - the type of device the user is using, laptop, desktop, tablet, mobile...
    """
    os_type: str
    """
    os _type- the operating system of the device the user is using
    """
    browser_type: str
    """
    browser_type - the browser the user is using
    """
    browser_version: str
    """
    browser_version - the version of the browser the user is using
    """
    user_agent: str
    """
    str - the user agent of the browser the user is using
    """

    def __init__(self, *, user_id: str, device_type: str, os_type: str, browser_type: str, timestamp: str,
                 browser_version: str, user_agent: str, client_id: str | None = None, relevant_experiments: dict[str, str] = None):
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            event_type=EventType.DEVICE_SPECIFICATION,
            device_type=device_type,
            os_type=os_type,
            browser_type=browser_type,
            browser_version=browser_version,
            user_agent=user_agent,
            timestamp=datetime.fromisoformat(timestamp).astimezone(timezone.utc),
            relevant_experiments=relevant_experiments or {}
        )

    class Config:
        extra = "forbid"


class UIInteractionEvent(AbstractUserAccountEvent):
    """
    A Frontend only metric event representing UI interactions by a user
    """
    element_id: str
    """
    element_id: a unique id for the element the interaction was performed on
    """
    actions: list[str]
    """
    action: any arbitrary actions on an element. Could be ["clicked", "seen"] or ["seen_twice"] or ["swiped"]
    """

    def __init__(self, *, user_id: str, element_id: str, actions: list[str], timestamp: str, client_id: str | None = None, relevant_experiments: dict[str, str] = None):
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            event_type=EventType.UI_INTERACTION,
            element_id=element_id,
            actions=actions,
            timestamp=datetime.fromisoformat(timestamp).astimezone(timezone.utc),
            relevant_experiments=relevant_experiments or {}
        )

    class Config:
        extra = "forbid"


class NetworkInformationEvent(AbstractUserAccountEvent):
    """
    A Frontend only metric event representing the network information of a user
    """
    effective_connection_type: str
    """
    effective_connection_type - the network classification of the user's connection: 2g, 3g, 4g, 5g...
    """

    def __init__(self, *, user_id: str, effective_connection_type: str, client_id: str | None = None,  relevant_experiments: dict[str, str] = None):
        super().__init__(
            user_id=user_id,
            client_id=client_id,
            event_type=EventType.NETWORK_INFORMATION,
            effective_connection_type=effective_connection_type,
            relevant_experiments=relevant_experiments or {}
        )

    class Config:
        extra = "forbid"
