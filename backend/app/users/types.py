from pydantic import BaseModel
from datetime import datetime


class UpdateUserLanguageRequest(BaseModel):
    user_id: str
    language: str

    class Config:
        extra = "forbid"


class UserPreferencesUpdateRequest(BaseModel):
    language: str = None
    accepted_tc: datetime = None
    sessions: list[int] = None  # not required

    class Config:
        extra = "forbid"


class UserPreferences(BaseModel):
    language: str
    accepted_tc: datetime
    sessions: list[int] = []  # not required

    class Config:
        extra = "forbid"


class CreateUserPreferencesRequest(BaseModel):
    user_id: str
    language: str
    accepted_tc: datetime
    sessions: list[int] = []

    class Config:
        extra = "forbid"


class CreateUserPreferenceResponse(BaseModel):
    user_preference_id: str
    user_preferences: UserPreferences

    class Config:
        extra = "forbid"
