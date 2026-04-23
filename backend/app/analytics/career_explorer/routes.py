"""
Career explorer analytics routes.
"""
import logging
from http import HTTPStatus
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.analytics.career_explorer.repository import (
    CareerExplorerAnalyticsRepository,
    ICareerExplorerAnalyticsRepository,
)
from app.analytics.career_explorer.types import CareerExplorerStatsResponse
from app.constants.errors import HTTPErrorResponse
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication

logger = logging.getLogger(__name__)


async def _get_career_explorer_analytics_repository(
    career_explorer_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_career_explorer_db),
    application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
    metrics_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_metrics_db),
    userdata_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db),
) -> ICareerExplorerAnalyticsRepository:
    return CareerExplorerAnalyticsRepository(career_explorer_db, application_db, metrics_db, userdata_db)


def add_career_explorer_analytics_routes(router: APIRouter, auth: Authentication) -> None:
    """Register career explorer analytics routes on the given router."""

    @router.get(
        path="/career-explorer-stats",
        response_model=CareerExplorerStatsResponse,
        responses={
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description=(
            "Aggregate career explorer statistics across all registered students. "
            "Optionally filter by institution (school), location (province), program (qualification), "
            "and year. Returns started/returned rates, top sectors, and priority/non-priority split."
        ),
    )
    async def _career_explorer_stats(
        institution: Optional[str] = Query(default=None, description="Filter by institution name (data.school)"),
        location: Optional[str] = Query(default=None, description="Filter by province/location (data.location)"),
        program: Optional[str] = Query(default=None, description="Filter by program/qualification (data.program)"),
        year: Optional[str] = Query(default=None, description="Filter by academic year (data.year)"),
        _user_info=Depends(auth.get_user_info()),
        repo: ICareerExplorerAnalyticsRepository = Depends(_get_career_explorer_analytics_repository),
    ) -> CareerExplorerStatsResponse:
        try:
            user_ids = await repo._resolve_user_ids(
                institution=institution,
                location=location,
                program=program,
                year=year,
            )
            return await repo.get_career_explorer_stats(user_ids=user_ids)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e
