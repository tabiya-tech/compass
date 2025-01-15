"""
This module contains the types used for reactions.
"""
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Mapping, Annotated

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


class ReactionKind(int, Enum):
    """
    Represents the kind of reaction.
    """
    LIKED = 0
    DISLIKED = 1


class ReactionRequest(BaseModel):
    """
    Represents a request to create or update a reaction.
    """
    kind: ReactionKind
    reason: list[DislikeReason] = Field(default_factory=list)

    @model_validator(mode='after')
    def validate_reason(self) -> 'ReactionRequest':
        """
        Validates that:
        1. Reason is only set when kind is DISLIKED
        2. Reason is required when kind is DISLIKED
        """
        if self.kind == ReactionKind.LIKED and len(self.reason) > 0:
            raise ValueError("Reason can only be set when reaction kind is DISLIKED")
        if self.kind == ReactionKind.DISLIKED and len(self.reason) == 0:
            raise ValueError("Reason is required when reaction kind is DISLIKED")
        return self

    @field_serializer("kind")
    def serialize_kind(self, kind: ReactionKind, _info) -> str:
        return kind.name

    @field_validator("kind", mode='before')
    def deserialize_kind(cls, value: str | ReactionKind) -> ReactionKind:
        try:
            if isinstance(value, str):
                return ReactionKind[value]
            elif isinstance(value, ReactionKind):
                return value
            else:
                raise ValueError(f"Invalid reaction kind: {value}")
        except (KeyError, ValueError):
            raise ValueError(f"Invalid reaction kind: {value}")

    @field_serializer("reason")
    def serialize_reason(self, reason: list[DislikeReason], _info) -> list[str]:
        return [r.name for r in reason]

    @field_validator("reason", mode='before')
    def deserialize_reason(cls, value: list[int | DislikeReason]) -> list[DislikeReason]:
        if isinstance(value, list):
            result = []
            for item in value:
                if isinstance(item, str):
                    result.append(DislikeReason[item])
                elif isinstance(item, DislikeReason):
                    result.append(item)
                else:
                    raise ValueError(f"Invalid reason item: {item}")
            return result
        else:
            raise ValueError(f"Invalid reason: {value}")

    class Config:
        """
        Pydantic configuration.
        """
        extra = "forbid"


class Reaction(BaseModel):
    message_id: str
    session_id: int
    kind: ReactionKind
    reason: list[DislikeReason] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @model_validator(mode='after')
    def validate_reason(self) -> 'Reaction':
        """
        Validates that:
        1. Reason is only set when kind is DISLIKED
        2. Reason is required when kind is DISLIKED
        """
        if self.kind == ReactionKind.LIKED and len(self.reason) > 0:
            raise ValueError("Reason can only be set when reaction kind is DISLIKED")
        if self.kind == ReactionKind.DISLIKED and len(self.reason) == 0:
            raise ValueError("Reason is required when reaction kind is DISLIKED")
        return self

    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat()

    @field_serializer("kind")
    def serialize_kind(self, kind: ReactionKind, _info) -> str:
        return kind.name

    @field_serializer("reason")
    def serialize_reason(self, reason: list[DislikeReason], _info) -> list[str]:
        return [r.name for r in reason]

    @field_validator("kind", mode='before')
    def deserialize_kind(cls, value: str | ReactionKind) -> ReactionKind:
        try:
            if isinstance(value, str):
                return ReactionKind[value]
            elif isinstance(value, ReactionKind):
                return value
            else:
                raise ValueError(f"Invalid reaction kind: {value}")
        except (KeyError, ValueError):
            raise ValueError(f"Invalid reaction kind: {value}")

    @field_validator("reason", mode='before')
    def deserialize_reason(cls, value: list[int | DislikeReason]) -> list[DislikeReason]:
        if isinstance(value, list):
            result = []
            for item in value:
                if isinstance(item, str):
                    result.append(DislikeReason[item])
                elif isinstance(item, DislikeReason):
                    result.append(item)
                else:
                    raise ValueError(f"Invalid reason item: {item}")
            return result
        else:
            raise ValueError(f"Invalid reason: {value}")

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
        return Reaction(message_id=str(_dict.get("message_id")),
                        session_id=int(_dict.get("session_id")), kind=_dict.get("kind"), reason=_dict.get("reason", []),
                        created_at=_dict.get("created_at"))

    class Config:
        extra = "forbid"


# see https://www.mongodb.com/developer/languages/python/python-quickstart-fastapi/ for more info
PyObjectId = Annotated[str, BeforeValidator(str)]


class ReactionDocModel(Reaction):
    """
    Represents a reaction in the database.
    """
    id: PyObjectId | None = Field(default=None)

    @staticmethod
    def from_dict(_dict: Mapping[str, Any]) -> "ReactionDocModel":
        return ReactionDocModel(id=str(_dict.get("_id")),
                                message_id=str(_dict.get("message_id")),
                                session_id=int(_dict.get("session_id")),
                                kind=_dict.get("kind"),
                                reason=_dict.get("reason", []),
                                created_at=_dict.get("created_at"))

    class Config:
        extra = "forbid"


class MessageReaction(BaseModel):
    """
    Represents a reaction in a message response.
    """
    id: str
    kind: ReactionKind

    @field_validator("kind", mode='before')
    def deserialize_kind(cls, value: str | ReactionKind) -> ReactionKind:
        try:
            if isinstance(value, str):
                return ReactionKind[value]
            elif isinstance(value, ReactionKind):
                return value
            else:
                raise ValueError(f"Invalid reaction kind: {value}")
        except (KeyError, ValueError):
            raise ValueError(f"Invalid reaction kind: {value}")

    @field_serializer("kind")
    def serialize_kind(self, kind: ReactionKind, _info) -> str:
        return kind.name
