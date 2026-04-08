"""
Skills supply analytics routes.
"""
import logging
from http import HTTPStatus
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.analytics.skills_supply.repository import (
    ISkillsSupplyAnalyticsRepository,
    SkillsSupplyAnalyticsRepository,
)
from app.analytics.skills_supply.types import SkillsSupplyStatsResponse
from app.constants.errors import HTTPErrorResponse
from app.server_dependencies.database_collections import Collections
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication
from app.users.access_role import AccessRole, get_access_role_dependency, decode_institution_id

logger = logging.getLogger(__name__)


async def _get_skills_supply_repository(
    application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
) -> ISkillsSupplyAnalyticsRepository:
    return SkillsSupplyAnalyticsRepository(application_db)


async def _resolve_user_ids_for_institution(
    institution_name: str,
    userdata_db: AsyncIOMotorDatabase,
) -> Optional[list[str]]:
    docs = await userdata_db.get_collection(Collections.PLAIN_PERSONAL_DATA).find(
        {"data.institution_name": institution_name}, {"user_id": 1}
    ).to_list(length=None)
    return [d["user_id"] for d in docs if d.get("user_id")]


def add_skills_supply_analytics_routes(router: APIRouter, auth: Authentication) -> None:
    @router.get(
        path="/skills-supply-stats",
        response_model=SkillsSupplyStatsResponse,
        responses={
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description=(
            "Aggregate the most common skills identified by students during skills discovery. "
            "Institution staff are automatically scoped to their own institution."
        ),
    )
    async def _skills_supply_stats(
        limit: int = Query(default=10, ge=1, le=50, description="Number of top skills to return"),
        access_role: AccessRole = Depends(get_access_role_dependency(auth)),
        repo: ISkillsSupplyAnalyticsRepository = Depends(_get_skills_supply_repository),
        userdata_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db),
    ) -> SkillsSupplyStatsResponse:
        try:
            user_ids: Optional[list[str]] = None
            if access_role.is_institution_staff and access_role.institution_id:
                institution_name = decode_institution_id(access_role.institution_id)
                user_ids = await _resolve_user_ids_for_institution(institution_name, userdata_db)
            return await repo.get_skills_supply_stats(limit=limit, user_ids=user_ids)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e
