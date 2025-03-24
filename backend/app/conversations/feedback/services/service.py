"""
Service layer for handling user feedback operations.
"""
import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, cast
from pathlib import Path

from app.conversations.feedback.repository import IUserFeedbackRepository
from app.app_config import get_application_config
from app.metrics.service import IMetricsService
from app.metrics.types import FeedbackProvidedEvent, FeedbackScoreEvent, FeedbackTypeLiteral
from .types import Feedback, NewFeedbackSpec, FeedbackItem, Version, AnsweredQuestions
from .errors import (
    InvalidQuestionError,
    QuestionsFileError
)

logger = logging.getLogger(__name__)

# Cache for questions data
questions_cache: Dict[str, Any] = {}

def calculate_nps_score(answer: int) -> int:
    """
    Calculate NPS (Net Promoter Score) from answer.
    Returns -1 for Detractors (1-3), 0 for Passives (4), 1 for Promoters (5)

    The NPS scoring follows the standard methodology:
    - Detractors (0-60%): Score -1 (answers 1-3)
    - Passives (70-80%): Score 0 (answer 4)
    - Promoters (top 10%): Score 1 (answers 5)

    where the actual NPS score would be calculated as:
    NPS = %Promoters - %Detractors * 100
    """

    if answer <= 3:
        score = -1  # Detractor
    elif answer == 4:
        score = 0   # Passive
    else:
        score = 1   # Promoter

    return score


def calculate_csat_score(answer: int) -> int:
    """
    Calculate CSAT (Customer Satisfaction) score from answer.
    Returns 1 for highest 2 options (4-5), 0 for others

    The CSAT scoring uses a binary classification:
    - Satisfied: Score 1 (answers 4-5)
    - Not Satisfied: Score 0 (answers 1-3)

    where the actual CSAT score would be calculated as:
    CSAT = (Number of Satisfied Responses / Total Responses) * 100
    """

    score = 0

    if answer >= 4:
        score = 1

    return score


def calculate_ces_score(answer: int) -> int:
    """
    Calculate CES (Customer Effort Score) score from answer.
    Returns 1 for highest 2 options (4-5), 0 for others

    The CES scoring uses a binary classification:
    - Easy: Score 1 (answers 4-5)
    - Difficult: Score 0 (answers 1-3)

    where the actual CES score would be calculated as:
    CES = (Number of Easy Responses / Total Responses) * 100
    """
    return 1 if answer >= 4 else 0


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

    def __init__(self, user_feedback_repository: IUserFeedbackRepository, metrics_service: IMetricsService):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._user_feedback_repository: IUserFeedbackRepository = user_feedback_repository
        self._metrics_service: IMetricsService = metrics_service

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
        saved_feedback = await self._user_feedback_repository.upsert_feedback(complete_feedback)

        # Record feedback provided event
        await self._metrics_service.record_event(
            FeedbackProvidedEvent(
                user_id=user_id,
                session_id=session_id
            )
        )

        # Check for NPS, CSAT, or CES feedback and record scores
        for item in feedback_items:
            # since the rating_numeric is optional, we need to check if it is not None
            if item.answer.rating_numeric is not None:
                score = 0
                feedback_type = ""
                if item.question_id == "recommendation":
                    score = calculate_nps_score(item.answer.rating_numeric)
                    feedback_type = "NPS"
                elif item.question_id == "satisfaction_with_compass":
                    score = calculate_csat_score(item.answer.rating_numeric)
                    feedback_type = "CSAT"
                elif item.question_id == "interaction_ease":
                    score = calculate_ces_score(item.answer.rating_numeric)
                    feedback_type = "CES"

                # if there is feedback_type then save the event
                if feedback_type:
                    await self._metrics_service.record_event(
                        FeedbackScoreEvent(
                            user_id=user_id,
                            session_id=session_id,
                            feedback_type=cast(FeedbackTypeLiteral, feedback_type),
                            value=score
                        )
                    )

        return saved_feedback

    async def get_answered_questions(self, user_id: str) -> AnsweredQuestions:
        feedback_for_sessions: dict[int, Feedback] = await self._user_feedback_repository.get_all_feedback_for_user(user_id)
        answered_questions = {}

        for session_id, feedback in feedback_for_sessions.items():
            answered_questions[session_id] = [item.question_id for item in feedback.feedback_items]

        return answered_questions
