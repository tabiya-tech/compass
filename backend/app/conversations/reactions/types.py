"""
Module containing type definitions for the reactions feature.
"""
from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field, model_validator


class DislikeReason(str, Enum):
    """
    Reasons why a user might dislike a message.
    """
    INAPPROPRIATE_TONE = "INAPPROPRIATE_TONE"
    OFFENSIVE_LANGUAGE = "OFFENSIVE_LANGUAGE"
    BIASED = "BIASED"
    INCORRECT_INFORMATION = "INCORRECT_INFORMATION"
    IRRELEVANT = "IRRELEVANT"
    CONFUSING = "CONFUSING"


class ReactionKind(str, Enum):
    """
    Types of reactions a user can have to a message.
    """
    LIKED = "LIKED"
    DISLIKED = "DISLIKED"


class Reaction(BaseModel):
    """
    A user's reaction to a message.
    
    :param message_id: Unique identifier of the message being reacted to
    :param session_id: ID of the session containing the message
    :param kind: Type of reaction (LIKED or DISLIKED)
    :param reasons: List of reasons if the reaction is DISLIKED
    :param created_at: When the reaction was created
    :param id: Unique identifier of the reaction (optional)
    """
    message_id: str
    session_id: int
    kind: ReactionKind
    reasons: list[DislikeReason] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    id: str | None = None

    @model_validator(mode='after')
    def validate_reason(self) -> 'Reaction':
        """
        Validates that reasons are only provided for DISLIKED reactions
        and are required for DISLIKED reactions.

        :return: The validated reaction
        :raises ValueError: If reasons are provided for LIKED reactions or missing for DISLIKED reactions
        """
        if self.kind == ReactionKind.LIKED and self.reasons:
            raise ValueError("Reasons can only be set when reaction kind is DISLIKED")
        if self.kind == ReactionKind.DISLIKED and not self.reasons:
            raise ValueError("Reasons is required when reaction kind is DISLIKED")
        return self

    class Config:
        extra = "forbid"
