import logging
from http import HTTPStatus

from fastapi import APIRouter, Depends, Query

from app.analytics.institutions.repository import InstitutionRepository, get_institution_repository
from app.analytics.types import Institution, PaginatedListMeta, PaginatedListResponse
from app.constants.errors import HTTPErrorResponse
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
        cursor: str | None = Query(default=None, description="Pagination cursor from previous response"),
        limit: int = Query(default=20, ge=1, le=100, description="Max items per page"),
        include: str | None = Query(default=None, description="Comma-separated: 'count' to include total"),
        repository: InstitutionRepository = Depends(get_institution_repository),
    ):
        include_count = include and "count" in include.split(",")

        items, next_cursor_str, has_more = await repository.list_institutions(
            active=active,
            province=province,
            cursor=cursor,
            limit=limit,
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
