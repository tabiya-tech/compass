from enum import Enum


class EventType(Enum):
    # As a convention, all events created on the backend should start with 10000
    # to avoid conflicts with frontend events, since this enum must also be defined in the frontend.
    USER_ACCOUNT_CREATED = 100001
    CONVERSATION_PHASE = 100002
    FEEDBACK_PROVIDED = 100003
    FEEDBACK_SCORE = 100004
    MESSAGE_CREATED = 100005
    MESSAGE_REACTION_CREATED = 100006
