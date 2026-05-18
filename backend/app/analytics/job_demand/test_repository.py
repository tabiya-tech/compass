"""
Tests for the job-demand analytics repository.
"""
from typing import Any, Awaitable, Optional

import pytest
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.analytics.job_demand.repository import JobDemandAnalyticsRepository
from app.analytics.job_demand.types import JobDemandStatsResponse
from app.server_dependencies.database_collections import Collections

_COLLECTION = Collections.JOBS


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _linked_skill(label: str) -> dict:
    """A skill entity whose first linked entity carries the given label."""
    return {"entity_type": "skill", "surface_form": label.lower(),
            "linked_entities": [{"label": label}]}


def _unlinked_skill(surface_form: str) -> dict:
    """A skill entity the NEL step failed to link to the taxonomy."""
    return {"entity_type": "skill", "surface_form": surface_form, "linked_entities": []}


def _labelless_linked_skill() -> dict:
    """A skill entity linked to an entry that has no usable label."""
    return {"entity_type": "skill", "surface_form": "x", "linked_entities": [{"id": "no-label"}]}


def _job(*, location: str, entities: Optional[list[dict]] = None,
         uuid: Optional[str] = None) -> dict:
    doc: dict[str, Any] = {"title": "Some Job", "location": location}
    if uuid is not None:
        doc["uuid"] = uuid
    if entities is not None:
        doc["classification"] = {"entities": entities}
    return doc


# ---------------------------------------------------------------------------
# Shared fixture
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
async def populated_repository(
    in_memory_jobs_database: Awaitable[AsyncIOMotorDatabase],
) -> JobDemandAnalyticsRepository:
    """
    Seeds a jobs collection covering every branch:

      j1 (Lusaka, Lusaka, Zambia) : Python, SQL  + one unlinked
      j2 (Lusaka)                 : Python (x2 -> dedupe), Excel
      j3 (Copperbelt)             : Python
      j4 (Lusaka)                 : no classification at all
      j5 (Lusaka)                 : only an unlinked skill + a non-skill entity
      j6 (Lusaka, no uuid)        : SQL
      j7 (Lusaka, no uuid)        : Welding
      j8 (Lusaka, no uuid)        : Welding
      j9 (Lusaka)                 : skill linked to a label-less entry only
    """
    db = await in_memory_jobs_database

    await db.get_collection(_COLLECTION).insert_many([
        _job(uuid="j1", location="Lusaka, Lusaka, Zambia",
             entities=[_linked_skill("Python"), _linked_skill("SQL"),
                       _unlinked_skill("some raw phrase")]),
        _job(uuid="j2", location="Lusaka",
             entities=[_linked_skill("Python"), _linked_skill("Python"),
                       _linked_skill("Excel")]),
        _job(uuid="j3", location="Copperbelt", entities=[_linked_skill("Python")]),
        _job(uuid="j4", location="Lusaka"),
        _job(uuid="j5", location="Lusaka",
             entities=[_unlinked_skill("raw"), {"entity_type": "occupation",
                                                "linked_entities": [{"label": "Nurse"}]}]),
        _job(location="Lusaka", entities=[_linked_skill("SQL")]),
        _job(location="Lusaka", entities=[_linked_skill("Welding")]),
        _job(location="Lusaka", entities=[_linked_skill("Welding")]),
        _job(uuid="j9", location="Lusaka", entities=[_labelless_linked_skill()]),
    ])

    return JobDemandAnalyticsRepository(db, _COLLECTION)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestGetJobDemandStats:
    @pytest.mark.asyncio
    async def test_total_jobs_counts_every_posting(
        self, populated_repository: Awaitable[JobDemandAnalyticsRepository]
    ):
        repo = await populated_repository
        result: JobDemandStatsResponse = await repo.get_job_demand_stats(limit=10)
        assert result.total_jobs == 9  # every doc, incl. ones with no skills

    @pytest.mark.asyncio
    async def test_jobs_with_linked_skills_excludes_unlinked_and_labelless(
        self, populated_repository: Awaitable[JobDemandAnalyticsRepository]
    ):
        repo = await populated_repository
        result = await repo.get_job_demand_stats(limit=10)
        # j1, j2, j3, j6, j7, j8 have a label-bearing linked skill.
        # j4 (none), j5 (only unlinked), j9 (label-less) are excluded.
        assert result.jobs_with_linked_skills == 6

    @pytest.mark.asyncio
    async def test_ranking_order_and_dedupe_per_job(
        self, populated_repository: Awaitable[JobDemandAnalyticsRepository]
    ):
        repo = await populated_repository
        result = await repo.get_job_demand_stats(limit=10)
        ranking = [(e.skill_label, e.jobs_count) for e in result.top_skills_in_demand]
        # Python: j1,j2,j3 = 3 (j2 lists it twice -> still 1 for that job)
        # SQL: j1,j6 = 2 ; Welding: j7,j8 = 2 (uuid-less -> _id fallback keeps them distinct)
        # Excel: j2 = 1 ; tie (SQL vs Welding) broken by label asc
        assert ranking == [("Python", 3), ("SQL", 2), ("Welding", 2), ("Excel", 1)]

    @pytest.mark.asyncio
    async def test_province_filter_uses_space_tolerant_match(
        self, populated_repository: Awaitable[JobDemandAnalyticsRepository]
    ):
        repo = await populated_repository
        result = await repo.get_job_demand_stats(limit=10, location="Lusaka")
        # j3 (Copperbelt) drops out; "Lusaka" still matches "Lusaka, Lusaka, Zambia".
        assert result.total_jobs == 8
        assert result.jobs_with_linked_skills == 5  # j1,j2,j6,j7,j8
        ranking = {e.skill_label: e.jobs_count for e in result.top_skills_in_demand}
        assert ranking == {"Python": 2, "SQL": 2, "Welding": 2, "Excel": 1}
        # equal counts -> stable alphabetical order
        assert [e.skill_label for e in result.top_skills_in_demand] == [
            "Python", "SQL", "Welding", "Excel"
        ]

    @pytest.mark.asyncio
    async def test_limit_is_respected(
        self, populated_repository: Awaitable[JobDemandAnalyticsRepository]
    ):
        repo = await populated_repository
        result = await repo.get_job_demand_stats(limit=2)
        assert [e.skill_label for e in result.top_skills_in_demand] == ["Python", "SQL"]

    @pytest.mark.asyncio
    async def test_empty_collection_returns_zeroes(
        self, in_memory_jobs_database: Awaitable[AsyncIOMotorDatabase]
    ):
        db = await in_memory_jobs_database
        repo = JobDemandAnalyticsRepository(db, _COLLECTION)
        result = await repo.get_job_demand_stats(limit=10)
        assert result.total_jobs == 0
        assert result.jobs_with_linked_skills == 0
        assert result.top_skills_in_demand == []

    @pytest.mark.asyncio
    async def test_province_with_no_matching_jobs(
        self, populated_repository: Awaitable[JobDemandAnalyticsRepository]
    ):
        repo = await populated_repository
        result = await repo.get_job_demand_stats(limit=10, location="Western")
        assert result.total_jobs == 0
        assert result.jobs_with_linked_skills == 0
        assert result.top_skills_in_demand == []

    @pytest.mark.asyncio
    async def test_unlinked_skill_surface_form_is_NOT_counted_diverges_from_extract_skills(
        self, populated_repository: Awaitable[JobDemandAnalyticsRepository]
    ):
        """Design lock: unlike JobService._extract_skills, unlinked skills get
        no surface_form fallback — dropped from the ranking (still counted in
        total_jobs). "some raw phrase"/"raw" must not rank; j5 (only unlinked)
        excluded from jobs_with_linked_skills."""
        repo = await populated_repository
        result = await repo.get_job_demand_stats(limit=50)
        ranked_labels = {e.skill_label for e in result.top_skills_in_demand}
        assert "some raw phrase" not in ranked_labels
        assert "raw" not in ranked_labels
        # j5's only skill is unlinked -> it is NOT among the 6 linked jobs.
        assert result.total_jobs == 9
        assert result.jobs_with_linked_skills == 6
