from pydantic import BaseModel, Field, field_serializer, field_validator
from typing import List, Optional
from datetime import datetime, timezone


class Answer(BaseModel):
    rating_numeric: Optional[int] = None
    rating_boolean: Optional[bool] = None
    selected_options: Optional[List[str]] = None
    comment: Optional[str] = Field(default=None, max_length=1000)

    class Config:
        extra = "forbid"


class FeedbackItem(BaseModel):
    question_id: str
    question_text: str
    answer: Answer
    description: Optional[str] = Field(default=None, max_length=1000)

    class Config:
        extra = "forbid"


class Version(BaseModel):
    frontend: str
    backend: str

    class Config:
        extra = "forbid"


class FeedbackRecord(BaseModel):
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

    feedback_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    """
    Feedback Time
    """

    feedback: List[FeedbackItem]
    """
    Feedback
    """

    class Config:
        extra = "forbid"

    # Serialize the feedback_time datetime to ensure it's stored as UTC
    @field_serializer("feedback_time")
    def serialize_feedback_time(self, feedback_time: datetime) -> str:
        return feedback_time.isoformat()

    # Deserialize the feedback_time datetime and ensure it's interpreted as UTC
    @field_validator("feedback_time", mode='before')
    def deserialize_feedback_time(cls, value: str | datetime) -> datetime:
        if isinstance(value, str):
            dt = datetime.fromisoformat(value)
        else:
            dt = value
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
