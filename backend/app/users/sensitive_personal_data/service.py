"""
This module contains the service layer for the sensitive personal data module.
"""
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from app.users.sensitive_personal_data.repository import ISensitivePersonalDataRepository
from app.users.sensitive_personal_data.types import CreateSensitivePersonalDataRequest, SensitivePersonalDataRequirement, SensitivePersonalData
from app.users.repositories import IUserPreferenceRepository
from app.users.sensitive_personal_data.errors import (
    DuplicateSensitivePersonalDataError,
    UserPreferencesNotFoundError,
    SensitivePersonalDataRequiredError,
    SensitivePersonalDataNotAvailableError
)


class ISensitivePersonalDataService(ABC):
    """
    Interface for the Sensitive Personal Data Service

    Allows to mock the service in tests.
    """

    @abstractmethod
    async def exists_by_user_id(self, user_id: str) -> bool:
        """
        Check if sensitive user data exists by user_id
        :param user_id: user_id
        :return: bool - True if exists, False otherwise
        :raises Exception: if any error occurs
        """
        raise NotImplementedError()

    @abstractmethod
    async def create(self, user_id: str, request_body: CreateSensitivePersonalDataRequest):
        """
        Create sensitive personal data. If the sensitive data already exists for the given user id, it will raise a DuplicateSensitivePersonalDataError.

        :param user_id: the user id
        :param request_body: CreateSensitivePersonalData - the request body
        :return: None - if successful
        :raises DuplicateSensitivePersonalDataError if sensitive personal data already exists for the given user id
        :raises UserPreferencesNotFoundError if user preferences are not found
        :raises SensitivePersonalDataNotAvailableError if sensitive personal data is not available for the user
        :raise Exception if any other error occurs
        """
        raise NotImplementedError()

    @abstractmethod
    async def skip(self, user_id: str):
        """
        Skip providing sensitive personal data. If the sensitive data already exists for the given user id, it will raise a DuplicateSensitivePersonalDataError.

        :param user_id: the user id
        :return: None - if successful
        :raises DuplicateSensitivePersonalDataError if sensitive personal data already exists for the given user id
        :raises UserPreferencesNotFoundError if user preferences are not found
        :raises SensitivePersonalDataRequiredError if sensitive personal data is required and cannot be skipped
        :raises SensitivePersonalDataNotAvailableError if sensitive personal data is not available for the user
        :raise Exception if any other error occurs
        """
        raise NotImplementedError()


class SensitivePersonalDataService(ISensitivePersonalDataService):
    def __init__(self, repository: ISensitivePersonalDataRepository, user_preference_repository: IUserPreferenceRepository):
        self._repository = repository
        self._user_preference_repository = user_preference_repository
        self._logger = logging.getLogger(SensitivePersonalDataService.__name__)

    async def exists_by_user_id(self, user_id: str) -> bool:
        # ensure that the user is authenticated and is creating sensitive personal data for themselves
        # before proceeding with the service handler
        sensitive_user_data = await self._repository.find_by_user_id(user_id)
        return sensitive_user_data is not None

    async def create(self, user_id: str, request_body: CreateSensitivePersonalDataRequest):
        if await self.exists_by_user_id(user_id):
            raise DuplicateSensitivePersonalDataError(user_id)

        # Get user preferences to check sensitive personal data requirement
        user_preferences = await self._user_preference_repository.get_user_preference_by_user_id(user_id)
        if user_preferences is None:
            raise UserPreferencesNotFoundError(user_id)

        requirement = user_preferences.sensitive_personal_data_requirement

        # Validate based on invite code pii requirement
        if requirement == SensitivePersonalDataRequirement.NOT_AVAILABLE.value:
            raise SensitivePersonalDataNotAvailableError(user_id)

        # Create sensitive personal data
        sensitive_personal_data = SensitivePersonalData(
            user_id=user_id,
            created_at=datetime.now(timezone.utc),
            sensitive_personal_data=request_body.sensitive_personal_data
        )
        await self._repository.create(sensitive_personal_data)

    async def skip(self, user_id: str):
        if await self.exists_by_user_id(user_id):
            raise DuplicateSensitivePersonalDataError(user_id)

        # Get user preferences to check sensitive personal data requirement
        user_preferences = await self._user_preference_repository.get_user_preference_by_user_id(user_id)
        if user_preferences is None:
            raise UserPreferencesNotFoundError(user_id)

        requirement = user_preferences.sensitive_personal_data_requirement

        # Validate based on invite code pii requirement
        if requirement == SensitivePersonalDataRequirement.REQUIRED.value:
            raise SensitivePersonalDataRequiredError(user_id)
        elif requirement == SensitivePersonalDataRequirement.NOT_AVAILABLE.value:
            raise SensitivePersonalDataNotAvailableError(user_id)

        # Create sensitive personal data with skip=True
        sensitive_personal_data = SensitivePersonalData(
            user_id=user_id,
            created_at=datetime.now(timezone.utc),
            sensitive_personal_data=None,
            sensitive_personal_data_skipped=True
        )
        await self._repository.create(sensitive_personal_data)
