"""
This module contains the service layer for the sensitive personal data module.
"""
import logging
from abc import ABC, abstractmethod
from datetime import datetime

from app.users.sensitive_personal_data.types import SensitivePersonalData
from app.users.sensitive_personal_data.repository import ISensitivePersonalDataRepository

from app.users.sensitive_personal_data.types import CreateSensitivePersonalDataRequest


class DuplicateSensitivePersonalDataError(Exception):
    """
    Exception raised when Sensitive Personal Data service.
    """

    def __init__(self, user_id: str):
        super().__init__(f"Sensitive personal data already exists for user {user_id}")


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
        :raise Exception if any other error occurs
        """
        raise NotImplementedError()


class SensitivePersonalDataService(ISensitivePersonalDataService):
    def __init__(self, repository: ISensitivePersonalDataRepository):
        self._repository = repository
        self._logger = logging.getLogger(SensitivePersonalDataService.__name__)

    async def exists_by_user_id(self, user_id: str) -> bool:
        # ensure that the user is authenticated and is creating sensitive personal data for themselves
        # before proceeding with the service handler
        sensitive_user_data = await self._repository.find_by_user_id(user_id)
        return sensitive_user_data is not None

    async def create(self, user_id: str, request_body: CreateSensitivePersonalDataRequest):
        if await self.exists_by_user_id(user_id):
            raise DuplicateSensitivePersonalDataError(user_id)
        # saves sensitive personal data
        sensitive_personal_data = SensitivePersonalData(
            user_id=user_id,
            rsa_key_id=request_body.rsa_key_id,
            aes_encryption_key=request_body.aes_encryption_key,
            aes_encrypted_data=request_body.aes_encrypted_data,
            created_at=datetime.now()
        )
        await self._repository.create(sensitive_personal_data)
