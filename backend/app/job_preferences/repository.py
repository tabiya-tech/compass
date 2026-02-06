import logging
from abc import ABC, abstractmethod
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.job_preferences.types import JobPreferences
from app.server_dependencies.database_collections import Collections


class IJobPreferencesRepository(ABC):
    """
    Interface for the Job Preferences Repository.
    Allows to mock the repository in tests.
    """

    @abstractmethod
    async def create_or_update_job_preferences(
        self,
        session_id: int,
        preferences: JobPreferences
    ) -> None:
        """
        Create or update job preferences for a session.

        Args:
            session_id: Compass user session ID
            preferences: JobPreferences object with all preference data
        """
        pass

    @abstractmethod
    async def get_job_preferences_by_session(
        self,
        session_id: int
    ) -> Optional[JobPreferences]:
        """
        Retrieve job preferences for a session.

        Args:
            session_id: Compass user session ID

        Returns:
            JobPreferences object if found, None otherwise
        """
        pass


class JobPreferencesRepository(IJobPreferencesRepository):
    """
    JobPreferencesRepository class is responsible for managing job preferences in the database.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self._collection = db.get_collection(Collections.JOB_PREFERENCES)
        self._logger = logging.getLogger(self.__class__.__name__)

    async def create_or_update_job_preferences(
        self,
        session_id: int,
        preferences: JobPreferences
    ) -> None:
        """
        Create or update job preferences for a session.

        Uses upsert to either create new document or update existing one.

        Args:
            session_id: Compass user session ID
            preferences: JobPreferences object with all preference data
        """
        try:
            # Convert Pydantic model to dict
            preferences_dict = preferences.model_dump()

            # Upsert: update if exists, create if not
            result = await self._collection.update_one(
                {"session_id": session_id},
                {"$set": preferences_dict},
                upsert=True
            )

            if result.upserted_id:
                self._logger.info("Created job preferences for session %s", session_id)
            else:
                self._logger.info("Updated job preferences for session %s", session_id)

        except Exception as e:
            self._logger.error("Error saving job preferences for session %s: %s", session_id, e, exc_info=True)
            raise

    async def get_job_preferences_by_session(
        self,
        session_id: int
    ) -> Optional[JobPreferences]:
        """
        Retrieve job preferences for a session.

        Args:
            session_id: Compass user session ID

        Returns:
            JobPreferences object if found, None otherwise
        """
        try:
            doc = await self._collection.find_one({"session_id": session_id})

            if doc is None:
                self._logger.debug("No job preferences found for session %s", session_id)
                return None

            # Remove MongoDB _id field before creating Pydantic model
            if "_id" in doc:
                del doc["_id"]

            return JobPreferences(**doc)

        except Exception as e:
            self._logger.error("Error retrieving job preferences for session %s: %s", session_id, e, exc_info=True)
            raise
