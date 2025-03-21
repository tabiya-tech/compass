from enum import Enum

class EventType(Enum):
    # as a convention, all events created on the backend should start with 10000
    # to avoid conflicts with frontend events as this enum needs to be redefined in the frontend
    USER_ACCOUNT_CREATED = 100001
    CONVERSATION_PHASE = 100002
    PROVIDED_FEEDBACK = 100003
    FEEDBACK_SCORE_UPDATED = 100004
    MESSAGE_CREATED = 100005
    MESSAGE_REACTION_CREATED = 100006

