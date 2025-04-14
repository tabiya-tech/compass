from dataclasses import field
from datetime import datetime
from typing import Optional, Mapping

from pydantic import BaseModel, Field

from app.conversations.feedback.services.types import AnsweredQuestions
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement


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
    sensitive_personal_data_requirement: SensitivePersonalDataRequirement

    @staticmethod
    def from_document(doc: Mapping[str, any]) -> "UserPreferences":
        """
        Create a new UserPreferences object from a dictionary

        :param doc: python dictionary: The dictionary to create the UserPreferences object from
        :return:  UserPreferences: The created UserPreferences object
        """

        return UserPreferences(
            language=doc.get("language"),
            accepted_tc=doc.get("accepted_tc"),
            invitation_code=doc.get("invitation_code"),
            sessions=doc.get("sessions"),
            sensitive_personal_data_requirement=doc.get(
                "sensitive_personal_data_requirement",
                SensitivePersonalDataRequirement.NOT_AVAILABLE
            ),
        )

    class Config:
        extra = "forbid"
        use_enum_values = True


class UsersPreferencesResponse(UserPreferences):
    """
    Represents the response payload for the user preferences REST API
    """

    user_feedback_answered_questions: AnsweredQuestions = field(default={})
    """
    The feedback questions answered by the user in every session
    """

    has_sensitive_personal_data: bool
    """
    Weathers the user has sensitive personal data
    """

    class Config:
        """
        Pydantic configuration
        """

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
