"""
This module contains the types used for reactions.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Any, Mapping, Annotated

from pydantic import BaseModel, Field, field_serializer, BeforeValidator, model_validator, field_validator


class DislikeReason(int, Enum):
    """
    Represents the reasons for disliking a message.
    """
    INAPPROPRIATE_TONE = 0
    OFFENSIVE_LANGUAGE = 1
    BIASED = 2
    INCORRECT_INFORMATION = 3
    IRRELEVANT = 4
    CONFUSING = 5


class ReactionKind(str, Enum):
    """
    Represents the kind of reaction.
    """
    LIKED = "liked"
    DISLIKED = "disliked"


class ReactionRequest(BaseModel):
    """
    Represents a request to create or update a reaction.
    """
    kind: ReactionKind
    reason: Optional[List[DislikeReason]] = None

    @model_validator(mode='after')
    def validate_reason(self) -> 'ReactionRequest':
        """
        Validates that:
        1. Reason is only set when kind is DISLIKED
        2. Reason is required when kind is DISLIKED
        """
        if self.kind == ReactionKind.LIKED and self.reason is not None:
            raise ValueError("Reason can only be set when reaction kind is DISLIKED")
        if self.kind == ReactionKind.DISLIKED and (self.reason is None or len(self.reason) == 0):
            raise ValueError("Reason is required when reaction kind is DISLIKED")
        return self

    class Config:
        """
        Pydantic configuration.
        """
        extra = "forbid"

    # parameterize and test the model


PyObjectId = Annotated[str, BeforeValidator(str)]


class Reaction(BaseModel):
    """
    Represents a reaction in the database.
    """
    # since _id is not supported by pydantic, we use id as an alias
    # see https://www.mongodb.com/developer/languages/python/python-quickstart-fastapi/ for more info
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    message_id: str
    session_id: int
    kind: ReactionKind
    reason: Optional[List[DislikeReason]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode='after')
    def validate_reason(self) -> 'Reaction':
        """
        Validates that:
        1. Reason is only set when kind is DISLIKED
        2. Reason is required when kind is DISLIKED
        """
        if self.kind == ReactionKind.LIKED and self.reason is not None:
            raise ValueError("Reason can only be set when reaction kind is DISLIKED")
        if self.kind == ReactionKind.DISLIKED and (self.reason is None or len(self.reason) == 0):
            raise ValueError("Reason is required when reaction kind is DISLIKED")
        return self

    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat()

    @field_serializer("kind")
    def serialize_kind(self, kind: ReactionKind, _info) -> str:
        return kind.name

    @field_serializer("reason")
    def serialize_reason(self, reason: Optional[List[DislikeReason]], _info) -> Optional[List[str]]:
        if reason is None:
            return None
        return [r.name for r in reason]

    @field_validator("kind", mode='before')
    def deserialize_kind(cls, value: str | ReactionKind) -> ReactionKind:
        if isinstance(value, str):
            try:
                return ReactionKind[value]
            except KeyError:
                # If not a valid name, try as value for backward compatibility
                try:
                    return ReactionKind(value)
                except ValueError:
                    raise ValueError(f"Invalid reaction kind: {value}")
        return value

    @field_validator("reason", mode='before')
    def deserialize_reason(cls, value: Optional[List[str | int | DislikeReason]]) -> Optional[List[DislikeReason]]:
        if value is None:
            return None
        if isinstance(value, list):
            # If the value is a list, and the items in the list are strings, we convert the strings to the Enum
            # Otherwise, we return the value as is
            return [DislikeReason[x] if isinstance(x, str) else x for x in value]
        return value

    @staticmethod
    def from_dict(_dict: Mapping[str, Any]) -> "Reaction":
        """
        Converts a dictionary to a Reaction object.

        This method extracts fields from a provided dictionary, and initializes a
        Reaction object with those values.

        :param _dict: A mapping from string keys to corresponding values,
                     representing the attributes of a Reaction object.
        :return: An instance of Reaction initialized from the provided dictionary.
        """
        return Reaction(_id=_dict.get("_id"), message_id=str(_dict.get("message_id")),
                        session_id=int(_dict.get("session_id")), kind=_dict.get("kind"), reason=_dict.get("reason"),
                        created_at=_dict.get("created_at"))

    class Config:
        extra = "forbid"
