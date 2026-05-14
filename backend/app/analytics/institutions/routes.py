import asyncio
import base64
import logging
from http import HTTPStatus
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.analytics.institutions.repository import InstitutionRepository, get_institution_repository
from app.analytics.types import Institution, InstitutionFilterOptions, PaginatedListMeta, PaginatedListResponse
from app.constants.errors import HTTPErrorResponse
from app.server_dependencies.database_collections import Collections
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication, UserInfo

logger = logging.getLogger(__name__)


def add_institutions_routes(router: APIRouter, auth: Authentication):
    @router.get(
        "/institutions",
        response_model=PaginatedListResponse[Institution],
        responses={HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse}, HTTPStatus.UNAUTHORIZED: {"model": HTTPErrorResponse}},
        description="List institutions with optional filters and cursor-based pagination. Requires authentication.",
    )
    async def list_institutions(
        user_info: UserInfo = Depends(auth.get_user_info()),
        active: bool | None = Query(default=None, description="Filter by active status"),
        province: str | None = Query(default=None, description="Filter by province"),
        page: int | None = Query(default=None, description="1-based page number"),
        cursor: str | None = Query(default=None, description="Pagination cursor from previous response"),
        limit: int = Query(default=20, ge=1, le=100, description="Max items per page"),
        sort_by: Optional[
            Literal[
                "name",
                "students",
                "active_7_days",
                "skills_discovery_started_pct",
                "skills_discovery_completed_pct",
                "career_readiness_started_pct",
                "career_readiness_completed_pct",
                "career_explorer_started_pct",
            ]
        ] = Query(default=None, description="Sort field; omit for canonical institution order"),
        sort_dir: Literal["asc", "desc"] = Query(default="asc", description="Sort direction (used when sort_by is set)"),
        include: str | None = Query(default=None, description="Comma-separated: 'count' to include total"),
        repository: InstitutionRepository = Depends(get_institution_repository),
    ):
        include_count = bool(include and "count" in include.split(","))
        effective_cursor = cursor

        if page is not None:
            if page < 1:
                raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Invalid page")
            offset = (page - 1) * limit
            effective_cursor = base64.urlsafe_b64encode(str(offset).encode()).decode().rstrip("=")
            include_count = True

        items, next_cursor_str, has_more = await repository.list_institutions(
            active=active,
            province=province,
            cursor=effective_cursor,
            limit=limit,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        total = await repository.count_institutions(
            active=active,
            province=province,
        ) if include_count else None

        meta = PaginatedListMeta(
            limit=limit,
            next_cursor=next_cursor_str,
            has_more=has_more,
            total=total if include_count else None,
        )
        return PaginatedListResponse(data=items, meta=meta)

    @router.get(
        "/institutions/filter-options",
        response_model=InstitutionFilterOptions,
        responses={HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse}},
        description="Return distinct province and sector values across all institutions.",
    )
    async def get_institution_filter_options(
        user_info: UserInfo = Depends(auth.get_user_info()),
        application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
    ) -> InstitutionFilterOptions:
        try:
            coll = application_db.get_collection(Collections.INSTITUTIONS)
            provinces_raw, sectors_raw = await asyncio.gather(
                coll.distinct("province"),
                coll.distinct("sectors_covered"),
            )
            _exclude = {"all sectors", "all provinces", "all"}
            provinces = sorted(p for p in provinces_raw if p and isinstance(p, str) and p.lower() not in _exclude)
            sectors = sorted(s for s in sectors_raw if s and isinstance(s, str) and s.lower() not in _exclude)
            return InstitutionFilterOptions(provinces=provinces, sectors=sectors)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Unexpected error"
            ) from e
