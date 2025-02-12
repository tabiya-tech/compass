from datetime import datetime, timezone
from enum import Enum
from typing import Any, Mapping, List

from pydantic import BaseModel, Field, field_serializer, model_validator, field_validator


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


class _ReactionBase(BaseModel):
    """
    A base model that has the validation logic for children classes to inherit.
    Not to be used for typing in the broader app.
    Use one of the children.
    """
    kind: ReactionKind
    reasons: List[DislikeReason] = Field(default_factory=list)

    @model_validator(mode='after')
    def validate_reason(self) -> "_ReactionBase":
        if self.kind == ReactionKind.LIKED and self.reasons:
            raise ValueError("Reasons can only be set when reaction kind is DISLIKED")
        if self.kind == ReactionKind.DISLIKED and not self.reasons:
            raise ValueError("Reasons is required when reaction kind is DISLIKED")
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

    @field_serializer("reasons")
    def serialize_reason(self, reasons: list[DislikeReason], _info) -> list[str]:
        return [r.name for r in reasons]

    @field_validator("reasons", mode='before')
    def deserialize_reasons(cls, value: List[int | DislikeReason]) -> List[DislikeReason]:
        if isinstance(value, list):
            result = []
            for item in value:
                if isinstance(item, str):
                    result.append(DislikeReason[item])
                elif isinstance(item, DislikeReason):
                    result.append(item)
                else:
                    raise ValueError(f"Invalid reasons item: {item}")
            return result
        else:
            raise ValueError(f"Invalid reasons: {value}")

    class Config:
        """
        Pydantic configuration.
        """
        extra = "forbid"


class Reaction(_ReactionBase):
    message_id: str
    session_id: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    id: str | None = None

    @field_serializer('created_at')
    def serialize_created_at(self, value: datetime) -> str:
        return value.astimezone(timezone.utc).isoformat()

    @staticmethod
    def from_dict(_dict: Mapping[str, Any]) -> "Reaction":
        return Reaction(
            id=str(_dict.get("_id")) if "_id" in _dict else None,
            message_id=str(_dict.get("message_id")),
            session_id=int(_dict.get("session_id")),
            kind=_dict.get("kind"),
            reasons=_dict.get("reasons", []),
            created_at=_dict.get("created_at")
        )

    class Config:
        extra = "forbid"


class ReactionRequest(_ReactionBase):
    """
    Request model accepts only 'kind' and 'reasons'.
    """

    class Config:
        extra = "forbid"


# Refactor
class MessageReaction(Reaction):
    """
    TODO: add ref to the ConversationMessage model
    Response model for #ConversationMessage... ; only exposes id and kind.
    """
    id: str
    kind: ReactionKind

    class Config:
        extra = "forbid"
        fields = {
            'created_at': {'exclude': True},
            'session_id': {'exclude': True},
            'message_id': {'exclude': True},
            'reasons': {'exclude': True},
        }
