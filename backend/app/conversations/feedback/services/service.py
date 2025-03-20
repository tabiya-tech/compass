"""
Service layer for handling user feedback operations.
"""
import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict
from pathlib import Path

from app.conversations.feedback.repository import IUserFeedbackRepository
from app.app_config import get_application_config
from .types import Feedback, NewFeedbackSpec, FeedbackItem, Version, AnsweredQuestions
from .errors import (
    InvalidQuestionError,
    QuestionsFileError
)

logger = logging.getLogger(__name__)

# Cache for questions data
questions_cache: Dict[str, Any] = {}


async def load_questions() -> Dict[str, Any]:
    global questions_cache
    if not questions_cache:
        questions_file = Path(__file__).parent / "questions-en.json"
        try:
            questions_data = await asyncio.to_thread(questions_file.read_text)
            questions_cache = json.loads(questions_data)
        except FileNotFoundError:
            raise QuestionsFileError("Questions file not found")
        except Exception as e:
            logger.exception(e)
            raise QuestionsFileError("Failed to load questions data")

    return questions_cache


class IUserFeedbackService(ABC):
    """Interface for user feedback service operations."""

    @abstractmethod
    async def upsert_user_feedback(self, user_id: str, session_id: int, feedback: NewFeedbackSpec) -> Feedback:
        """
        Creates or updates user feedback for a session.

        :param user_id: The user ID to create feedback for
        :param session_id: The session ID to create feedback for
        :param feedback: The feedback to create or update
        :return: The created/updated feedback
        :raises InvalidQuestionError: If a question ID is invalid
        :raises InvalidOptionError: If an option is invalid for a question
        :raises QuestionsFileError: If there's an error loading the questions file
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_answered_questions(self, user_id: str) -> AnsweredQuestions:
        """
        Gets all feedback entries that a user has provided

        :param user_id: The user ID to get feedback for
        :return: a key value pair where the key is the session ID and the value is a list of question_ids
        """
        raise NotImplementedError()


class UserFeedbackService(IUserFeedbackService):
    """
    The UserFeedbackService class provides the business logic for the user feedback routes
    """

    def __init__(self, user_feedback_repository: IUserFeedbackRepository):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._user_feedback_repository: IUserFeedbackRepository = user_feedback_repository

    async def upsert_user_feedback(self, user_id: str, session_id: int, feedback_spec: NewFeedbackSpec) -> Feedback:
        questions_data = await load_questions()
        if not questions_data:
            raise QuestionsFileError("No questions data available")
        # Construct full feedback items with question text and description
        feedback_items = []
        for item in feedback_spec.feedback_items_specs:
            question_id = item.question_id
            question: dict | None = questions_data.get(item.question_id, None)
            if question is None:
                raise InvalidQuestionError(question_id)

            # Create a full FeedbackItem with all required fields
            feedback_item = FeedbackItem(
                question_id=item.question_id,
                answer=item.simplified_answer.to_answer(question_id=question_id, available_options=question.get("options", {})),
                question_text=questions_data[question_id]["question_text"],
                description=questions_data[question_id]["description"]
            )
            feedback_items.append(feedback_item)

        # Construct full Version object
        version = Version(
            frontend=feedback_spec.version.frontend,
            backend=get_application_config().version_info.to_version_string()
        )

        # Create full Feedback object
        complete_feedback = Feedback(
            session_id=session_id,
            user_id=user_id,
            version=version,
            feedback_items=feedback_items
        )

        # Use upsert to create or update the feedback
        return await self._user_feedback_repository.upsert_feedback(complete_feedback)

    async def get_answered_questions(self, user_id: str) -> AnsweredQuestions:
        feedback_for_sessions: dict[int, Feedback] = await self._user_feedback_repository.get_all_feedback_for_user(user_id)
        answered_questions = {}

        for session_id, feedback in feedback_for_sessions.items():
            answered_questions[session_id] = [item.question_id for item in feedback.feedback_items]

        return answered_questions
