"""
Module containing type definitions for the feedback feature.
"""
from datetime import datetime

from pydantic import BaseModel

from app.conversations.feedback.services import FeedbackItem, Feedback, Version, SimplifiedAnswer


class FeedbackItemResponse(BaseModel):
    """
    The response model for a single feedback item.
    """
    question_id: str
    """
    ID of the question
    """

    simplified_answer: SimplifiedAnswer
    """
    The user's simplified answer
    """

    question_text: str
    """
    Text of the question
    """

    description: str
    """
    Description of the question
    """

    class Config:
        extra = "forbid"

    @classmethod
    def from_feedback_item(cls, item: FeedbackItem) -> "FeedbackItemResponse":
        """
        Creates a FeedbackItemResponse from a FeedbackItem.
        This method handles any necessary transformations   .
        """
        return FeedbackItemResponse(
            question_id=item.question_id,
            question_text=item.question_text,
            simplified_answer=SimplifiedAnswer.from_answer(item.answer),
            description=item.description
        )


class FeedbackResponse(BaseModel):
    """
    The response model for a feedback object.
    """
    id: str
    version: Version
    feedback_items: list[FeedbackItemResponse]
    created_at: datetime

    @classmethod
    def from_feedback(cls, feedback: Feedback) -> "FeedbackResponse":
        """
        Creates a FeedbackResponse from a Feedback model.
        This method handles any necessary transformations.
        """
        return cls(
            id=feedback.id,
            version=feedback.version,
            feedback_items=[FeedbackItemResponse.from_feedback_item(item) for item in feedback.feedback_items],
            created_at=feedback.created_at
        )

    class Config:
        extra = "forbid"
