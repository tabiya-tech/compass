from enum import Enum


class EventType(Enum):
    # As a convention, all events created on the backend should start with 10000
    # to avoid conflicts with frontend events, since this enum must also be defined in the frontend.
    USER_ACCOUNT_CREATED = 100001
    CONVERSATION_PHASE = 100002
    FEEDBACK_PROVIDED = 100003
    FEEDBACK_RATING_VALUE = 100004
    CONVERSATION_TURN = 100005
    MESSAGE_REACTION_CREATED = 100006

    # Frontend events
    # As a convention, all events created on the frontend should start with 20000
    CV_DOWNLOADED = 200001
    DEMOGRAPHICS = 200002
    USER_LOCATION = 200003
    DEVICE_SPECIFICATION = 200004
    NETWORK_INFORMATION = 200005
