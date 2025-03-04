"""
This module contains the repository layer for handling user feedback.
"""
import logging
from abc import ABC, abstractmethod
from typing import Mapping

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument
from app.server_dependencies.database_collections import Collections
from app.conversations.feedback.services import Feedback, FeedbackItem, Answer
from common_libs.time_utilities import mongo_date_to_datetime, datetime_to_mongo_date

logger = logging.getLogger(__name__)


class IUserFeedbackRepository(ABC):
    """Interface for storing and retrieving user feedback."""

    @abstractmethod
    async def upsert_feedback(self, feedback: Feedback) -> Feedback:
        """
        Creates or updates user feedback for a session.

        :param feedback: The feedback to create or update
        :return: The created/updated feedback
        :raises Exception: If any database error occurs
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_feedback_by_session_id(self, session_id: int) -> Feedback | None:
        """
        Find feedback by session ID.
        Returns None if the feedback is not found.

        :param session_id: The session ID to get feedback for
        :return: The feedback if found, None otherwise
        :raises Exception: If any database error occurs
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_feedback_session_ids(self, user_id: str) -> list[int]:
        """
        Get all the session IDs for the user that has provided feedback.

        :param user_id: The user ID to get feedback for
        :return: List of session IDs with feedback
        :raises Exception: If any database error occurs
        """
        raise NotImplementedError()


class UserFeedbackRepository(IUserFeedbackRepository):
    """
    UserFeedbackRepository class is responsible for managing the user feedback in the database.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self._db = db
        self._logger = logging.getLogger(self.__class__.__name__)
        self._collection = db.get_collection(Collections.USER_FEEDBACK)

    @classmethod
    def _from_db_doc(cls, doc: Mapping) -> Feedback:
        """
        Converts a MongoDB document to a Feedback object.

        :param doc: MongoDB document
        :return: Feedback object
        """
        feedback_items = []
        for item in doc.get("feedback_items", []):
            _doc_answer = item.get("answer", {})
            feedback_items.append(FeedbackItem(
                question_id=item.get("question_id"),
                answer=Answer(
                    selected_options=_doc_answer.get("selected_options", {}),
                    rating_numeric=_doc_answer.get("rating_numeric"),
                    rating_boolean=_doc_answer.get("rating_boolean"),
                    comment=_doc_answer.get("comment")
                ),
                question_text=item.get("question_text"),
                description=item.get("description")
            ))

        return Feedback(
            id=str(doc["_id"]) if "_id" in doc else None,
            session_id=doc.get("session_id"),
            user_id=doc.get("user_id"),
            version=doc.get("version", {}),
            feedback_items=feedback_items,
            created_at=mongo_date_to_datetime(doc.get("created_at"))
        )

    @classmethod
    def _to_db_doc(cls, feedback: Feedback) -> Mapping:
        """
        Converts a Feedback object to a MongoDB document.

        :param feedback: Feedback object to convert
        :return: MongoDB document
        """
        feedback_items = []
        for item in feedback.feedback_items:
            feedback_items.append({
                "question_id": item.question_id,
                "answer": {
                    "selected_options": item.answer.selected_options,
                    "rating_numeric": item.answer.rating_numeric,
                    "rating_boolean": item.answer.rating_boolean,
                    "comment": item.answer.comment
                },
                "question_text": item.question_text,
                "description": item.description
            })

        return {
            "session_id": feedback.session_id,
            "user_id": feedback.user_id,
            "version": {
                "frontend": feedback.version.frontend,
                "backend": feedback.version.backend
            },
            "feedback_items": feedback_items,
            "created_at": datetime_to_mongo_date(feedback.created_at)
        }

    async def get_feedback_by_session_id(self, session_id: int) -> Feedback | None:
        try:
            # use $eq to avoid no-sql injection
            doc = await self._collection.find_one({"session_id": {"$eq": session_id}})
            if not doc:
                self._logger.warning(f"Feedback for session_id '{session_id}' not found")
                return None

            return self._from_db_doc(doc)
        except Exception as e:
            self._logger.exception(e)
            raise

    async def upsert_feedback(self, feedback: Feedback) -> Feedback:
        try:
            # Get existing feedback if it exists
            existing_feedback = await self.get_feedback_by_session_id(feedback.session_id)
            if not existing_feedback:
                existing_feedback = feedback
            else:  # Update the existing feedback with the new feedback items
                for item in feedback.feedback_items:
                    # replace the existing item with the new item if it exists, other append it
                    existing_item = existing_feedback.find_feedback_item_by_question_id(item.question_id) if existing_feedback else None
                    if existing_item:
                        existing_feedback.feedback_items.remove(existing_item)
                    existing_feedback.feedback_items.append(item)

            # Convert the feedback to a MongoDB document
            doc = self._to_db_doc(existing_feedback)

            # Use upsert to create or update the document and return the updated document
            result = await self._collection.find_one_and_update(
                {"session_id": {"$eq": feedback.session_id}},
                {"$set": doc},
                upsert=True,
                return_document=ReturnDocument.AFTER
            )

            if not result:
                raise RuntimeError("Failed to upsert feedback data")

            return self._from_db_doc(result)
        except Exception as e:
            self._logger.exception(e)
            raise

    async def get_feedback_session_ids(self, user_id: str) -> list[int]:
        """
        Get all the session IDs for the user that has provided feedback.
        :param user_id: str the user ID
        :return: list[int] the list of session IDs
        """
        try:
            feedback_sessions = await self._collection.find({"user_id": {"$eq": user_id}}).distinct("session_id")
            if not feedback_sessions:
                logger.warning(f"Feedback for user_id '{user_id}' not found")
                return []

            return feedback_sessions
        except Exception as e:
            logger.exception(e)
            raise e
