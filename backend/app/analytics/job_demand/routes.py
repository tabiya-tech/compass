"""
Job-demand analytics routes.

Backs the "Top Skills In Demand (Job Postings)" chart in the admin Skills
Analytics tab.
"""
import logging
from http import HTTPStatus
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.analytics.job_demand.repository import (
    IJobDemandAnalyticsRepository,
    JobDemandAnalyticsRepository,
)
from app.analytics.job_demand.types import JobDemandStatsResponse
from app.constants.errors import HTTPErrorResponse
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication
from app.users.access_role import AccessRole, get_access_role_dependency
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings

logger = logging.getLogger(__name__)


async def _get_job_demand_analytics_repository(
    jobs_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_jobs_db),
) -> IJobDemandAnalyticsRepository:
    # Resolve the collection name the same way the /jobs endpoint does
    # (env-injected; can differ from the literal Collections.JOBS in prod).
    collection_name = MongoDbSettings().jobs_collection_name
    return JobDemandAnalyticsRepository(jobs_db, collection_name)


def add_job_demand_analytics_routes(router: APIRouter, auth: Authentication) -> None:
    """Register job-demand analytics routes on the given router."""

    @router.get(
        path="/job-demand-stats",
        response_model=JobDemandStatsResponse,
        responses={
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description=(
            "Aggregate the top in-demand skills across job postings (taxonomy-linked "
            "skills only). Optionally filter by location (province) and sector "
            "(institution sector mapped to job-category prefixes). This is an "
            "independent job-side market signal, not derived from per-user matching. "
            "Requires a valid access role (results are global — jobs are not "
            "institution-scoped, so no institution scoping is applied)."
        ),
    )
    async def _job_demand_stats(
        # Role-gated like the sibling skill_gap/skills_supply routes; no
        # institution scoping (jobs are global). Unused -> underscore name.
        _access_role: AccessRole = Depends(get_access_role_dependency(auth)),
        limit: Annotated[
            int,
            Query(ge=1, le=100, description="Maximum number of top in-demand skills to return."),
        ] = 10,
        location: Optional[str] = Query(
            default=None,
            max_length=120,
            description="Filter by province/location (job.location)",
        ),
        sector: Optional[str] = Query(
            default=None,
            max_length=120,
            description="Filter by institution sector (mapped to job.category prefixes)",
        ),
        repo: IJobDemandAnalyticsRepository = Depends(_get_job_demand_analytics_repository),
    ) -> JobDemandStatsResponse:
        try:
            return await repo.get_job_demand_stats(limit, location=location, sector=sector)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e
