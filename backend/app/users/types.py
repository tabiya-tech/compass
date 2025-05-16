from dataclasses import field
from datetime import datetime
from typing import Mapping, Any, TypeAlias

from pydantic import BaseModel, Field

from app.conversations.feedback.services.types import AnsweredQuestions
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement

PossibleExperimentValues: TypeAlias = str | bool | int | float | None
"""
An experiment can either be a group of PossibleExperimentValues namespaced by a single string (max depth: 1)
eg: {
"feature_foo_experiments": {
        "experiment_1": "foo",
        "experiment_2": False,
        "experiment_3": 1
    }
}

or an experiment can be a flat dictionary of PossibleExperimentValues
{
"experiment": "foo"
}

"""
Experiments: TypeAlias = dict[str, dict[str, PossibleExperimentValues] | PossibleExperimentValues]
UserExperiments: TypeAlias = dict[str, Experiments]


class UpdateUserLanguageRequest(BaseModel):
    user_id: str
    language: str

    class Config:
        extra = "forbid"


class UserPreferencesRepositoryUpdateRequest(BaseModel):
    language: str | None = None
    """
    Language - The language of the user
    """

    accepted_tc: datetime | None = None
    """
    time - The time the user accepted the terms and conditions
    """

    sessions: list[int] | None = None  # not required
    """
    sessions - The sessions of the user
    """

    invitation_code: str | None = None
    """
    invitation_code - The invitation code of the user
    """

    experiments: Experiments = Field(default_factory=dict)
    """
    experiments - A dictionary mapping experiment namespaces to their configuration
    Each experiment can have either a simple string value or a nested configuration.
    Example:
    {
        "simple_experiment": "group1",
        "complex_experiment": {
            "shown": true,
            "branch": 3,
            "default": {"rank": 0}
        }
    }
    """

    class Config:
        extra = "forbid"


class UserPreferencesUpdateRequest(BaseModel):
    user_id: str
    """
    User ID - The user ID to update
    """

    language: str | None = None
    """
    Language - The language of the user
    """

    accepted_tc: datetime | None = None
    """
    time - The time the user accepted the terms and conditions
    """
    experiments: Experiments = Field(default_factory=dict)
    """
    experiments - A dictionary mapping experiment namespaces to their configuration
    Each experiment can have either a simple string value or a nested configuration.
    Example:
    {
        "simple_experiment": "group1",
        "complex_experiment": {
            "shown": true,
            "branch": 3,
            "default": {"rank": 0}
        }
    }
    """

    class Config:
        extra = "forbid"


class UserPreferences(BaseModel):
    language: str | None = None
    invitation_code: str | None = None
    accepted_tc: datetime | None = None
    sessions: list[int] = Field(default_factory=list)  # not required
    sensitive_personal_data_requirement: SensitivePersonalDataRequirement
    experiments: Experiments = Field(default_factory=dict)
    """
    experiments - A dictionary mapping experiment namespaces to their configuration
    Each experiment can have either a simple string value or a nested configuration.
    Example:
    {
        "simple_experiment": "group1",
        "complex_experiment": {
            "shown": true,
            "branch": 3,
            "default": {"rank": 0}
        }
    }
    """

    @staticmethod
    def from_document(doc: Mapping[str, Any]) -> "UserPreferences":
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
            experiments=doc.get("experiments", {}),
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

    language: str | None = None
    """
    The language of the user
    """

    accepted_tc: datetime | None = None
    """
    Accepted terms and conditions date
    """

    class Config:
        extra = "forbid"
