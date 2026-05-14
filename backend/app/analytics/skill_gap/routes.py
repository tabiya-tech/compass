"""
Skill gap analytics routes.
"""
import logging
import re
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


async def _resolve_user_ids(
    *,
    institution: Optional[str] = None,
    location: Optional[str] = None,
    sector: Optional[str] = None,
    application_db: AsyncIOMotorDatabase,
    userdata_db: AsyncIOMotorDatabase,
) -> Optional[list[str]]:
    """
    Return user_ids matching the given demographic filters. Returns None if no filters (all users).
    For sector: finds institution names whose sectors_covered matches the given sector,
    then resolves to user_ids via PLAIN_PERSONAL_DATA.
    """
    match_filter: dict = {}

    if institution:
        match_filter["data.institution_name"] = {"$eq": institution}

    location_institution_names: Optional[list[str]] = None
    sector_institution_names: Optional[list[str]] = None

    if location:
        loc_docs = await application_db.get_collection(Collections.INSTITUTIONS).find(
            {"province": {"$regex": f"^{re.escape(location)}$", "$options": "i"}},
            {"name": 1, "_id": 0},
        ).to_list(length=None)
        location_institution_names = [d["name"] for d in loc_docs if d.get("name")]
        if not location_institution_names:
            return []

    if sector:
        inst_docs = await application_db.get_collection(Collections.INSTITUTIONS).find(
            {"$or": [
                {"sectors_covered": {"$regex": re.escape(sector), "$options": "i"}},
                {"sectors_covered": {"$regex": "^all sectors$", "$options": "i"}},
            ]},
            {"name": 1, "_id": 0},
        ).to_list(length=None)
        sector_institution_names = [d["name"] for d in inst_docs if d.get("name")]
        if not sector_institution_names:
            return []

    if location_institution_names is not None or sector_institution_names is not None:
        if location_institution_names is not None and sector_institution_names is not None:
            combined = list(set(location_institution_names) & set(sector_institution_names))
        else:
            combined = location_institution_names or sector_institution_names  # type: ignore[assignment]
        if not combined:
            return []
        if "data.institution_name" in match_filter:
            current_inst = match_filter["data.institution_name"]["$eq"]
            if current_inst not in combined:
                return []
        else:
            match_filter["data.institution_name"] = {"$in": combined}

    if not match_filter:
        return None

    docs = await userdata_db.get_collection(Collections.PLAIN_PERSONAL_DATA).find(
        match_filter, {"user_id": 1}
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
            "Optionally filter by institution, location (province), and sector. "
            "Institution staff are automatically scoped to their own institution."
        ),
    )
    async def _skill_gap_stats(
        limit: Annotated[
            int,
            Query(ge=1, le=100, description="Maximum number of top skill gaps to return."),
        ] = 10,
        institution: Optional[str] = Query(default=None, description="Filter by institution name"),
        location: Optional[str] = Query(default=None, description="Filter by province/location (data.location)"),
        sector: Optional[str] = Query(default=None, description="Filter by institution sector (sectors_covered)"),
        access_role: AccessRole = Depends(get_access_role_dependency(auth)),
        repo: ISkillGapAnalyticsRepository = Depends(_get_skill_gap_analytics_repository),
        userdata_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db),
        application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
    ) -> SkillGapStatsResponse:
        if access_role.is_institution_staff and access_role.institution_id:
            institution = decode_institution_id(access_role.institution_id)
        try:
            user_ids = await _resolve_user_ids(
                institution=institution,
                location=location,
                sector=sector,
                application_db=application_db,
                userdata_db=userdata_db,
            )
            return await repo.get_skill_gap_stats(limit, user_ids=user_ids)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e
