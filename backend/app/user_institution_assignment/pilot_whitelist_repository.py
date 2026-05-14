import logging
from abc import ABC, abstractmethod
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorCollection


class IPilotWhitelistRepository(ABC):
    @abstractmethod
    async def get_whitelisted_reg_nos(self) -> list[str]:
        pass

    @abstractmethod
    async def is_whitelisted_by_reg_no(self, reg_no: str) -> bool:
        pass


class PilotWhitelistRepository(IPilotWhitelistRepository):
    """
    Stores institutions that are hidden from the public institution search.
    Documents: { institution_name: str, reg_no: str | null }
    """

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection
        self._logger = logging.getLogger(self.__class__.__name__)

    async def get_whitelisted_reg_nos(self) -> list[str]:
        cursor = self._collection.find(
            {"reg_no": {"$exists": True, "$ne": None}},
            projection={"_id": 0, "reg_no": 1},
        )
        return [doc["reg_no"] async for doc in cursor]

    async def is_whitelisted_by_reg_no(self, reg_no: str) -> bool:
        doc = await self._collection.find_one({"reg_no": {"$eq": reg_no}})
        return doc is not None
