import logging
from abc import ABC, abstractmethod
from typing import Any, Dict, List

from motor.motor_asyncio import AsyncIOMotorCollection

SORTABLE_FIELDS = {"title", "category", "location", "source_platform", "posted_date"}


class IJobRepository(ABC):
    """
    Interface for the Job Repository.
    Allows to mock the repository in tests.
    """

    @abstractmethod
    async def list_jobs(
        self,
        filter_query: Dict[str, Any],
        offset: int,
        limit: int,
        sort_by: str | None = None,
        sort_dir: str = "asc",
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def count_jobs(self, filter_query: Dict[str, Any]) -> int:
        pass

    @abstractmethod
    async def distinct_values(self, field: str, filter_query: Dict[str, Any]) -> List[str]:
        pass


class JobRepository(IJobRepository):
    """
    JobRepository class is responsible for managing job records in the database.
    """

    def __init__(self, collection: AsyncIOMotorCollection):
        self._collection = collection
        self._logger = logging.getLogger(self.__class__.__name__)

    @staticmethod
    def _build_sorted_pipeline(
        filter_query: Dict[str, Any],
        offset: int,
        limit: int,
        sort_by: str,
        sort_dir: str,
    ) -> List[Dict[str, Any]]:
        direction = 1 if sort_dir == "asc" else -1
        sort_text_expr: Dict[str, Any] = {
            "$trim": {"input": {"$toString": {"$ifNull": [f"${sort_by}", ""]}}}
        }
        return [
            {"$match": filter_query},
            {
                "$addFields": {
                    "__sort_missing": {"$cond": [{"$eq": [sort_text_expr, ""]}, 1, 0]},
                    "__sort_value": {"$toLower": sort_text_expr},
                }
            },
            {"$sort": {"__sort_missing": 1, "__sort_value": direction, "_id": 1}},
            {"$project": {"_id": 0, "__sort_missing": 0, "__sort_value": 0}},
            {"$skip": offset},
            {"$limit": limit + 1},
        ]

    async def list_jobs(
        self,
        filter_query: Dict[str, Any],
        offset: int,
        limit: int,
        sort_by: str | None = None,
        sort_dir: str = "asc",
    ) -> List[Dict[str, Any]]:
        if sort_by in SORTABLE_FIELDS:
            pipeline = self._build_sorted_pipeline(filter_query, offset, limit, sort_by, sort_dir)
            query = self._collection.aggregate(pipeline)
        else:
            query = self._collection.find(filter_query, projection={"_id": 0}).skip(offset).limit(limit + 1)

        docs: List[Dict[str, Any]] = []
        async for doc in query:
            docs.append(doc)
        return docs

    async def count_jobs(self, filter_query: Dict[str, Any]) -> int:
        return await self._collection.count_documents(filter_query)

    async def distinct_values(self, field: str, filter_query: Dict[str, Any]) -> List[str]:
        values = await self._collection.distinct(field, filter_query)
        return [str(v) for v in values if v]
