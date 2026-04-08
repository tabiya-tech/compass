from abc import ABC, abstractmethod
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorCollection

from app.programme_skills.types import ProgrammeSkillsDocument


class IProgrammeSkillsRepository(ABC):
    @abstractmethod
    async def find_by_programme_name(self, programme_name: str) -> Optional[ProgrammeSkillsDocument]:
        raise NotImplementedError()


class ProgrammeSkillsRepository(IProgrammeSkillsRepository):
    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection

    async def find_by_programme_name(self, programme_name: str) -> Optional[ProgrammeSkillsDocument]:
        import re
        escaped = re.escape(programme_name)
        # Try exact match first, then partial: stored name is a substring of programme_name or vice versa
        queries = [
            {"programme_name": {"$regex": f"^{escaped}$", "$options": "i"}},
            {"programme_name": {"$regex": escaped, "$options": "i"}},
        ]
        for query in queries:
            doc = await self._collection.find_one(query, projection={"_id": 0})
            if doc is not None:
                return ProgrammeSkillsDocument(**doc)
        # Try matching any word from the stored name against programme_name
        # by searching for docs where programme_name is contained in the user's value
        cursor = self._collection.find({}, projection={"_id": 0, "programme_name": 1})
        user_prog_lower = programme_name.lower()
        async for candidate in cursor:
            stored = candidate.get("programme_name", "")
            if stored.lower() in user_prog_lower:
                doc = await self._collection.find_one(
                    {"programme_name": stored}, projection={"_id": 0}
                )
                if doc is not None:
                    return ProgrammeSkillsDocument(**doc)
        return None
