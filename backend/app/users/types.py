from typing import Optional, Mapping

from pydantic import BaseModel, Field
from datetime import datetime


class UpdateUserLanguageRequest(BaseModel):
    user_id: str
    language: str

    class Config:
        extra = "forbid"


class UserPreferencesRepositoryUpdateRequest(BaseModel):
    language: Optional[str] = None
    """
    Language - The language of the user
    """

    accepted_tc: Optional[datetime] = None
    """
    time - The time the user accepted the terms and conditions
    """

    sessions: Optional[list[int]] = None  # not required
    """
    sessions - The sessions of the user
    """

    invitation_code: Optional[str] = None
    """
    invitation_code - The invitation code of the user
    """

    class Config:
        extra = "forbid"


class UserPreferencesUpdateRequest(BaseModel):
    user_id: str
    """
    User ID - The user ID to update
    """

    language: Optional[str] = None
    """
    Language - The language of the user
    """

    accepted_tc: Optional[datetime] = None
    """
    time - The time the user accepted the terms and conditions
    """

    class Config:
        extra = "forbid"


class UserPreferences(BaseModel):
    language: Optional[str] = None
    invitation_code: Optional[str] = None
    accepted_tc: Optional[datetime] = None
    sessions: list[int] = Field(default_factory=list)  # not required

    @staticmethod
    def from_document(doc: Mapping[str, any]) -> "UserPreferences":
        return UserPreferences(
            language=doc.get("language"),
            accepted_tc=doc.get("accepted_tc"),
            invitation_code=doc.get("invitation_code"),
            sessions=doc.get("sessions"),
        )

    class Config:
        extra = "forbid"


class CreateUserPreferencesRequest(BaseModel):
    user_id: str
    """
    User ID
    """
    language: str
    """
    The language of the user
    """
    invitation_code: str
    """
    Invitation code
    """

    class Config:
        extra = "forbid"


class CreateUserPreferenceResponse(BaseModel):
    user_preference_id: str
    user_preferences: UserPreferences

    class Config:
        extra = "forbid"


class UpdateUserPreferencesRequest(BaseModel):
    user_id: str
    """
    User ID
    """

    language: Optional[str] = None
    """
    The language of the user
    """

    accepted_tc: Optional[datetime] = None
    """
    Accepted terms and conditions date
    """

    class Config:
        extra = "forbid"
