"""
sensitive Personal Data Repository
"""

import logging
from typing import Optional, AsyncIterator

from fastapi import Depends
from abc import ABC, abstractmethod
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.sensitive_personal_data.types import SensitivePersonalData


class ISensitivePersonalDataRepository(ABC):
    """
    Interface for the Sensitive Personal Data Repository

    Why:
        - Decouples the repository from the service
        - Allows to mock the repository in tests
    """

    @abstractmethod
    async def find_by_user_id(self, user_id: str) -> Optional[SensitivePersonalData]:
        """
        Find sensitive user data by user_id

        :param user_id: user_id
        :return: The found sensitive personal data or None if not found
        """

    @abstractmethod
    async def create(self, sensitive_personal_data: SensitivePersonalData) -> Optional[str]:
        """
        saves new sensitive personal data in the database

        :param sensitive_personal_data: sensitive personal data
        :return: str: the inserted document id
        """

    @abstractmethod
    async def stream(self, batch_size: int = 100) -> AsyncIterator[SensitivePersonalData]:
        """
        Stream all sensitive personal data in batches

        :param batch_size: batch size
        :return: AsyncIterator[SensitivePersonalData] - the sensitive personal data
        """


class SensitivePersonalDataRepository(ISensitivePersonalDataRepository):
    def __init__(self, db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_users_db)):
        self._db = db
        self._logger = logging.getLogger(SensitivePersonalDataRepository.__name__)
        self._collection = db.get_collection(Collections.SENSITIVE_PERSONAL_DATA)

    async def find_by_user_id(self, user_id: str) -> Optional[SensitivePersonalData]:
        # use $eq to ensure the user_id is an exact match and avoid no sql injection
        _doc = await self._collection.find_one({"user_id": {"$eq": user_id}})

        if _doc is None:
            return None

        return SensitivePersonalData.from_dict(_doc)

    async def create(self, sensitive_personal_data: SensitivePersonalData) -> Optional[str]:
        # convert the pydantic class to a dictionary
        payload = sensitive_personal_data.model_dump()

        _insert_results = await self._collection.insert_one(payload)

        # return the inserted document id
        return _insert_results.inserted_id.__str__()

    async def stream(self, batch_size: int = 100) -> AsyncIterator[SensitivePersonalData]:
        cursor = self._collection.find({}).batch_size(batch_size)
        async for document in cursor:
            yield SensitivePersonalData.from_dict(document)
