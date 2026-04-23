"""
Repository for career explorer analytics aggregation queries.
"""
import hashlib
import logging
from abc import ABC, abstractmethod
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.analytics.career_explorer.types import (
    CareerExplorerStatsResponse,
    CountPercentage,
    SectorStat,
)
from app.metrics.constants import EventType
from app.server_dependencies.database_collections import Collections

logger = logging.getLogger(__name__)


def _anonymize(user_id: str) -> str:
    return hashlib.md5(user_id.encode(), usedforsecurity=False).hexdigest()


class ICareerExplorerAnalyticsRepository(ABC):
    """Interface for career explorer analytics aggregation queries."""

    @abstractmethod
    async def get_career_explorer_stats(
        self,
        *,
        user_ids: Optional[set[str]] = None,
    ) -> CareerExplorerStatsResponse:
        """Return aggregated career explorer stats, optionally scoped to a set of user_ids."""
        raise NotImplementedError()


class CareerExplorerAnalyticsRepository(ICareerExplorerAnalyticsRepository):
    """MongoDB implementation for career explorer analytics aggregation queries."""

    def __init__(
        self,
        career_explorer_db: AsyncIOMotorDatabase,
        application_db: AsyncIOMotorDatabase,
        metrics_db: AsyncIOMotorDatabase,
        userdata_db: AsyncIOMotorDatabase,
    ):
        self._ce_conversations = career_explorer_db.get_collection(Collections.CAREER_EXPLORER_CONVERSATIONS)
        self._prefs = application_db.get_collection(Collections.USER_PREFERENCES)
        self._metrics = metrics_db.get_collection(Collections.COMPASS_METRICS)
        self._userdata = userdata_db.get_collection(Collections.PLAIN_PERSONAL_DATA)

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

        docs = await self._userdata.find(match_filter, {"user_id": 1}).to_list(length=None)
        return {d["user_id"] for d in docs if d.get("user_id")}

    async def _count_registered_students(self, user_ids: Optional[set[str]]) -> int:
        """Count registered students in scope (from USER_PREFERENCES or filtered set)."""
        if user_ids is not None:
            return len(user_ids)
        return await self._prefs.count_documents({})

    async def _get_started_user_ids(self, user_ids: Optional[set[str]]) -> set[str]:
        """Return user_ids that have at least one career explorer conversation."""
        pipeline: list[dict] = []
        if user_ids is not None:
            pipeline.append({"$match": {"user_id": {"$in": list(user_ids)}}})
        pipeline.append({"$group": {"_id": "$user_id"}})
        docs = await self._ce_conversations.aggregate(pipeline).to_list(length=None)
        return {d["_id"] for d in docs if d["_id"]}

    async def _get_returned_anon_ids(self, scope_anon_ids: Optional[set[str]]) -> set[str]:
        """
        Return anonymized_user_ids where sum of inquiry_count across all sectors >= 2.
        Optionally restricted to the given set of anonymized user ids.
        """
        pipeline: list[dict] = [
            {"$match": {"event_type": {"$eq": EventType.SECTOR_ENGAGEMENT.value}}},
        ]
        if scope_anon_ids is not None:
            pipeline.append({"$match": {"anonymized_user_id": {"$in": list(scope_anon_ids)}}})
        pipeline += [
            {"$group": {
                "_id": "$anonymized_user_id",
                "total_inquiries": {"$sum": "$inquiry_count"},
            }},
            {"$match": {"total_inquiries": {"$gte": 2}}},
        ]
        docs = await self._metrics.aggregate(pipeline).to_list(length=None)
        return {d["_id"] for d in docs if d["_id"]}

    async def _get_sector_stats(self, scope_anon_ids: Optional[set[str]]) -> list[dict]:
        """Aggregate sector engagement stats, optionally scoped to a set of anonymized user ids."""
        pipeline: list[dict] = [
            {"$match": {"event_type": {"$eq": EventType.SECTOR_ENGAGEMENT.value}}},
        ]
        if scope_anon_ids is not None:
            pipeline.append({"$match": {"anonymized_user_id": {"$in": list(scope_anon_ids)}}})
        pipeline += [
            {"$group": {
                "_id": "$sector_name",
                "is_priority": {"$first": "$is_priority"},
                "total_inquiries": {"$sum": "$inquiry_count"},
                "unique_users": {"$addToSet": "$anonymized_user_id"},
            }},
            {"$project": {
                "_id": 0,
                "sector_name": "$_id",
                "is_priority": 1,
                "total_inquiries": 1,
                "unique_users": {"$size": "$unique_users"},
            }},
            {"$sort": {"total_inquiries": -1}},
        ]
        return await self._metrics.aggregate(pipeline).to_list(length=None)

    async def get_career_explorer_stats(
        self,
        *,
        user_ids: Optional[set[str]] = None,
    ) -> CareerExplorerStatsResponse:
        """
        Aggregate career explorer stats, optionally scoped to a set of user_ids.

        :param user_ids: If provided, restrict stats to this set of user_ids.
        """
        total_students = await self._count_registered_students(user_ids)

        # Get started user_ids (plain), then anonymize for metrics queries
        started_user_ids = await self._get_started_user_ids(user_ids)
        started_count = len(started_user_ids)

        # Compute scope of anon_ids for metrics queries
        if user_ids is not None:
            scope_anon_ids = {_anonymize(uid) for uid in user_ids}
        else:
            scope_anon_ids = None

        returned_anon_ids = await self._get_returned_anon_ids(scope_anon_ids)
        returned_count = len(returned_anon_ids)

        sector_stats_raw = await self._get_sector_stats(scope_anon_ids)

        priority_users: set[str] = set()
        non_priority_users: set[str] = set()
        top_sectors: list[SectorStat] = []

        for s in sector_stats_raw:
            stat = SectorStat(
                sector_name=s["sector_name"],
                is_priority=bool(s.get("is_priority", False)),
                unique_users=s["unique_users"],
                total_inquiries=s["total_inquiries"],
            )
            top_sectors.append(stat)

        # Re-aggregate priority vs non-priority user counts from raw data
        # (unique_users is a count, not a set, so we query separately for sets)
        pipeline_priority: list[dict] = [
            {"$match": {"event_type": {"$eq": EventType.SECTOR_ENGAGEMENT.value}, "is_priority": True}},
        ]
        if scope_anon_ids is not None:
            pipeline_priority.insert(1, {"$match": {"anonymized_user_id": {"$in": list(scope_anon_ids)}}})
        pipeline_priority.append({"$group": {"_id": "$anonymized_user_id"}})
        priority_docs = await self._metrics.aggregate(pipeline_priority).to_list(length=None)
        priority_user_count = len(priority_docs)

        pipeline_non_priority: list[dict] = [
            {"$match": {"event_type": {"$eq": EventType.SECTOR_ENGAGEMENT.value}, "is_priority": {"$ne": True}}},
        ]
        if scope_anon_ids is not None:
            pipeline_non_priority.insert(1, {"$match": {"anonymized_user_id": {"$in": list(scope_anon_ids)}}})
        pipeline_non_priority.append({"$group": {"_id": "$anonymized_user_id"}})
        non_priority_docs = await self._metrics.aggregate(pipeline_non_priority).to_list(length=None)
        non_priority_user_count = len(non_priority_docs)

        return CareerExplorerStatsResponse(
            total_registered_students=total_students,
            started=CountPercentage(
                count=started_count,
                percentage=round(started_count / total_students * 100, 1) if total_students > 0 else 0.0,
            ),
            returned_2_plus=CountPercentage(
                count=returned_count,
                percentage=round(returned_count / started_count * 100, 1) if started_count > 0 else 0.0,
            ),
            priority_sector_users=priority_user_count,
            non_priority_sector_users=non_priority_user_count,
            top_sectors=top_sectors,
        )
