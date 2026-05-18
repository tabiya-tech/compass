"""
Job-demand analytics: rank taxonomy-linked skills across job postings.

Independent job-side signal — NOT the matching service (its matched/gap
skills are user-conditioned and would bias demand).
"""
import logging
import re
from abc import ABC, abstractmethod
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.analytics.job_demand.types import JobDemandEntry, JobDemandStatsResponse

logger = logging.getLogger(__name__)


def _province_location_match(value: str) -> dict:
    """Province filter regex for ``job.location``. Local copy of
    ``JobService._case_insensitive_space_tolerant_match`` (keep in sync) so the
    Province dropdown filters jobs as the /jobs endpoint does."""
    normalized_tokens = [re.escape(token) for token in value.strip().split() if token]
    pattern = ".*".join(normalized_tokens) if normalized_tokens else re.escape(value)
    return {"$regex": pattern, "$options": "i"}


class IJobDemandAnalyticsRepository(ABC):
    """Interface for job-demand analytics aggregation queries."""

    @abstractmethod
    async def get_job_demand_stats(
        self, limit: int, location: Optional[str] = None
    ) -> JobDemandStatsResponse:
        """Return the top in-demand skills across job postings, optionally filtered by province."""
        raise NotImplementedError()


class JobDemandAnalyticsRepository(IJobDemandAnalyticsRepository):
    """MongoDB implementation for job-demand analytics aggregation queries."""

    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        self._db = db
        self._collection_name = collection_name

    async def get_job_demand_stats(
        self, limit: int, location: Optional[str] = None
    ) -> JobDemandStatsResponse:
        """
        Rank taxonomy-linked skills across job postings.

        :param limit: max skills to return.
        :param location: optional province filter on ``job.location``.
        """
        collection = self._db.get_collection(self._collection_name)

        # Province only. TODO: Sector not applied — jobs have free-text
        # `category`, a different vocabulary than institution `sectors_covered`
        # (the Sector dropdown source); filtering here would silently mismatch.
        # Revisit with a curated institution_sector -> job.category mapping.
        base_match: dict = {}
        if location:
            base_match["location"] = _province_location_match(location)

        # Coverage-caption denominator: every posting in the filter.
        total_jobs = await collection.count_documents(base_match)

        # Diverges from JobService._extract_skills on purpose: it falls back to
        # surface_form for unlinked skills; we DROP them (demand must be
        # taxonomy-anchored) — dropped jobs still count in total_jobs/caption.
        # Label resolved via an expression ($unwind makes positional
        # linked_entities.0.label unreliable).
        facet_results = await collection.aggregate([
            {"$match": base_match},
            {"$unwind": "$classification.entities"},
            {"$match": {"classification.entities.entity_type": "skill"}},
            {"$project": {
                "job_key": {"$ifNull": ["$uuid", {"$toString": "$_id"}]},
                "skill_label": {
                    "$arrayElemAt": [
                        {"$ifNull": ["$classification.entities.linked_entities.label", []]},
                        0,
                    ]
                },
            }},
            # Keep only skill entities that actually linked to a non-empty label.
            {"$match": {"skill_label": {"$type": "string", "$ne": ""}}},
            # Dedupe per job: a posting listing the same skill twice counts once.
            {"$group": {"_id": {"job_key": "$job_key", "skill_label": "$skill_label"}}},
            {"$facet": {
                "ranking": [
                    {"$group": {"_id": "$_id.skill_label", "jobs_count": {"$sum": 1}}},
                    # _id (skill label) is a stable tiebreak for equal counts.
                    {"$sort": {"jobs_count": -1, "_id": 1}},
                    {"$limit": limit},
                ],
                "jobs_with_linked_skills": [
                    {"$group": {"_id": "$_id.job_key"}},
                    {"$count": "n"},
                ],
            }},
        ]).to_list(length=1)

        facet = facet_results[0] if facet_results else {}

        bucket = facet.get("jobs_with_linked_skills") or []
        jobs_with_linked_skills = bucket[0]["n"] if bucket else 0

        top_skills_in_demand = [
            JobDemandEntry(skill_label=r["_id"], jobs_count=r["jobs_count"])
            for r in facet.get("ranking", [])
        ]

        return JobDemandStatsResponse(
            total_jobs=total_jobs,
            jobs_with_linked_skills=jobs_with_linked_skills,
            top_skills_in_demand=top_skills_in_demand,
        )
