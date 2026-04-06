import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorCollection


class IInstitutionRepository(ABC):
    @abstractmethod
    async def search_institutions(
        self,
        keywords: Optional[str],
        province: Optional[str],
        sector: Optional[str],
        offset: int,
        limit: int,
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def count_institutions(
        self,
        keywords: Optional[str],
        province: Optional[str],
        sector: Optional[str],
    ) -> int:
        pass

    @abstractmethod
    async def get_programmes_by_institution(self, institution_id: str) -> Optional[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_institution_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        pass


class InstitutionRepository(IInstitutionRepository):
    """Handles MongoDB queries for the institutions collection."""

    _PROJECTION = {"_id": 0}
    _NAME_ONLY_PROJECTION = {"_id": 0, "name": 1}

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection
        self._logger = logging.getLogger(self.__class__.__name__)

    @staticmethod
    def _keyword_filter(keywords: str) -> Dict[str, Any]:
        """
        Build a filter that matches institutions where ALL keyword tokens appear
        somewhere across the searchable fields (name, province, sectors, programmes).
        Each token is a case-insensitive substring regex, so "kab" matches "Kabwe",
        "inst" matches "Institute", etc.
        """
        tokens = [t for t in keywords.strip().split() if t]
        if not tokens:
            return {}

        # Each token must match at least one of the searchable fields
        token_conditions = []
        for token in tokens:
            pattern = {"$regex": token, "$options": "i"}
            token_conditions.append({
                "$or": [
                    {"name": pattern},
                    {"location.province": pattern},
                    # {"sectors_covered": pattern},
                    {"programmes.name": pattern},
                ]
            })

        # All tokens must match (AND across tokens, OR across fields per token)
        return {"$and": token_conditions} if len(token_conditions) > 1 else token_conditions[0]

    def _build_filter(
        self,
        keywords: Optional[str],
        province: Optional[str],
        sector: Optional[str],
    ) -> Dict[str, Any]:
        query: Dict[str, Any] = {}
        conditions: List[Dict[str, Any]] = []

        if keywords:
            kw_filter = self._keyword_filter(keywords)
            if kw_filter:
                conditions.append(kw_filter)

        if province:
            conditions.append({"location.province": {"$regex": province, "$options": "i"}})

        if sector:
            conditions.append({"sectors_covered": {"$regex": sector, "$options": "i"}})

        if len(conditions) == 1:
            query = conditions[0]
        elif len(conditions) > 1:
            query = {"$and": conditions}

        return query

    async def search_institutions(
        self,
        keywords: Optional[str],
        province: Optional[str],
        sector: Optional[str],
        offset: int,
        limit: int,
        name_only: bool = False,
    ) -> List[Dict[str, Any]]:
        query = self._build_filter(keywords, province, sector)
        projection = self._NAME_ONLY_PROJECTION if name_only else self._PROJECTION
        cursor = self._collection.find(query, projection=projection).skip(offset).limit(limit + 1)
        docs: List[Dict[str, Any]] = []
        async for doc in cursor:
            docs.append(doc)
        return docs

    async def count_institutions(
        self,
        keywords: Optional[str],
        province: Optional[str],
        sector: Optional[str],
    ) -> int:
        query = self._build_filter(keywords, province, sector)
        return await self._collection.count_documents(query)

    async def get_programmes_by_institution(self, institution_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single institution by reg_no, returning only its name and programmes."""
        doc = await self._collection.find_one(
            {"reg_no": institution_id},
            projection={"_id": 0, "name": 1, "reg_no": 1, "programmes": 1},
        )
        return doc

    async def get_institution_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Fetch a single institution by exact name, returning only its name and programmes."""
        doc = await self._collection.find_one(
            {"name": name},
            projection={"_id": 0, "name": 1, "reg_no": 1, "programmes": 1},
        )
        return doc
