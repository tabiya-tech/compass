"""
Skill gap analytics routes.
"""
import logging
from http import HTTPStatus
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.analytics.skill_gap.repository import (
    ISkillGapAnalyticsRepository,
    SkillGapAnalyticsRepository,
)
from app.analytics.skill_gap.types import SkillGapStatsResponse
from app.constants.errors import HTTPErrorResponse
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.server_dependencies.database_collections import Collections
from app.users.auth import Authentication
from app.users.access_role import AccessRole, get_access_role_dependency, decode_institution_id

logger = logging.getLogger(__name__)


async def _get_skill_gap_analytics_repository(
    application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
) -> ISkillGapAnalyticsRepository:
    return SkillGapAnalyticsRepository(application_db)


async def _resolve_user_ids_for_institution(
    institution_name: str,
    userdata_db: AsyncIOMotorDatabase,
) -> Optional[list[str]]:
    """Return user_ids belonging to a given institution, or None if no filter."""
    docs = await userdata_db.get_collection(Collections.PLAIN_PERSONAL_DATA).find(
        {"data.institution_name": institution_name}, {"user_id": 1}
    ).to_list(length=None)
    return [d["user_id"] for d in docs if d.get("user_id")]


def add_skill_gap_analytics_routes(router: APIRouter, auth: Authentication) -> None:
    """Register skill gap analytics routes on the given router."""

    @router.get(
        path="/skill-gap-stats",
        response_model=SkillGapStatsResponse,
        responses={
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description=(
            "Aggregate skill gap statistics across students with pre-computed recommendations. "
            "Institution staff are automatically scoped to their own institution."
        ),
    )
    async def _skill_gap_stats(
        limit: Annotated[int, Query(ge=1, le=100, description="Maximum number of top skill gaps to return.")] = 10,
        access_role: AccessRole = Depends(get_access_role_dependency(auth)),
        repo: ISkillGapAnalyticsRepository = Depends(_get_skill_gap_analytics_repository),
        userdata_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db),
    ) -> SkillGapStatsResponse:
        try:
            user_ids: Optional[list[str]] = None
            if access_role.is_institution_staff and access_role.institution_id:
                institution_name = decode_institution_id(access_role.institution_id)
                user_ids = await _resolve_user_ids_for_institution(institution_name, userdata_db)
            return await repo.get_skill_gap_stats(limit, user_ids=user_ids)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e
