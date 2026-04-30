"""
Repository for skills discovery analytics aggregation queries.

Skills Discovery data is stored in the `explore_experiences_director_state` collection
(keyed by session_id = user_id).

Phases:
- Started: a document exists for the user
- Sharing Experiences: conversation_phase == "COLLECT_EXPERIENCES"
- Identifying Skills: conversation_phase == "DIVE_IN" AND explored_experiences is empty (or None)
- Collecting Preferences / Completed: conversation_phase == "DIVE_IN" AND explored_experiences is non-empty
"""
import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.analytics.skills_discovery.types import (
    CountWithPercentage,
    FunnelStage,
    SkillsDiscoveryStatsResponse,
)
from app.server_dependencies.database_collections import Collections

logger = logging.getLogger(__name__)

_PHASE_SHARING = "COLLECT_EXPERIENCES"
_PHASE_DIVE_IN = "DIVE_IN"


class ISkillsDiscoveryAnalyticsRepository(ABC):
    """Interface for skills discovery analytics aggregation queries."""

    @abstractmethod
    async def get_skills_discovery_stats(
        self,
        *,
        user_ids: Optional[set[str]] = None,
    ) -> SkillsDiscoveryStatsResponse:
        """Return aggregated skills discovery stats, optionally scoped to a set of user_ids."""
        raise NotImplementedError()

    @abstractmethod
    async def get_started_and_completed_user_ids(self) -> tuple[set[str], set[str]]:
        """Return (started_user_ids, completed_user_ids) for skills discovery."""
        raise NotImplementedError()


class SkillsDiscoveryAnalyticsRepository(ISkillsDiscoveryAnalyticsRepository):
    """MongoDB implementation for skills discovery analytics aggregation queries."""

    def __init__(self, application_db: AsyncIOMotorDatabase, userdata_db: AsyncIOMotorDatabase):
        self._db = application_db
        self._userdata_db = userdata_db
        self._sd_collection = application_db.get_collection(
            Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE
        )
        self._prefs_collection = application_db.get_collection(Collections.USER_PREFERENCES)

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

    async def _get_session_ids_for_users(self, user_ids: set[str]) -> set:
        """
        Expand a set of user_ids to all their session_ids via user_preferences.sessions.
        Sessions can be stored as strings or integers, so we collect both forms.
        """
        docs = await self._db.get_collection(
            Collections.USER_PREFERENCES
        ).find(
            {"user_id": {"$in": list(user_ids)}},
            {"sessions": 1, "_id": 0}
        ).to_list(length=None)
        session_ids: set = set()
        for doc in docs:
            for s in doc.get("sessions", []):
                session_ids.add(s)
                # Also add string form in case session_id is stored differently
                session_ids.add(str(s))
        return session_ids

    async def _get_all_user_id_to_sessions(self) -> dict[str, set]:
        """
        Return a mapping of user_id -> set of session_ids from user_preferences.
        Also build a reverse map: session_id -> user_id.
        """
        docs = await self._db.get_collection(
            Collections.USER_PREFERENCES
        ).find({}, {"user_id": 1, "sessions": 1, "_id": 0}).to_list(length=None)
        session_to_user: dict = {}
        for doc in docs:
            uid = doc.get("user_id")
            if not uid:
                continue
            for s in doc.get("sessions", []):
                session_to_user[s] = uid
                session_to_user[str(s)] = uid
        return session_to_user

    async def get_started_and_completed_user_ids(self) -> tuple[set[str], set[str]]:
        """
        Return (started_user_ids, completed_user_ids) for skills discovery (global, unfiltered).

        Looks up session_ids from explore_experiences_director_state, then maps them
        back to user_ids via user_preferences.sessions.

        Started: any session document exists.
        Completed: conversation_phase == "DIVE_IN" AND explored_experiences is non-empty.
        """
        pipeline = [
            {"$project": {
                "session_id": 1,
                "conversation_phase": 1,
                "explored_experiences_count": {
                    "$cond": [
                        {"$isArray": "$explored_experiences"},
                        {"$size": "$explored_experiences"},
                        0,
                    ]
                },
            }},
        ]
        sd_docs, session_to_user = await asyncio.gather(
            self._sd_collection.aggregate(pipeline).to_list(length=None),
            self._get_all_user_id_to_sessions(),
        )

        started: set[str] = set()
        completed: set[str] = set()
        for doc in sd_docs:
            sid = doc.get("session_id")
            if sid is None:
                continue
            uid = session_to_user.get(sid) or session_to_user.get(str(sid))
            if not uid:
                continue
            started.add(uid)
            if doc.get("conversation_phase") == _PHASE_DIVE_IN and doc.get("explored_experiences_count", 0) > 0:
                completed.add(uid)

        return started, completed

    async def get_skills_discovery_stats(
        self,
        *,
        user_ids: Optional[set[str]] = None,
    ) -> SkillsDiscoveryStatsResponse:
        """
        Aggregate skills discovery stats, optionally scoped to a set of user_ids.

        :param user_ids: If provided, restrict stats to this set of user_ids.
        """
        # Count total registered students — use USER_PREFERENCES as the source of truth
        # to be consistent with the dashboard stats card and avoid started% > 100%.
        if user_ids is not None:
            total_students = len(user_ids)
        else:
            total_students = await self._prefs_collection.count_documents({})

        # Expand user_ids to session_ids, and build reverse map for counting
        session_to_user = await self._get_all_user_id_to_sessions()

        # Aggregate from explore_experiences_director_state
        pipeline: list[dict] = []
        if user_ids is not None:
            # Get all session_ids belonging to the filtered user_ids
            scoped_sessions = [sid for sid, uid in session_to_user.items() if uid in user_ids]
            pipeline.append({"$match": {"session_id": {"$in": scoped_sessions}}})
        pipeline.append({
            "$project": {
                "session_id": 1,
                "conversation_phase": 1,
                "explored_experiences_count": {
                    "$cond": [
                        {"$isArray": "$explored_experiences"},
                        {"$size": "$explored_experiences"},
                        0,
                    ]
                },
            }
        })

        docs = await self._sd_collection.aggregate(pipeline).to_list(length=None)

        # Deduplicate by user_id (a user may have multiple sessions)
        seen_users: set[str] = set()
        started_count = 0
        completed_count = 0
        sharing_count = 0    # COLLECT_EXPERIENCES phase
        identifying_count = 0  # DIVE_IN but explored_experiences is empty
        collecting_count = 0   # DIVE_IN and explored_experiences non-empty

        for doc in docs:
            sid = doc.get("session_id")
            if sid is None:
                continue
            uid = session_to_user.get(sid) or session_to_user.get(str(sid))
            if not uid or uid in seen_users:
                continue
            seen_users.add(uid)
            started_count += 1
            phase = doc.get("conversation_phase")
            has_explored = doc.get("explored_experiences_count", 0) > 0

            if phase == _PHASE_SHARING:
                sharing_count += 1
            elif phase == _PHASE_DIVE_IN:
                if has_explored:
                    collecting_count += 1
                    completed_count += 1
                else:
                    identifying_count += 1

        in_progress_count = started_count - completed_count

        return SkillsDiscoveryStatsResponse(
            total_registered_students=total_students,
            started=CountWithPercentage(
                count=started_count,
                percentage=round(started_count / total_students * 100, 1) if total_students > 0 else 0.0,
            ),
            completed=CountWithPercentage(
                count=completed_count,
                percentage=round(completed_count / started_count * 100, 1) if started_count > 0 else 0.0,
            ),
            in_progress_count=in_progress_count,
            funnel=[
                FunnelStage(label="Sharing Experiences", count=sharing_count, total=started_count),
                FunnelStage(label="Identifying Skills", count=identifying_count, total=started_count),
                FunnelStage(label="Collecting Preferences", count=collecting_count, total=started_count),
            ],
        )
