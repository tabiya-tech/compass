import asyncio
import base64
import hashlib
import logging
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.analytics.types import Institution
from app.analytics.skills_discovery.repository import SkillsDiscoveryAnalyticsRepository
from common_libs.time_utilities import datetime_to_mongo_date

logger = logging.getLogger(__name__)

PLAIN_DATA_SCHOOL_KEY = "institution_name"
SORTABLE_FIELDS = {
    "name",
    "students",
    "active_7_days",
    "skills_discovery_started_pct",
    "skills_discovery_completed_pct",
    "career_readiness_started_pct",
    "career_readiness_completed_pct",
    "career_explorer_started_pct",
}


def _anonymize(user_id: str) -> str:
    return hashlib.md5(user_id.encode(), usedforsecurity=False).hexdigest()


class InstitutionsRepository:
    def __init__(
        self,
        userdata_db: AsyncIOMotorDatabase,
        metrics_db: AsyncIOMotorDatabase,
        application_db: AsyncIOMotorDatabase,
        career_explorer_db: Optional[AsyncIOMotorDatabase] = None,
    ):
        self._collection = userdata_db.get_collection(Collections.PLAIN_PERSONAL_DATA)
        self._metrics_collection = metrics_db.get_collection(Collections.COMPASS_METRICS)
        self._cr_conversations = application_db.get_collection(Collections.CAREER_READINESS_CONVERSATIONS)
        self._institutions_collection = application_db.get_collection(Collections.INSTITUTIONS)
        self._sd_repo = SkillsDiscoveryAnalyticsRepository(application_db, userdata_db)
        self._ce_conversations = (
            career_explorer_db.get_collection(Collections.CAREER_EXPLORER_CONVERSATIONS)
            if career_explorer_db is not None else None
        )

    @staticmethod
    def _sort_institutions(items: list[Institution], sort_by: str, sort_dir: str) -> list[Institution]:
        safe_sort_by = sort_by if sort_by in SORTABLE_FIELDS else "name"
        reverse = sort_dir == "desc"

        if safe_sort_by == "name":
            return sorted(items, key=lambda inst: inst.name.lower(), reverse=reverse)

        def _numeric_key(selector: Callable[[Institution], Optional[float]]) -> Callable[[Institution], float]:
            if reverse:
                return lambda inst: float("-inf") if selector(inst) is None else float(selector(inst))
            return lambda inst: float("inf") if selector(inst) is None else float(selector(inst))

        selector_map: dict[str, Callable[[Institution], Optional[float]]] = {
            "students": lambda inst: float(inst.students) if inst.students is not None else None,
            "active_7_days": lambda inst: float(inst.active_7_days) if inst.active_7_days is not None else None,
            "skills_discovery_started_pct": lambda inst: inst.skills_discovery_started_pct,
            "skills_discovery_completed_pct": lambda inst: inst.skills_discovery_completed_pct,
            "career_readiness_started_pct": lambda inst: inst.career_readiness_started_pct,
            "career_readiness_completed_pct": lambda inst: inst.career_readiness_completed_pct,
            "career_explorer_started_pct": lambda inst: inst.career_explorer_started_pct,
        }

        # Ensure deterministic ordering for ties by canonical institution name.
        sorted_items = sorted(items, key=lambda inst: inst.name.lower())
        return sorted(sorted_items, key=_numeric_key(selector_map[safe_sort_by]), reverse=reverse)

    async def _get_institution_names(self) -> list[str]:
        """Fetch the canonical sorted list of institution names from the institutions collection."""
        docs = await self._institutions_collection.find(
            {}, projection={"_id": 0, "name": 1}
        ).sort("name", 1).to_list(length=None)
        return [d["name"] for d in docs if d.get("name")]

    async def _get_active_anon_ids_last_7_days(self) -> set[str]:
        """Return the set of anonymized_user_ids active in the last 7 days from metrics."""
        now = datetime.now(tz=timezone.utc)
        seven_days_ago = now - timedelta(days=7)
        start_mongo = datetime_to_mongo_date(seven_days_ago)
        pipeline = [
            {"$match": {
                "timestamp": {"$gte": start_mongo},
                "anonymized_user_id": {"$exists": True, "$ne": None},
            }},
            {"$group": {"_id": "$anonymized_user_id"}},
        ]
        results = await self._metrics_collection.aggregate(pipeline).to_list(length=None)
        return {r["_id"] for r in results}

    async def _get_counts_by_institution(self) -> dict[str, tuple[int, set[str]]]:
        """
        Return a dict mapping institution name → (student_count, set_of_user_ids).
        """
        pipeline = [
            {"$match": {f"data.{PLAIN_DATA_SCHOOL_KEY}": {"$exists": True, "$nin": [None, ""]}}},
            {"$group": {
                "_id": f"$data.{PLAIN_DATA_SCHOOL_KEY}",
                "user_ids": {"$addToSet": "$user_id"},
            }},
        ]
        docs = await self._collection.aggregate(pipeline).to_list(length=None)
        return {
            d["_id"]: (len(d["user_ids"]), set(uid for uid in d["user_ids"] if uid))
            for d in docs
        }

    async def list_institutions(
        self,
        *,
        active: Optional[bool] = None,
        province: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = 20,
        sort_by: Optional[str] = None,
        sort_dir: str = "asc",
    ) -> tuple[list[Institution], Optional[str], bool]:
        institution_names = await self._get_institution_names()

        # Apply province filter: province info is per-user, not per-institution in this model.
        # We skip province filtering at the institution level since the canonical list
        # does not carry province information. Callers who need per-province breakdown
        # should use the students endpoint.
        if province is not None:
            logger.warning("Province filter on institutions is not supported; ignoring")

        # Decode cursor (index into the sorted list)
        start_index = 0
        if cursor:
            try:
                pad = 4 - len(cursor) % 4
                decoded = base64.urlsafe_b64decode(cursor + ("=" * (pad if pad != 4 else 0))).decode()
                start_index = int(decoded)
            except (ValueError, UnicodeDecodeError) as e:
                logger.warning("Invalid pagination cursor, ignoring: %s", e)

        # Fetch MongoDB counts in parallel
        counts_by_inst, active_anon_ids, cr_started_ids, cr_completed_ids, sd_started_ids, sd_completed_ids, ce_started_ids = \
            await self._fetch_activity_data()

        all_items = []
        for name in institution_names:
            inst_id = base64.urlsafe_b64encode(name.encode()).decode().rstrip("=")
            student_count, user_ids = counts_by_inst.get(name, (0, set()))
            anon_ids = {_anonymize(uid) for uid in user_ids}
            active_count = len(anon_ids & active_anon_ids)

            def _pct(count: int, total: int = student_count) -> Optional[float]:
                if total <= 0:
                    return None
                return round(count / total * 100, 1)

            cr_started_count = len(user_ids & cr_started_ids)
            cr_completed_count = len(user_ids & cr_completed_ids)
            sd_started_count = len(user_ids & sd_started_ids)
            sd_completed_count = len(user_ids & sd_completed_ids)
            ce_started_count = len(user_ids & ce_started_ids)

            all_items.append(Institution(
                id=inst_id,
                name=name,
                active=True,
                students=student_count if student_count > 0 else None,
                active_7_days=active_count if student_count > 0 else None,
                skills_discovery_started_pct=_pct(sd_started_count),
                skills_discovery_completed_pct=_pct(sd_completed_count),
                career_readiness_started_pct=_pct(cr_started_count),
                career_readiness_completed_pct=_pct(cr_completed_count),
                career_explorer_started_pct=_pct(ce_started_count),
            ))

        if sort_by is None:
            sorted_items = all_items
        else:
            sorted_items = self._sort_institutions(all_items, sort_by=sort_by, sort_dir=sort_dir)

        # Slice the globally sorted list for pagination
        page = sorted_items[start_index:start_index + limit + 1]
        has_more = len(page) > limit
        if has_more:
            page = page[:limit]

        next_cursor: Optional[str] = None
        if has_more:
            next_idx = start_index + limit
            next_cursor = base64.urlsafe_b64encode(str(next_idx).encode()).decode().rstrip("=")

        return page, next_cursor, has_more

    async def _get_ce_started_user_ids(self) -> set[str]:
        """Return user_ids that have at least one career explorer conversation."""
        if self._ce_conversations is None:
            return set()
        docs = await self._ce_conversations.distinct("user_id")
        return {uid for uid in docs if uid}

    async def _get_cr_user_ids(self) -> tuple[set[str], set[str]]:
        """
        Return (started_user_ids, completed_user_ids) for career readiness.
        Started = has at least one conversation record.
        Completed = has at least one conversation record with quiz_passed=True.
        """
        pipeline = [
            {"$group": {
                "_id": "$user_id",
                "any_passed": {"$max": {"$cond": [{"$eq": ["$quiz_passed", True]}, 1, 0]}},
            }},
        ]
        docs = await self._cr_conversations.aggregate(pipeline).to_list(length=None)
        started = {d["_id"] for d in docs if d["_id"]}
        completed = {d["_id"] for d in docs if d["_id"] and d["any_passed"] == 1}
        return started, completed

    async def _fetch_activity_data(self) -> tuple[
        dict[str, tuple[int, set[str]]],
        set[str],
        set[str],
        set[str],
        set[str],
        set[str],
        set[str],
    ]:
        counts, active, (cr_started, cr_completed), (sd_started, sd_completed), ce_started = await asyncio.gather(
            self._get_counts_by_institution(),
            self._get_active_anon_ids_last_7_days(),
            self._get_cr_user_ids(),
            self._sd_repo.get_started_and_completed_user_ids(),
            self._get_ce_started_user_ids(),
        )
        return counts, active, cr_started, cr_completed, sd_started, sd_completed, ce_started

    async def count_institutions(
        self,
        *,
        active: Optional[bool] = None,
        province: Optional[str] = None,
    ) -> int:
        return await self._institutions_collection.count_documents({})


InstitutionRepository = InstitutionsRepository


async def get_institution_repository(
    userdata_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db),
    metrics_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_metrics_db),
    application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
    career_explorer_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_career_explorer_db),
) -> InstitutionsRepository:
    return InstitutionsRepository(userdata_db, metrics_db, application_db, career_explorer_db)
