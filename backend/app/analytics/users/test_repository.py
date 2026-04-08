"""
Tests for the users analytics repository.
"""
import hashlib
from datetime import datetime, timezone
from typing import Awaitable

import pytest
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.analytics.users.repository import UsersRepository
from app.server_dependencies.database_collections import Collections


def _anonymize(user_id: str) -> str:
    return hashlib.md5(user_id.encode(), usedforsecurity=False).hexdigest()


def _make_prefs(user_id: str, *, accepted_tc: str | None = "2024-01-01", sessions: list | None = None) -> dict:
    doc: dict = {"user_id": user_id}
    if accepted_tc is not None:
        doc["accepted_tc"] = accepted_tc
    if sessions is not None:
        doc["sessions"] = sessions
    return doc


def _make_plain_data(
    user_id: str,
    *,
    school: str = "Unza",
    province: str = "Lusaka",
    program: str = "Engineering",
    year: str = "2",
    first_name: str = "Alice",
    last_name: str = "",
    gender: str = "female",
) -> dict:
    return {
        "user_id": user_id,
        "data": {
            "first_name": first_name,
            "last_name": last_name,
            "institution_name": school,
            "province": province,
            "programme_name": program,
            "school_year": year,
            "gender": gender,
        }
    }


def _make_cr_conversation(conversation_id: str, user_id: str, module_id: str, *,
                           quiz_passed: bool, updated_at: datetime | None = None) -> dict:
    doc = {"conversation_id": conversation_id, "user_id": user_id, "module_id": module_id, "quiz_passed": quiz_passed}
    if updated_at is not None:
        doc["updated_at"] = updated_at
    return doc


def _make_sd_state(session_id: str, explored_experiences: list) -> dict:
    return {"session_id": session_id, "explored_experiences": explored_experiences}


def _make_metric_event(user_id: str, timestamp: datetime) -> dict:
    return {"anonymized_user_id": _anonymize(user_id), "timestamp": timestamp}


@pytest.fixture(scope="function")
async def three_dbs(
    in_memory_application_database: Awaitable[AsyncIOMotorDatabase],
    in_memory_userdata_database: Awaitable[AsyncIOMotorDatabase],
    in_memory_metrics_database: Awaitable[AsyncIOMotorDatabase],
) -> tuple[AsyncIOMotorDatabase, AsyncIOMotorDatabase, AsyncIOMotorDatabase]:
    app_db = await in_memory_application_database
    userdata_db = await in_memory_userdata_database
    metrics_db = await in_memory_metrics_database
    return app_db, userdata_db, metrics_db


@pytest.fixture(scope="function")
async def populated_repository(
    three_dbs: Awaitable[tuple[AsyncIOMotorDatabase, AsyncIOMotorDatabase, AsyncIOMotorDatabase]],
) -> UsersRepository:
    """
    Fixture that pre-populates the three DBs and returns a ready UsersRepository.

    Data layout:
      - user-a: active (accepted_tc set), Unza / Lusaka / Engineering / year 2
                CR: passed m1 (updated_at=T2) and m2 (updated_at=T1); SD: session-a1 with 3 skills
                metrics: last login at T3
      - user-b: active (accepted_tc set), Zesco / Copperbelt / Business / year 3
                CR: started m1 but not passed; SD: no session
                metrics: last login at T1
      - user-c: inactive (no accepted_tc), Unza / Lusaka / Law / year 1
                CR: no activity; SD: session-c1 with 2 skills
                metrics: no events
    """
    app_db, userdata_db, metrics_db = await three_dbs

    # Use naive UTC datetimes — Motor/pymongo expects naive datetimes for storage
    t1 = datetime(2024, 1, 10)
    t2 = datetime(2024, 2, 15)
    t3 = datetime(2024, 3, 20)

    # USER_PREFERENCES (application_db)
    await app_db.get_collection(Collections.USER_PREFERENCES).insert_many([
        _make_prefs("user-a", accepted_tc="2024-01-01", sessions=["session-a1"]),
        _make_prefs("user-b", accepted_tc="2024-01-05", sessions=[]),
        _make_prefs("user-c", accepted_tc=None, sessions=["session-c1"]),
    ])

    # PLAIN_PERSONAL_DATA (userdata_db)
    await userdata_db.get_collection(Collections.PLAIN_PERSONAL_DATA).insert_many([
        _make_plain_data("user-a", school="Unza", province="Lusaka", program="Engineering", year="2", first_name="Alice", last_name="", gender="female"),
        _make_plain_data("user-b", school="Zesco", province="Copperbelt", program="Business", year="3", first_name="Bob", last_name="", gender="male"),
        _make_plain_data("user-c", school="Unza", province="Lusaka", program="Law", year="1", first_name="Carol", last_name="", gender="female"),
    ])

    # CAREER_READINESS_CONVERSATIONS (application_db)
    await app_db.get_collection(Collections.CAREER_READINESS_CONVERSATIONS).insert_many([
        _make_cr_conversation("conv-a-m1", "user-a", "m1", quiz_passed=True, updated_at=t2),
        _make_cr_conversation("conv-a-m2", "user-a", "m2", quiz_passed=True, updated_at=t1),
        _make_cr_conversation("conv-b-m1", "user-b", "m1", quiz_passed=False, updated_at=t1),
    ])

    # EXPLORE_EXPERIENCES_DIRECTOR_STATE (application_db)
    await app_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE).insert_many([
        _make_sd_state("session-a1", ["skill-1", "skill-2", "skill-3"]),
        _make_sd_state("session-c1", ["skill-1", "skill-2"]),
    ])

    # COMPASS_METRICS (metrics_db)
    await metrics_db.get_collection(Collections.COMPASS_METRICS).insert_many([
        _make_metric_event("user-a", t1),
        _make_metric_event("user-a", t3),   # t3 is the most recent for user-a
        _make_metric_event("user-b", t1),
    ])

    return UsersRepository(app_db, userdata_db, metrics_db)


class TestListUsersEnrichment:
    @pytest.mark.asyncio
    async def test_returns_all_users_when_no_filters(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN a repository with 3 users
        repo = await populated_repository

        # WHEN listing with no filters
        users, next_cursor, has_more = await repo.list_users(limit=10)

        # THEN all 3 users are returned
        assert len(users) == 3
        assert has_more is False
        assert next_cursor is None

    @pytest.mark.asyncio
    async def test_user_plain_data_is_enriched_correctly(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-a has specific plain personal data
        repo = await populated_repository

        # WHEN listing users
        users, _, _ = await repo.list_users(limit=10)
        user_a = next(u for u in users if u.id == "user-a")

        # THEN the enriched fields match what was inserted
        assert user_a.name == "Alice"
        assert user_a.institution == "Unza"
        assert user_a.province == "Lusaka"
        assert user_a.programme == "Engineering"
        assert user_a.year == "2"
        assert user_a.gender == "female"

    @pytest.mark.asyncio
    async def test_active_flag_true_when_accepted_tc_set(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-a and user-b have accepted_tc; user-c does not
        repo = await populated_repository

        # WHEN listing all users
        users, _, _ = await repo.list_users(limit=10)

        # THEN active reflects whether accepted_tc is present
        by_id = {u.id: u for u in users}
        assert by_id["user-a"].active is True
        assert by_id["user-b"].active is True
        assert by_id["user-c"].active is False

    @pytest.mark.asyncio
    async def test_cr_stats_modules_explored_and_passed(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-a has 2 CR conversations (both passed); user-b has 1 (not passed)
        repo = await populated_repository

        # WHEN listing users
        users, _, _ = await repo.list_users(limit=10)
        by_id = {u.id: u for u in users}

        # THEN modules_explored and career_readiness_modules_explored are correct
        assert by_id["user-a"].modules_explored == 2
        assert by_id["user-a"].career_readiness_modules_explored == 2

        assert by_id["user-b"].modules_explored == 1
        assert by_id["user-b"].career_readiness_modules_explored == 0

        # user-c has no CR activity → None
        assert by_id["user-c"].modules_explored is None
        assert by_id["user-c"].career_readiness_modules_explored is None

    @pytest.mark.asyncio
    async def test_last_active_module_is_most_recently_updated(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-a has m1 updated at T2 (more recent) and m2 updated at T1
        repo = await populated_repository

        # WHEN listing users
        users, _, _ = await repo.list_users(limit=10)
        user_a = next(u for u in users if u.id == "user-a")

        # THEN last_active_module is the one with the latest updated_at
        assert user_a.last_active_module == "m1"

    @pytest.mark.asyncio
    async def test_skills_interests_explored_counts_list_length(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-a has session-a1 with 3 explored experiences; user-c has session-c1 with 2
        repo = await populated_repository

        # WHEN listing users
        users, _, _ = await repo.list_users(limit=10)
        by_id = {u.id: u for u in users}

        # THEN skills_interests_explored matches the list length in the SD state doc
        assert by_id["user-a"].skills_interests_explored == 3
        assert by_id["user-c"].skills_interests_explored == 2

        # user-b has no sessions → None
        assert by_id["user-b"].skills_interests_explored is None

    @pytest.mark.asyncio
    async def test_last_login_is_max_metric_timestamp(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-a has metric events at T1 and T3; user-b has one at T1; user-c has none
        repo = await populated_repository

        # WHEN listing users
        users, _, _ = await repo.list_users(limit=10)
        by_id = {u.id: u for u in users}

        # THEN user-a's last_login reflects T3 (the later of T1 and T3), user-b reflects T1, user-c is None
        # We verify ordering: user-a's last_login > user-b's last_login, and user-c has none
        assert by_id["user-a"].last_login is not None
        assert by_id["user-b"].last_login is not None
        assert by_id["user-c"].last_login is None
        # user-a's most recent event (T3=March) is later than user-b's (T1=January)
        assert by_id["user-a"].last_login > by_id["user-b"].last_login


class TestListUsersFiltering:
    @pytest.mark.asyncio
    async def test_filter_by_institution(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-a and user-c are at Unza; user-b is at Zesco
        repo = await populated_repository

        # WHEN filtering by institution=Unza
        users, _, _ = await repo.list_users(institution="Unza", limit=10)

        # THEN only Unza users are returned
        assert {u.id for u in users} == {"user-a", "user-c"}

    @pytest.mark.asyncio
    async def test_filter_by_province(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-b is in Copperbelt; user-a and user-c are in Lusaka
        repo = await populated_repository

        # WHEN filtering by province=Copperbelt
        users, _, _ = await repo.list_users(province="Copperbelt", limit=10)

        # THEN only user-b is returned
        assert {u.id for u in users} == {"user-b"}

    @pytest.mark.asyncio
    async def test_filter_by_programme(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-a is in Engineering; user-b in Business; user-c in Law
        repo = await populated_repository

        # WHEN filtering by programme=Engineering
        users, _, _ = await repo.list_users(programme="Engineering", limit=10)

        # THEN only user-a is returned
        assert {u.id for u in users} == {"user-a"}

    @pytest.mark.asyncio
    async def test_filter_by_year(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-a is year 2; user-b is year 3; user-c is year 1
        repo = await populated_repository

        # WHEN filtering by year=2
        users, _, _ = await repo.list_users(year="2", limit=10)

        # THEN only user-a is returned
        assert {u.id for u in users} == {"user-a"}

    @pytest.mark.asyncio
    async def test_filter_by_active_true(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-a and user-b have accepted_tc; user-c does not
        repo = await populated_repository

        # WHEN filtering by active=True
        users, _, _ = await repo.list_users(active=True, limit=10)

        # THEN only active users are returned
        assert {u.id for u in users} == {"user-a", "user-b"}

    @pytest.mark.asyncio
    async def test_filter_by_active_false(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-c has no accepted_tc
        repo = await populated_repository

        # WHEN filtering by active=False
        users, _, _ = await repo.list_users(active=False, limit=10)

        # THEN only user-c is returned
        assert {u.id for u in users} == {"user-c"}

    @pytest.mark.asyncio
    async def test_filter_by_search_matches_school_case_insensitively(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-a and user-c are at "Unza"; user-b at "Zesco"
        repo = await populated_repository

        # WHEN searching for "unza" (lowercase)
        users, _, _ = await repo.list_users(search="unza", limit=10)

        # THEN Unza students are matched case-insensitively
        assert {u.id for u in users} == {"user-a", "user-c"}

    @pytest.mark.asyncio
    async def test_filter_by_search_matches_program(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-b is in program "Business"
        repo = await populated_repository

        # WHEN searching for "busi"
        users, _, _ = await repo.list_users(search="busi", limit=10)

        # THEN user-b is matched
        assert {u.id for u in users} == {"user-b"}

    @pytest.mark.asyncio
    async def test_filter_no_match_returns_empty(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN no user belongs to institution "Nonexistent"
        repo = await populated_repository

        # WHEN filtering by institution=Nonexistent
        users, next_cursor, has_more = await repo.list_users(institution="Nonexistent", limit=10)

        # THEN an empty list is returned
        assert users == []
        assert next_cursor is None
        assert has_more is False

    @pytest.mark.asyncio
    async def test_combined_filters_institution_and_active(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-a is at Unza and active; user-c is at Unza but inactive
        repo = await populated_repository

        # WHEN filtering by institution=Unza AND active=True
        users, _, _ = await repo.list_users(institution="Unza", active=True, limit=10)

        # THEN only the active Unza user is returned
        assert {u.id for u in users} == {"user-a"}


class TestListUsersPagination:
    @pytest.mark.asyncio
    async def test_limit_is_respected_and_has_more_is_true(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN 3 users exist
        repo = await populated_repository

        # WHEN fetching with limit=2
        users, next_cursor, has_more = await repo.list_users(limit=2)

        # THEN 2 users are returned, has_more=True, and next_cursor is set
        assert len(users) == 2
        assert has_more is True
        assert next_cursor is not None

    @pytest.mark.asyncio
    async def test_cursor_fetches_remaining_page(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN 3 users exist, first page returns 2
        repo = await populated_repository
        first_users, cursor, _ = await repo.list_users(limit=2)
        first_ids = {u.id for u in first_users}

        # WHEN fetching the second page using the cursor
        second_users, next_cursor2, has_more2 = await repo.list_users(limit=2, cursor=cursor)

        # THEN the second page contains the remaining user and no further cursor
        assert len(second_users) == 1
        assert {u.id for u in second_users}.isdisjoint(first_ids)
        assert has_more2 is False
        assert next_cursor2 is None

    @pytest.mark.asyncio
    async def test_all_pages_together_cover_all_users(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN 3 users exist
        repo = await populated_repository

        # WHEN paginating with limit=2 until exhausted
        all_ids = set()
        cursor = None
        while True:
            users, cursor, has_more = await repo.list_users(limit=2, cursor=cursor)
            all_ids.update(u.id for u in users)
            if not has_more:
                break

        # THEN all 3 user IDs are covered with no duplicates
        assert all_ids == {"user-a", "user-b", "user-c"}


class TestCountUsers:
    @pytest.mark.asyncio
    async def test_count_all_users(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN 3 users in total
        repo = await populated_repository

        # WHEN counting with no filters
        total = await repo.count_users()

        # THEN total is 3
        assert total == 3

    @pytest.mark.asyncio
    async def test_count_active_users(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN 2 active users (user-a and user-b)
        repo = await populated_repository

        # WHEN counting active=True
        count = await repo.count_users(active=True)

        # THEN count is 2
        assert count == 2

    @pytest.mark.asyncio
    async def test_count_inactive_users(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN 1 inactive user (user-c)
        repo = await populated_repository

        # WHEN counting active=False
        count = await repo.count_users(active=False)

        # THEN count is 1
        assert count == 1

    @pytest.mark.asyncio
    async def test_count_by_institution(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN user-a and user-c are at Unza
        repo = await populated_repository

        # WHEN counting for institution=Unza
        count = await repo.count_users(institution="Unza")

        # THEN count is 2
        assert count == 2

    @pytest.mark.asyncio
    async def test_count_no_match_returns_zero(
        self, populated_repository: Awaitable[UsersRepository]
    ):
        # GIVEN no user is at "Ghost University"
        repo = await populated_repository

        # WHEN counting for that institution
        count = await repo.count_users(institution="Ghost University")

        # THEN count is 0
        assert count == 0

    @pytest.mark.asyncio
    async def test_count_empty_db_returns_zero(
        self, three_dbs: Awaitable[tuple[AsyncIOMotorDatabase, AsyncIOMotorDatabase, AsyncIOMotorDatabase]]
    ):
        # GIVEN an empty database
        app_db, userdata_db, metrics_db = await three_dbs
        repo = UsersRepository(app_db, userdata_db, metrics_db)

        # WHEN counting users
        count = await repo.count_users()

        # THEN count is 0
        assert count == 0


class TestEdgeCases:
    @pytest.mark.asyncio
    async def test_user_with_multiple_sessions_takes_max_sd_count(
        self,
        three_dbs: Awaitable[tuple[AsyncIOMotorDatabase, AsyncIOMotorDatabase, AsyncIOMotorDatabase]],
    ):
        # GIVEN user-x has two sessions with 1 and 5 explored experiences respectively
        app_db, userdata_db, metrics_db = await three_dbs

        await app_db.get_collection(Collections.USER_PREFERENCES).insert_one(
            _make_prefs("user-x", accepted_tc="2024-01-01", sessions=["sess-x1", "sess-x2"])
        )
        await app_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE).insert_many([
            _make_sd_state("sess-x1", ["s1"]),
            _make_sd_state("sess-x2", ["s1", "s2", "s3", "s4", "s5"]),
        ])

        repo = UsersRepository(app_db, userdata_db, metrics_db)

        # WHEN listing users
        users, _, _ = await repo.list_users(limit=10)

        # THEN the max explored count across sessions is used
        assert users[0].skills_interests_explored == 5

    @pytest.mark.asyncio
    async def test_user_with_no_plain_data_has_none_fields(
        self,
        three_dbs: Awaitable[tuple[AsyncIOMotorDatabase, AsyncIOMotorDatabase, AsyncIOMotorDatabase]],
    ):
        # GIVEN user-y exists in preferences but has no plain personal data
        app_db, userdata_db, metrics_db = await three_dbs

        await app_db.get_collection(Collections.USER_PREFERENCES).insert_one(
            _make_prefs("user-y", accepted_tc="2024-01-01")
        )

        repo = UsersRepository(app_db, userdata_db, metrics_db)

        # WHEN listing users
        users, _, _ = await repo.list_users(limit=10)

        # THEN demographic fields are None but active is still derived from prefs
        user_y = users[0]
        assert user_y.id == "user-y"
        assert user_y.name is None
        assert user_y.institution is None
        assert user_y.active is True

    @pytest.mark.asyncio
    async def test_sd_explored_experiences_is_none_when_no_sessions(
        self,
        three_dbs: Awaitable[tuple[AsyncIOMotorDatabase, AsyncIOMotorDatabase, AsyncIOMotorDatabase]],
    ):
        # GIVEN user-z has no sessions list in preferences
        app_db, userdata_db, metrics_db = await three_dbs

        await app_db.get_collection(Collections.USER_PREFERENCES).insert_one(
            {"user_id": "user-z", "accepted_tc": "2024-01-01"}
        )

        repo = UsersRepository(app_db, userdata_db, metrics_db)

        # WHEN listing users
        users, _, _ = await repo.list_users(limit=10)

        # THEN skills_interests_explored is None
        assert users[0].skills_interests_explored is None
