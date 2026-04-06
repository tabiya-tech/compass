from __future__ import annotations

from http import HTTPStatus
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Response

from app.analytics.types import PaginatedListResponse
from app.constants.errors import HTTPErrorResponse
from app.institutions.get_institution_service import get_institution_service
from app.institutions.service import IInstitutionService, InstitutionDocument, InstitutionProgrammes


def add_institutions_routes(app: FastAPI):
    """Add all routes related to TEVETA institutions to the FastAPI app."""
    router = APIRouter(prefix="/institutions", tags=["institutions"])

    @router.get(
        "",
        response_model=PaginatedListResponse[InstitutionDocument],
        responses={
            HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description=(
            "Search TEVETA-registered institutions by keyword, province, or sector. "
            "Supports cursor-based pagination."
        ),
    )
    async def search_institutions(
        response: Response,
        keywords: Optional[str] = Query(default=None, description="Keyword search across institution name, sector and programmes"),
        province: Optional[str] = Query(default=None, description="Filter by province"),
        sector: Optional[str] = Query(default=None, description="Filter by sector"),
        cursor: Optional[str] = Query(default=None, description="Pagination cursor from previous response"),
        limit: Annotated[int, Query(ge=1, le=500, description="Max items per page")] = 20,
        include: Optional[str] = Query(default=None, description="Comma-separated: 'count' to include total"),
        fields: Optional[str] = Query(default=None, description="Comma-separated: 'name' to return names only"),
        institution_service: IInstitutionService = Depends(get_institution_service),
    ):
        response.headers["Access-Control-Allow-Origin"] = "*"
        name_only = fields is not None and "name" in fields.split(",")
        try:
            return await institution_service.search_institutions(
                keywords=keywords,
                province=province,
                sector=sector,
                cursor=cursor,
                limit=limit,
                include=include,
                name_only=name_only,
            )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to search institutions",
            ) from exc

    @router.get(
        "/programmes",
        response_model=InstitutionProgrammes,
        responses={
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description="Return all programmes offered by a specific institution identified by its registration number.",
    )
    async def get_programmes_by_institution(
        response: Response,
        reg_no: str = Query(..., description="Institution registration number"),
        institution_service: IInstitutionService = Depends(get_institution_service),
    ):
        response.headers["Access-Control-Allow-Origin"] = "*"
        try:
            return await institution_service.get_programmes_by_institution(reg_no)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to fetch institution programmes",
            ) from exc

    app.include_router(router)
