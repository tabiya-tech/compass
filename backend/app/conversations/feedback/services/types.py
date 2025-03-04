"""
Module containing type definitions for the feedback feature.
"""
from datetime import datetime

from typing import TypeAlias
from pydantic import BaseModel, Field

from .errors import InvalidOptionError
from common_libs.time_utilities import get_now


class Answer(BaseModel):
    """
    The core model for storing user answers to feedback questions.
    Used internally by the system to store answers in their complete form.
    
    This model stores answers in their raw format:
    - selected_options: Dictionary mapping option keys to their full text values
    - rating_numeric: For numeric ratings (e.g., 1-5 stars)
    - rating_boolean: For yes/no questions
    - comment: For text feedback
    """
    selected_options: dict[str, str] = {}
    """
    Selected options for multiple choice questions as key-value pairs
    """

    rating_numeric: int | None = None
    """
    Numeric rating value
    """

    rating_boolean: bool | None = None
    """
    Boolean rating value
    """

    comment: str | None = None
    """
    Text comment
    """

    class Config:
        extra = "forbid"


class FeedbackItem(BaseModel):
    """
    Represents a single feedback question and its answer in the system.
    Used internally to store complete feedback data including question text and description.
    
    This model contains all the information needed to display and process a feedback question,
    including the question text, description, and the user's answer.
    """
    question_id: str
    """
    ID of the question
    """

    answer: Answer
    """
    The user's answer
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


class Version(BaseModel):
    """
    Stores version information for both frontend and backend.
    Used internally to track which versions of the application were used when feedback was provided.
    
    This helps with debugging and ensuring compatibility between different versions
    of the frontend and backend.
    """
    frontend: str
    """
    Frontend version
    """
    backend: str
    """
    Backend version
    """

    class Config:
        extra = "forbid"


class Feedback(BaseModel):
    """
    The complete feedback model used for database storage.
    Contains all feedback items with their full details and metadata.
    
    This is the main model used internally by the system to store and process
    user feedback. It includes all necessary information about the feedback session,
    including when it was created and which user provided it.
    """
    session_id: int
    """
    ID of the session being rated
    """

    user_id: str
    """
    ID of the user providing feedback
    """

    version: Version
    """
    Version information for frontend and backend
    """

    feedback_items: list[FeedbackItem]
    """
    List of feedback items
    """

    created_at: datetime = Field(default_factory=lambda: get_now())
    """
    When the feedback was created
    """

    id: str | None = None
    """
    Unique identifier of the feedback
    """

    def find_feedback_item_by_question_id(self, question_id: str) -> FeedbackItem | None:
        """
        Find a feedback item by question ID.
        :param question_id: The question ID to search for
        :return: The feedback item if found, None otherwise
        """
        for item in self.feedback_items:
            if item.question_id == question_id:
                return item
        return None

    class Config:
        extra = "forbid"


class SimplifiedAnswer(BaseModel):
    """
    A simplified version of Answer used for API communication.
    Compared to the full Answer model, this model's selected_options fields
    only contain the keys of the selected options, rather than the full key-value pairs.
    """

    rating_numeric: int | None = None
    """
    Numeric rating value
    """

    rating_boolean: bool | None = None
    """
    Boolean rating value
    """

    comment: str | None = None
    """
    Text comment
    """
    selected_options_keys: list[str] = []
    """
    Selected options for multiple choice questions as just keys
    """

    class Config:
        extra = "forbid"

    @classmethod
    def from_answer(cls, answer: Answer) -> "SimplifiedAnswer":
        return SimplifiedAnswer(
            rating_numeric=answer.rating_numeric,
            rating_boolean=answer.rating_boolean,
            comment=answer.comment,
            selected_options_keys=list(answer.selected_options.keys()),
        )

    def to_answer(self, *, question_id: str, available_options: dict[str, str]):
        selected_options = {}
        # Convert frontend keys to key-value pairs
        for option_key in self.selected_options_keys:
            option_value = available_options.get(option_key, None)
            if option_value is None:
                raise InvalidOptionError(option_key, question_id)
            selected_options[option_key] = option_value
        return Answer(
            selected_options=selected_options,
            rating_numeric=self.rating_numeric,
            rating_boolean=self.rating_boolean,
            comment=self.comment
        )


class NewFeedbackItemSpec(BaseModel):
    """
    Specification for creating a new feedback item.
    Used when receiving feedback data from the frontend.
    
    This model contains only the fields that are provided by the client,
    making it clear what data is required when submitting feedback.
    """
    question_id: str
    """
    ID of the question
    """

    simplified_answer: SimplifiedAnswer
    """
    The user's simplified answer
    """

    class Config:
        extra = "forbid"


class NewFeedbackVersionSpec(BaseModel):
    """
    A simplified version model used when creating new feedback.
    Only contains frontend version as backend version is added by the service.

    This model is used in API requests to specify which version of the frontend
    is sending the feedback.
    """
    frontend: str
    """
    Frontend version
    """

    class Config:
        extra = "forbid"


class NewFeedbackSpec(BaseModel):
    """
    Specification for creating new feedback.
    Used when receiving complete feedback submissions from the frontend.
    
    This model contains all the necessary information to create a new feedback entry,
    including the session ID, user ID, and all feedback items.
    """
    feedback_items_specs: list[NewFeedbackItemSpec]
    """
    List of feedback items
    """

    version: NewFeedbackVersionSpec
    """
    Version information for frontend and backend
    """

    class Config:
        extra = "forbid"


AnsweredQuestions: TypeAlias = dict[int, list[str]]