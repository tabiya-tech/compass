"""
Repository for career readiness analytics aggregation queries.
"""
import logging
from abc import ABC, abstractmethod
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.analytics.career_readiness.types import (
    CareerReadinessStatsResponse,
    CompletedAllStats,
    ModuleBreakdown,
    StartedStats,
)
from app.server_dependencies.database_collections import Collections

logger = logging.getLogger(__name__)


class ICareerReadinessAnalyticsRepository(ABC):
    """Interface for career readiness analytics aggregation queries."""

    @abstractmethod
    async def get_career_readiness_stats(
        self,
        module_ids: list[str],
        module_titles: dict[str, str],
        *,
        user_ids: Optional[set[str]] = None,
    ) -> CareerReadinessStatsResponse:
        """Return aggregated career readiness stats, optionally scoped to a set of user_ids."""
        raise NotImplementedError()


class CareerReadinessAnalyticsRepository(ICareerReadinessAnalyticsRepository):
    """MongoDB implementation for career readiness analytics aggregation queries."""

    def __init__(self, application_db: AsyncIOMotorDatabase, userdata_db: AsyncIOMotorDatabase):
        self._db = application_db
        self._userdata_db = userdata_db

    async def _resolve_user_ids(
        self,
        *,
        institution: Optional[str] = None,
        location: Optional[str] = None,
        program: Optional[str] = None,
        year: Optional[str] = None,
    ) -> Optional[set[str]]:
        """
        Return the set of user_ids matching the given demographic filters from PLAIN_PERSONAL_DATA.
        Returns None if no filters are given (meaning: all users).
        """
        match_filter: dict = {}
        if institution:
            match_filter["data.institution_name"] = {"$eq": institution}
        if location:
            match_filter["data.location"] = {"$eq": location}
        if program:
            match_filter["data.programme_name"] = {"$eq": program}
        if year:
            match_filter["data.school_year"] = {"$eq": year}

        if not match_filter:
            return None

        docs = await self._userdata_db.get_collection(
            Collections.PLAIN_PERSONAL_DATA
        ).find(match_filter, {"user_id": 1}).to_list(length=None)
        return {d["user_id"] for d in docs if d.get("user_id")}

    async def _get_per_user_module_stats(self, user_ids: Optional[set[str]]) -> list[dict]:
        """Aggregate per-user started/completed module counts, optionally filtered by user_ids."""
        pipeline: list[dict] = []
        if user_ids is not None:
            pipeline.append({"$match": {"user_id": {"$in": list(user_ids)}}})
        pipeline.append({
            "$group": {
                "_id": "$user_id",
                "modules_started": {"$sum": 1},
                "modules_completed": {
                    "$sum": {"$cond": [{"$eq": ["$quiz_passed", True]}, 1, 0]}
                },
            }
        })
        return await self._db.get_collection(
            Collections.CAREER_READINESS_CONVERSATIONS
        ).aggregate(pipeline).to_list(length=None)

    async def _get_per_module_stats(self, user_ids: Optional[set[str]]) -> list[dict]:
        """Aggregate started/completed counts per module_id, optionally filtered by user_ids."""
        pipeline: list[dict] = []
        if user_ids is not None:
            pipeline.append({"$match": {"user_id": {"$in": list(user_ids)}}})
        pipeline.append({
            "$group": {
                "_id": "$module_id",
                "started_count": {"$sum": 1},
                "completed_count": {
                    "$sum": {"$cond": [{"$eq": ["$quiz_passed", True]}, 1, 0]}
                },
            }
        })
        return await self._db.get_collection(
            Collections.CAREER_READINESS_CONVERSATIONS
        ).aggregate(pipeline).to_list(length=None)

    async def _count_registered_students(self, user_ids: Optional[set[str]]) -> int:
        """Count registered students in scope (from USER_PREFERENCES or filtered set)."""
        if user_ids is not None:
            return len(user_ids)
        return await self._db.get_collection(Collections.USER_PREFERENCES).count_documents({})

    async def get_career_readiness_stats(
        self,
        module_ids: list[str],
        module_titles: dict[str, str],
        *,
        user_ids: Optional[set[str]] = None,
    ) -> CareerReadinessStatsResponse:
        """
        Aggregate career readiness stats, optionally scoped to a set of user_ids.

        :param module_ids: Ordered list of module IDs from the module registry.
        :param module_titles: Mapping of module_id → display title.
        :param user_ids: If provided, restrict stats to this set of user_ids.
        """
        total_modules = len(module_ids)
        total_students = await self._count_registered_students(user_ids)

        user_stats = await self._get_per_user_module_stats(user_ids)
        started_count = len(user_stats)
        completed_all_count = sum(
            1 for u in user_stats if u["modules_completed"] >= total_modules
        )
        avg_completed = (
            sum(u["modules_completed"] for u in user_stats) / started_count
            if started_count > 0 else 0.0
        )

        module_stats_by_id = {m["_id"]: m for m in await self._get_per_module_stats(user_ids)}
        module_breakdown = [
            ModuleBreakdown(
                module_id=mid,
                module_title=module_titles.get(mid, mid),
                started_count=module_stats_by_id.get(mid, {}).get("started_count", 0),
                completed_count=module_stats_by_id.get(mid, {}).get("completed_count", 0),
            )
            for mid in module_ids
        ]

        return CareerReadinessStatsResponse(
            total_registered_students=total_students,
            started=StartedStats(
                count=started_count,
                percentage=round(started_count / total_students * 100, 1) if total_students > 0 else 0.0,
            ),
            completed_all_modules=CompletedAllStats(
                count=completed_all_count,
                percentage_of_started=round(completed_all_count / started_count * 100, 1) if started_count > 0 else 0.0,
            ),
            avg_modules_completed=round(avg_completed, 1),
            total_modules=total_modules,
            module_breakdown=module_breakdown,
        )
