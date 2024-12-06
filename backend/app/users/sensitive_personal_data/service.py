"""
This module contains the service layer for the sensitive personal data module.
"""

from datetime import datetime

from fastapi import Depends, HTTPException

from app.constants.errors import ErrorService
from app.users.sensitive_personal_data.types import SensitivePersonalData
from app.users.sensitive_personal_data.repository import SensitivePersonalDataRepository, \
    ISensitivePersonalDataRepository

from app.users.sensitive_personal_data.types import CreateSensitivePersonalDataRequest


class SensitivePersonalDataService:
    """
    Service layer for the Sensitive Personal Data module.
    """

    # add all the required dependencies
    def __init__(self, repository: ISensitivePersonalDataRepository = Depends(SensitivePersonalDataRepository)):
        self._repository = repository

    async def exists_by_user_id(self, user_id: str) -> bool:
        """
        Check if sensitive user data exists by user_id

        :param user_id: user_id
        :return: bool - True if exists, False otherwise
        """
        try:
            sensitive_user_data = await self._repository.find_by_user_id(user_id)

            if sensitive_user_data is None:
                return False

            return True

        except Exception as e:
            ErrorService.handle(__name__, e)

    async def create(self, user_id: str, request_body: CreateSensitivePersonalDataRequest):
        """
        Create sensitive personal data
        - Check if the sensitive data already exists by user_id to avoid duplicates

        :param user_id: the user id
        :param request_body: CreateSensitivePersonalData - the request body
        :return: None - if successful
        """

        try:

            if await self.exists_by_user_id(user_id):
                raise HTTPException(status_code=409, detail="sensitive personal data already exists")

            # saves sensitive personal data
            sensitive_personal_data = SensitivePersonalData(
                user_id=user_id,
                rsa_key_id=request_body.rsa_key_id,
                aes_encryption_key=request_body.aes_encryption_key,
                aes_encrypted_data=request_body.aes_encrypted_data,
                created_at=datetime.now()
            )

            await self._repository.create(sensitive_personal_data)

        except Exception as e:
            ErrorService.handle(__name__, e)
