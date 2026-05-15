import asyncio
import base64
import hashlib
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.analytics.types import User

logger = logging.getLogger(__name__)

def _anonymize(user_id: str) -> str:
    return hashlib.md5(user_id.encode(), usedforsecurity=False).hexdigest()


class UsersRepository:
    def __init__(
        self,
        application_db: AsyncIOMotorDatabase,
        userdata_db: AsyncIOMotorDatabase,
        metrics_db: AsyncIOMotorDatabase,
        career_explorer_db: AsyncIOMotorDatabase,
    ):
        self._prefs_collection = application_db.get_collection(Collections.USER_PREFERENCES)
        self._plain_data_collection = userdata_db.get_collection(Collections.PLAIN_PERSONAL_DATA)
        self._metrics_collection = metrics_db.get_collection(Collections.COMPASS_METRICS)
        self._cr_collection = application_db.get_collection(Collections.CAREER_READINESS_CONVERSATIONS)
        self._sd_collection = application_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)
        self._ce_collection = career_explorer_db.get_collection(Collections.CAREER_EXPLORER_CONVERSATIONS)

    async def _get_user_ids_by_filters(
        self,
        institution: Optional[str] = None,
        province: Optional[str] = None,
        programme: Optional[str] = None,
        year: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Optional[list[str]]:
        """
        Return a filtered list of user_ids from plain_personal_data based on the given filters.
        Returns None if no filters are given (meaning: all users).
        """
        filter_dict: dict = {}
        if institution is not None:
            filter_dict["data.institution_name"] = institution
        if province is not None:
            filter_dict["data.province"] = province
        if programme is not None:
            filter_dict["data.programme_name"] = programme
        if year is not None:
            filter_dict["data.school_year"] = year
        if search is not None:
            filter_dict["$or"] = [
                {"data.institution_name": {"$regex": search, "$options": "i"}},
                {"data.programme_name": {"$regex": search, "$options": "i"}},
                {"data.school_year": {"$regex": search, "$options": "i"}},
            ]

        if not filter_dict:
            return None

        ppd = await self._plain_data_collection.find(filter_dict, {"user_id": 1}).to_list(length=None)
        ids = [d["user_id"] for d in ppd if d.get("user_id")]
        return ids

    async def _get_plain_data_by_user_ids(self, user_ids: list[str]) -> dict[str, dict]:
        """Return a mapping of user_id -> plain data dict for the given user_ids."""
        docs = await self._plain_data_collection.find(
            {"user_id": {"$in": user_ids}}
        ).to_list(length=None)
        return {d["user_id"]: d.get("data", {}) for d in docs}

    async def _get_cr_stats_by_user_ids(self, user_ids: list[str]) -> dict[str, tuple[int, int, Optional[str]]]:
        """
        Return per-user career readiness stats: (modules_explored, cr_modules_explored, last_active_module).
        modules_explored = count of conversation records
        cr_modules_explored = count where quiz_passed=True
        last_active_module = module_id of most recently updated conversation
        """
        pipeline = [
            {"$match": {"user_id": {"$in": user_ids}}},
            {"$sort": {"updated_at": -1}},
            {
                "$group": {
                    "_id": "$user_id",
                    "modules_explored": {"$sum": 1},
                    "cr_modules_explored": {
                        "$sum": {"$cond": [{"$eq": ["$quiz_passed", True]}, 1, 0]}
                    },
                    "last_active_module": {"$first": "$module_id"},
                }
            },
        ]
        docs = await self._cr_collection.aggregate(pipeline).to_list(length=None)
        return {
            d["_id"]: (d["modules_explored"], d["cr_modules_explored"], d.get("last_active_module"))
            for d in docs
        }

    async def _get_sd_explored_by_user_ids(self, user_ids: list[str]) -> dict[str, int]:
        """
        Return per-user count of explored_experiences from explore_experiences_director_state.
        Requires mapping session_id -> user_id via user_preferences.sessions.
        """
        # Build session_id -> user_id map for the given users
        prefs_docs = await self._prefs_collection.find(
            {"user_id": {"$in": user_ids}},
            {"user_id": 1, "sessions": 1, "_id": 0}
        ).to_list(length=None)

        session_to_user: dict = {}
        for doc in prefs_docs:
            uid = doc.get("user_id")
            if not uid:
                continue
            for s in doc.get("sessions", []):
                session_to_user[s] = uid
                session_to_user[str(s)] = uid

        if not session_to_user:
            return {}

        session_ids = list(session_to_user.keys())
        sd_docs = await self._sd_collection.find(
            {"session_id": {"$in": session_ids}},
            {"session_id": 1, "explored_experiences": 1, "_id": 0}
        ).to_list(length=None)

        # Deduplicate by user_id (take max explored count)
        result: dict[str, int] = {}
        for doc in sd_docs:
            sid = doc.get("session_id")
            uid = session_to_user.get(sid) or session_to_user.get(str(sid))
            if not uid:
                continue
            explored = doc.get("explored_experiences")
            count = len(explored) if isinstance(explored, list) else 0
            if uid not in result or count > result[uid]:
                result[uid] = count

        return result

    async def _get_sd_status_by_user_ids(self, user_ids: list[str]) -> dict[str, str]:
        """
        Return per-user skills discovery status: "completed", "in_progress", or "not_started".

        Completed: conversation_phase == "DIVE_IN" AND explored_experiences is non-empty.
        In-progress: a session document exists but not completed.
        Not started: no session document.
        """
        prefs_docs = await self._prefs_collection.find(
            {"user_id": {"$in": user_ids}},
            {"user_id": 1, "sessions": 1, "_id": 0}
        ).to_list(length=None)

        session_to_user: dict = {}
        for doc in prefs_docs:
            uid = doc.get("user_id")
            if not uid:
                continue
            for s in doc.get("sessions", []):
                session_to_user[s] = uid
                session_to_user[str(s)] = uid

        if not session_to_user:
            return {}

        session_ids = list(session_to_user.keys())
        sd_docs = await self._sd_collection.find(
            {"session_id": {"$in": session_ids}},
            {"session_id": 1, "conversation_phase": 1, "explored_experiences": 1, "_id": 0}
        ).to_list(length=None)

        result: dict[str, str] = {}
        for doc in sd_docs:
            sid = doc.get("session_id")
            uid = session_to_user.get(sid) or session_to_user.get(str(sid))
            if not uid:
                continue
            # Don't downgrade a completed status
            if result.get(uid) == "completed":
                continue
            phase = doc.get("conversation_phase")
            explored = doc.get("explored_experiences")
            has_explored = isinstance(explored, list) and len(explored) > 0
            if phase == "DIVE_IN" and has_explored:
                result[uid] = "completed"
            else:
                result[uid] = "in_progress"

        return result

    async def _get_ce_messages_by_user_ids(self, user_ids: list[str]) -> dict[str, int]:
        """Return per-user count of career explorer messages sent."""
        pipeline = [
            {"$match": {"user_id": {"$in": user_ids}}},
            {"$project": {"user_id": 1, "message_count": {"$size": {"$ifNull": ["$messages", []]}}}},
            {"$group": {"_id": "$user_id", "total_messages": {"$sum": "$message_count"}}},
        ]
        docs = await self._ce_collection.aggregate(pipeline).to_list(length=None)
        return {d["_id"]: d["total_messages"] for d in docs if d["_id"]}

    async def _get_last_login_by_user_ids(self, user_ids: list[str]) -> dict[str, str]:
        """
        Return per-user last login timestamp (ISO string) from metrics collection.
        Uses anonymized_user_id (MD5 of user_id) to look up metrics events.
        """
        anon_to_user = {_anonymize(uid): uid for uid in user_ids}
        anon_ids = list(anon_to_user.keys())

        pipeline = [
            {"$match": {"anonymized_user_id": {"$in": anon_ids}}},
            {
                "$group": {
                    "_id": "$anonymized_user_id",
                    "last_timestamp": {"$max": "$timestamp"},
                }
            },
        ]
        docs = await self._metrics_collection.aggregate(pipeline).to_list(length=None)

        result: dict[str, str] = {}
        for d in docs:
            anon_id = d["_id"]
            uid = anon_to_user.get(anon_id)
            if uid and d.get("last_timestamp"):
                ts = d["last_timestamp"]
                if isinstance(ts, datetime):
                    result[uid] = ts.astimezone(timezone.utc).isoformat()
                else:
                    result[uid] = str(ts)

        return result

    async def list_users(
        self,
        *,
        active: Optional[bool] = None,
        institution: Optional[str] = None,
        province: Optional[str] = None,
        programme: Optional[str] = None,
        year: Optional[str] = None,
        search: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = 20,
    ) -> tuple[list[User], Optional[str], bool]:
        query: dict = {}
        user_ids_filter = await self._get_user_ids_by_filters(
            institution, province, programme, year, search
        )
        if user_ids_filter is not None:
            if not user_ids_filter:
                return [], None, False
            query["user_id"] = {"$in": user_ids_filter}

        if active is not None:
            if active:
                query["accepted_tc"] = {"$exists": True, "$ne": None}
            else:
                query["$or"] = [
                    {"accepted_tc": {"$exists": False}},
                    {"accepted_tc": None},
                ]

        if cursor:
            try:
                pad = 4 - len(cursor) % 4
                if pad != 4:
                    cursor = cursor + "=" * pad
                last_user_id = base64.urlsafe_b64decode(cursor).decode("utf-8")
                if "user_id" in query and "$in" in query["user_id"]:
                    query["$and"] = [
                        {"user_id": {"$in": query["user_id"]["$in"]}},
                        {"user_id": {"$gt": last_user_id}},
                    ]
                    del query["user_id"]
                else:
                    query["user_id"] = {"$gt": last_user_id}
            except (ValueError, UnicodeDecodeError) as e:
                logger.warning("Invalid pagination cursor, ignoring: %s", e)

        sort = [("user_id", 1)]
        cursor_obj = self._prefs_collection.find(query).sort(sort).limit(limit + 1)
        docs = await cursor_obj.to_list(length=limit + 1)
        has_more = len(docs) > limit
        if has_more:
            docs = docs[:limit]

        if not docs:
            return [], None, False

        user_ids = [d["user_id"] for d in docs if d.get("user_id")]

        # Fetch all enrichment data in parallel
        plain_data_map, cr_stats_map, sd_explored_map, sd_status_map, ce_messages_map, last_login_map = await asyncio.gather(
            self._get_plain_data_by_user_ids(user_ids),
            self._get_cr_stats_by_user_ids(user_ids),
            self._get_sd_explored_by_user_ids(user_ids),
            self._get_sd_status_by_user_ids(user_ids),
            self._get_ce_messages_by_user_ids(user_ids),
            self._get_last_login_by_user_ids(user_ids),
        )

        items = []
        for d in docs:
            user_id = d.get("user_id", "")
            plain = plain_data_map.get(user_id, {})
            cr = cr_stats_map.get(user_id)
            items.append(User(
                id=user_id,
                name=f"{plain.get('first_name', '')} {plain.get('last_name', '')}".strip() or None,
                institution=plain.get("institution_name"),
                province=plain.get("province"),
                programme=plain.get("programme_name"),
                qualification_type=plain.get("qualification_type"),
                year=plain.get("school_year"),
                gender=plain.get("gender"),
                active=d.get("accepted_tc") is not None,
                modules_explored=cr[0] if cr else None,
                career_readiness_modules_explored=cr[1] if cr else None,
                skills_interests_explored=sd_explored_map.get(user_id),
                skills_discovery_status=sd_status_map.get(user_id, "not_started"),
                career_explorer_messages_sent=ce_messages_map.get(user_id),
                last_login=last_login_map.get(user_id),
                last_active_module=cr[2] if cr else None,
            ))

        next_cursor = None
        if has_more and docs:
            last_id = docs[-1].get("user_id", "")
            next_cursor = base64.urlsafe_b64encode(last_id.encode()).decode().rstrip("=")

        return items, next_cursor, has_more

    async def count_users(
        self,
        *,
        active: Optional[bool] = None,
        institution: Optional[str] = None,
        province: Optional[str] = None,
        programme: Optional[str] = None,
        year: Optional[str] = None,
        search: Optional[str] = None,
    ) -> int:
        query: dict = {}
        user_ids_filter = await self._get_user_ids_by_filters(
            institution, province, programme, year, search
        )
        if user_ids_filter is not None:
            if not user_ids_filter:
                return 0
            query["user_id"] = {"$in": user_ids_filter}

        if active is not None:
            if active:
                query["accepted_tc"] = {"$exists": True, "$ne": None}
            else:
                query["$or"] = [
                    {"accepted_tc": {"$exists": False}},
                    {"accepted_tc": None},
                ]

        return await self._prefs_collection.count_documents(query)


UserRepository = UsersRepository


async def get_user_repository(
    application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
    userdata_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db),
    metrics_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_metrics_db),
    career_explorer_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_career_explorer_db),
) -> UsersRepository:
    return UsersRepository(application_db, userdata_db, metrics_db, career_explorer_db)
