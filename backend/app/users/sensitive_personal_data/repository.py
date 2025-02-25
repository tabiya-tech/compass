"""
Sensitive Personal Data Repository
"""

import logging
from typing import Optional, AsyncIterator

from abc import ABC, abstractmethod
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections
from app.users.sensitive_personal_data.types import SensitivePersonalData


class ISensitivePersonalDataRepository(ABC):
    """
    Interface for the Sensitive Personal Data Repository

    Allows to mock the repository in tests
    """

    @abstractmethod
    async def find_by_user_id(self, user_id: str) -> Optional[SensitivePersonalData]:
        """
        Find sensitive user data by user_id

        :param user_id: user_id
        :return: The found sensitive personal data or None if not found
        """
        raise NotImplementedError()

    @abstractmethod
    async def create(self, sensitive_personal_data: SensitivePersonalData) -> Optional[str]:
        """
        saves new sensitive personal data in the database

        :param sensitive_personal_data: sensitive personal data
        :return: str: the inserted document id
        """
        raise NotImplementedError()

    @abstractmethod
    async def stream(self, discard_skipped: bool, batch_size: int = 100) -> AsyncIterator[SensitivePersonalData]:
        """
        Stream all sensitive personal data in batches

        :param discard_skipped: whether skipped sensitive data entries are included in stream
        :param batch_size: batch size
        :return: AsyncIterator[SensitivePersonalData] - the sensitive personal data
        """
        raise NotImplementedError()


class SensitivePersonalDataRepository(ISensitivePersonalDataRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
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

    async def stream(self, discard_skipped: bool, batch_size: int = 100) -> AsyncIterator[SensitivePersonalData]:
        cursor = self._collection.find({}).sort("user_id", 1).batch_size(batch_size)

        async for document in cursor:
            sensitive_data = SensitivePersonalData.from_dict(document)
            if discard_skipped and sensitive_data.sensitive_personal_data is None:
                continue
            yield sensitive_data
