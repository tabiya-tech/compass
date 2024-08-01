from enum import Enum
from typing import Optional

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
    code: Optional[str] = None
    """
    Invitation code
    Optional since in the case of a normal email/password registration, the code is not required
    """

    user_id: str
    """
    User ID
    """
    language: str
    """
    The language of the user
    """
    accepted_tc: datetime
    """
    The date and time the terms and conditions were accepted
    """
    sessions: list[int] = []
    """
    List of session ids
    """

    class Config:
        extra = "forbid"


class CreateUserPreferenceResponse(BaseModel):
    user_preference_id: str
    user_preferences: UserPreferences

    class Config:
        extra = "forbid"
