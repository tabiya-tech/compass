import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase
from app.server_dependencies.database_collections import Collections
from app.users.feedback.model import FeedbackRecord

logger = logging.getLogger(__name__)


class UserFeedbackRepository:
    """
    UserFeedbackRepository class is responsible for managing the user feedback in the database.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db.get_collection(Collections.USER_FEEDBACK)

    async def get_feedback_by_session_id(self, session_id: int) -> Optional[FeedbackRecord]:
        """
        Find feedback by session ID.
        Returns None if the feedback is not found.

        :param session_id: int the session ID
        :return: Optional[FeedbackRecord] the feedback record
        """
        try:
            _doc = await self._collection.find_one({"session_id": {"$eq": session_id}})
            if not _doc:
                logger.warning(f"Feedback for session_id '{session_id}' not found")
                return None

            _doc.pop('_id', None)
            return FeedbackRecord(**_doc)
        except Exception as e:
            logger.exception(e)
            raise e

    async def insert_feedback(self, feedback_data) -> None:
        """
        Insert a new feedback record into the database.
        :param feedback_data: dict the feedback data to insert
        """
        try:
            res = await self._collection.insert_one(feedback_data.model_dump())
            if not res.inserted_id:
                raise RuntimeError("Failed to insert feedback data")

        except Exception as e:
            logger.exception(e)
            raise e

    async def get_feedback_session_ids(self, user_id: str) -> list[int]:
        """
        Get all the session IDs for the user that has provided feedback.
        :param user_id: str the user ID
        :return: list[int] the list of session IDs
        """
        try:
            feedback_sessions = await self._collection.find({"user_id": user_id}).distinct("session_id")
            if not feedback_sessions:
                logger.warning(f"Feedback for user_id '{user_id}' not found")
                return []

            return feedback_sessions
        except Exception as e:
            logger.exception(e)
            raise e
