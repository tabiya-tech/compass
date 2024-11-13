from pydantic import BaseModel
from typing import List

from app.users.feedback.model import Answer


class FeedbackItem(BaseModel):
    question_id: str
    answer: Answer

    class Config:
        extra = "forbid"


class Version(BaseModel):
    frontend: str

    class Config:
        extra = "forbid"


class CreateFeedbackRequest(BaseModel):
    user_id: str
    """
    User ID
    """

    session_id: int = 1
    """
    Session ID
    """

    version: Version
    """
    Version
    """

    feedback: List[FeedbackItem]
    """
    Feedback
    """

    class Config:
        extra = "forbid"
