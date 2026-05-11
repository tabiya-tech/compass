import logging
from abc import ABC, abstractmethod
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorCollection


class IPilotWhitelistRepository(ABC):
    @abstractmethod
    async def get_whitelisted_institution_names(self) -> list[str]:
        pass

    @abstractmethod
    async def is_whitelisted(self, institution_name: str) -> bool:
        pass

    @abstractmethod
    async def get_reg_no_by_institution_name(self, institution_name: str) -> Optional[str]:
        pass


class PilotWhitelistRepository(IPilotWhitelistRepository):
    """
    Stores institution names that are hidden from the public institution search.
    Documents: { institution_name: str, reg_no: str | null }
    """

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection
        self._logger = logging.getLogger(self.__class__.__name__)

    async def get_whitelisted_institution_names(self) -> list[str]:
        cursor = self._collection.find({}, projection={"_id": 0, "institution_name": 1})
        return [doc["institution_name"] async for doc in cursor]

    async def is_whitelisted(self, institution_name: str) -> bool:
        doc = await self._collection.find_one({"institution_name": {"$eq": institution_name}})
        return doc is not None

    async def get_reg_no_by_institution_name(self, institution_name: str) -> Optional[str]:
        doc = await self._collection.find_one(
            {"institution_name": {"$eq": institution_name}},
            projection={"_id": 0, "reg_no": 1},
        )
        return doc.get("reg_no") if doc else None
