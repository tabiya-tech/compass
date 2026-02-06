import logging
from abc import ABC, abstractmethod
from typing import Optional

from app.job_preferences.repository import IJobPreferencesRepository
from app.job_preferences.types import JobPreferences


class IJobPreferencesService(ABC):
    """
    Interface for the Job Preferences Service.
    Allows to mock the service in tests.
    """

    @abstractmethod
    async def create_or_update(
        self,
        session_id: int,
        preferences: JobPreferences
    ) -> None:
        """
        Create or update job preferences for a session.

        Args:
            session_id: Compass user session ID
            preferences: JobPreferences object
        """
        pass

    @abstractmethod
    async def get_by_session(
        self,
        session_id: int
    ) -> Optional[JobPreferences]:
        """
        Get job preferences for a session.

        Args:
            session_id: Compass user session ID

        Returns:
            JobPreferences if found, None otherwise
        """
        pass


class JobPreferencesService(IJobPreferencesService):
    """
    JobPreferencesService class is responsible for business logic related to job preferences.
    """

    def __init__(self, repository: IJobPreferencesRepository):
        self._repository = repository
        self._logger = logging.getLogger(self.__class__.__name__)

    async def create_or_update(
        self,
        session_id: int,
        preferences: JobPreferences
    ) -> None:
        """
        Create or update job preferences for a session.

        Args:
            session_id: Compass user session ID
            preferences: JobPreferences object
        """
        # Validation: ensure session_id matches
        if preferences.session_id != session_id:
            raise ValueError(f"Session ID mismatch: {preferences.session_id} != {session_id}")

        await self._repository.create_or_update_job_preferences(
            session_id=session_id,
            preferences=preferences
        )

    async def get_by_session(
        self,
        session_id: int
    ) -> Optional[JobPreferences]:
        """
        Get job preferences for a session.

        Args:
            session_id: Compass user session ID

        Returns:
            JobPreferences if found, None otherwise
        """
        return await self._repository.get_job_preferences_by_session(session_id)
