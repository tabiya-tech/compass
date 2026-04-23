from __future__ import annotations

from http import HTTPStatus
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Response
from app.analytics.types import PaginatedListResponse
from app.constants.errors import HTTPErrorResponse
from app.jobs.get_job_service import get_job_service
from app.jobs.service import IJobService, JobDocument, JobStats


def add_jobs_routes(app: FastAPI):
    """
    Add all routes related to jobs to the FastAPI app.
    :param app: FastAPI: The FastAPI app to add the routes to.
    """
    router = APIRouter(prefix="/jobs", tags=["jobs"])

    @router.get(
        "/stats",
        response_model=JobStats,
        responses={HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse}},
        description="Get aggregate stats for jobs: total count, distinct sectors, distinct source platforms.",
    )
    async def get_job_stats(
        response: Response,
        job_service: IJobService = Depends(get_job_service),
    ):
        response.headers["Access-Control-Allow-Origin"] = "*"
        try:
            return await job_service.get_job_stats()
        except Exception as exc:
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to fetch job stats",
            ) from exc

    @router.get(
        "",
        response_model=PaginatedListResponse[JobDocument],
        responses={
            HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description="List jobs with optional filters and cursor-based pagination.",
    )
    async def list_jobs(
        response: Response,
        search: Optional[str] = Query(default=None, description="Search by job title"),
        category: Optional[str] = Query(default=None, description="Filter by job category"),
        employment_type: Optional[str] = Query(default=None, description="Filter by employment type"),
        location: Optional[str] = Query(default=None, description="Filter by job location"),
        days: Optional[int] = Query(default=None, ge=1, le=3650, description="Only include jobs posted within the last N days"),
        page: Optional[int] = Query(default=None, description="1-based page number"),
        cursor: Optional[str] = Query(default=None, description="Pagination cursor from previous response"),
        limit: Annotated[int, Query(ge=1, le=100, description="Max items per page")] = 20,
        sort_by: Literal["title", "category", "location", "source_platform", "posted_date"] | None = Query(
            default=None,
            description="Sort field",
        ),
        sort_dir: Literal["asc", "desc"] = Query(default="asc", description="Sort direction"),
        include: Optional[str] = Query(default=None, description="Comma-separated: 'count' to include total"),
        job_service: IJobService = Depends(get_job_service),
    ):
        """
        List jobs stored in MongoDB.

        Optional query parameters filter by category, employment type, location,
        and/or posted_date window. Pagination is controlled by `cursor` and `limit`.
        """
        response.headers["Access-Control-Allow-Origin"] = "*"
        try:
            return await job_service.list_jobs(
                search=search,
                category=category,
                employment_type=employment_type,
                location=location,
                days=days,
                page=page,
                cursor=cursor,
                limit=limit,
                sort_by=sort_by,
                sort_dir=sort_dir,
                include=include,
            )
        except HTTPException:
            raise
        except RuntimeError as exc:
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to fetch jobs from MongoDB",
            ) from exc

    app.include_router(router)