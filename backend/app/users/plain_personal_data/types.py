"""
This module contains the types used for storing plain (unencrypted) personal data.
"""

import re
from datetime import datetime, timezone
from typing import Union, Mapping

from pydantic import BaseModel, Field, field_validator, field_serializer

# Matches letters (Unicode), spaces, and dots; 2–50 characters.
# Same pattern enforced by the frontend field config.
_NAME_PATTERN = re.compile(r"^(?!\.)(?!.*\.\.)(?!.*(\\..*){5,})[\w\s.]{2,50}$", re.UNICODE)

# Name fields that must pass the pattern when supplied
_VALIDATED_NAME_KEYS = {"first_name", "last_name", "name"}


class CreateOrUpdatePlainPersonalDataRequest(BaseModel):
    """
    Represents the request body for creating or updating plain personal data.
    """
    data: dict[str, Union[str, list[str]]] = Field(
        description="Map of field dataKey to value(s). Values are plain strings or lists of strings.",
    )

    @field_validator("data")
    @classmethod
    def validate_name_fields(cls, data: dict[str, Union[str, list[str]]]) -> dict[str, Union[str, list[str]]]:
        """
        Validates that name fields (first_name, last_name, name) contain only
        letters, spaces, and dots, and are between 2 and 50 characters long.
        """
        for key in _VALIDATED_NAME_KEYS:
            value = data.get(key)
            if value is None:
                continue
            if not isinstance(value, str):
                raise ValueError(f"'{key}' must be a string")
            stripped = value.strip()
            if len(stripped) < 2:
                raise ValueError(f"'{key}' must be at least 2 characters long")
            if len(stripped) > 50:
                raise ValueError(f"'{key}' must be at most 50 characters long")
            if not re.match(r"^[\w\s.]+$", stripped, re.UNICODE):
                raise ValueError(f"'{key}' must contain only letters, spaces, and dots")
        return data

    class Config:
        """
        Pydantic configuration.
        """
        extra = "forbid"


class PlainPersonalData(BaseModel):
    """
    The plain personal data document in the database.
    """

    user_id: str = Field(description="The user id")
    created_at: datetime = Field(description="The date and time the database entry was created")
    updated_at: datetime = Field(description="The date and time the database entry was last updated")
    data: dict[str, Union[str, list[str]]] = Field(
        description="Map of field dataKey to value(s).",
        default_factory=dict,
    )

    @field_serializer("created_at", "updated_at")
    def _serialize_datetime(self, dt: datetime) -> str:
        return dt.isoformat()

    @classmethod
    @field_validator("created_at", "updated_at", mode="before")
    def _deserialize_datetime(cls, value: Union[str, datetime]) -> datetime:
        if isinstance(value, str):
            dt = datetime.fromisoformat(value)
        else:
            dt = value
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    @staticmethod
    def from_dict(_dict: Mapping[str, any]) -> "PlainPersonalData":
        """
        Converts a dictionary to a ``PlainPersonalData`` object.
        """
        return PlainPersonalData(
            user_id=str(_dict.get("user_id")),
            created_at=_dict.get("created_at"),
            updated_at=_dict.get("updated_at"),
            data=_dict.get("data", {}),
        )

    class Config:
        """
        Pydantic configuration.
        """
        extra = "forbid"
