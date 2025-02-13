from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, model_validator

# ensure these are the same as the enum keys
ReactionKindLiteral = Literal["LIKED", "DISLIKED"]
DislikeReasonLiteral = Literal[
    "INAPPROPRIATE_TONE", "OFFENSIVE_LANGUAGE", "BIASED", "INCORRECT_INFORMATION", "IRRELEVANT", "CONFUSING"]


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


class Reaction(BaseModel):
    """
    Business model for reactions. This is the core model used internally.
    """
    message_id: str
    session_id: int
    kind: ReactionKind
    reasons: list[DislikeReason] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    id: str | None = None

    @model_validator(mode='after')
    def validate_reason(self) -> 'Reaction':
        if self.kind == ReactionKind.LIKED and self.reasons:
            raise ValueError("Reasons can only be set when reaction kind is DISLIKED")
        if self.kind == ReactionKind.DISLIKED and not self.reasons:
            raise ValueError("Reasons is required when reaction kind is DISLIKED")
        return self

    class Config:
        extra = "forbid"


class MessageReaction(BaseModel):
    """
    Response model for reactions in ConversationMessage. Only exposes id and kind.
    """
    id: str
    kind: ReactionKindLiteral = Field(
        description=f"Must be one of: {', '.join(ReactionKind.__members__.keys())}"
    )

    @classmethod
    def from_reaction(cls, reaction: Reaction) -> 'MessageReaction':
        """
        Convert business model to response model.
        
        :param reaction: Reaction business model
        :return: MessageReaction response model
        """
        if not reaction.id:
            raise ValueError("Cannot convert Reaction without an id to MessageReaction")
        return cls(
            id=reaction.id,
            kind=reaction.kind.name
        )

    class Config:
        extra = "forbid"
