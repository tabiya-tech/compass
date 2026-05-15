from __future__ import annotations

import asyncio
import logging
from http import HTTPStatus
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Response
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.matching.client import MatchingServiceError
from app.matching.get_service import get_matching_service
from app.matching.matching_types import (
    CompassOpportunity,
    PreferenceVector,
    Skill,
    SkillsVector,
)
from app.agent.recommender_advisor_agent.skills_extractor import SkillsExtractor
from app.analytics.types import PaginatedListResponse
from app.constants.errors import HTTPErrorResponse
from app.job_preferences.get_job_preferences_service import get_job_preferences_service
from app.job_preferences.service import IJobPreferencesService
from app.jobs.get_job_service import get_job_service
from app.jobs.service import (
    IJobService,
    JobDocument,
    JobStats,
    MatchedJobDocument,
    MatchedJobsResponse,
    SkillsSource,
)
from app.programme_skills.repository import ProgrammeSkillsRepository
from app.server_dependencies.database_collections import Collections
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.user_profile.repository import UserProfileRepository
from app.users.auth import Authentication, UserInfo

logger = logging.getLogger(__name__)


# ─── Module-level lazy singletons ────────────────────────────────────────────

_user_profile_repo_lock = asyncio.Lock()
_user_profile_repo_singleton: Optional[UserProfileRepository] = None


async def _get_user_profile_repository(
    application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
    userdata_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db),
) -> UserProfileRepository:
    global _user_profile_repo_singleton
    if _user_profile_repo_singleton is None:
        async with _user_profile_repo_lock:
            if _user_profile_repo_singleton is None:
                _user_profile_repo_singleton = UserProfileRepository(application_db, userdata_db)
    return _user_profile_repo_singleton


_programme_skills_repo_lock = asyncio.Lock()
_programme_skills_repo_singleton: Optional[ProgrammeSkillsRepository] = None


async def _get_programme_skills_repository(
    application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
) -> ProgrammeSkillsRepository:
    global _programme_skills_repo_singleton
    if _programme_skills_repo_singleton is None:
        async with _programme_skills_repo_lock:
            if _programme_skills_repo_singleton is None:
                _programme_skills_repo_singleton = ProgrammeSkillsRepository(
                    application_db.get_collection(Collections.PROGRAMME_SKILLS)
                )
    return _programme_skills_repo_singleton


# ─── Pure helpers for building the matching service request and parsing the response ──

def _build_skills_vector(programme_skills_doc) -> SkillsVector:
    """Build the matching-service skills vector from a programme_skills document."""
    if not programme_skills_doc:
        return SkillsVector(top_skills=[])
    return SkillsVector(
        top_skills=[
            Skill(
                preferred_label=skill.preferredLabel,
                origin_uuid=skill.originUUID,
                proficiency=0.8,
            )
            for skill in programme_skills_doc.skills
        ]
    )


def _build_skills_vector_from_experiences(experiences) -> SkillsVector:
    """Aggregate the user's S&I-extracted skills into a matching-service skills vector.

    `origin_uuid` can be empty for ESCO entities lacking the upstream link; we keep the entry
    in that case (the matching service treats it as an unknown-origin skill) rather than dropping it.
    """
    if not experiences:
        return SkillsVector(top_skills=[])
    extracted = SkillsExtractor().extract_skills_vector(experiences)
    return SkillsVector(
        top_skills=[
            Skill(
                preferred_label=s["preferred_label"],
                origin_uuid=s.get("origin_uuid") or "",
                proficiency=s.get("proficiency", 0.5),
            )
            for s in extracted.get("skills", [])
            if s.get("preferred_label")
        ]
    )


def _build_preference_vector(prefs) -> PreferenceVector:
    """Build the matching-service preference vector from the user's JobPreferences.

    Falls back to neutral (0.5) defaults when the user has no recorded preferences,
    since the matching service requires the core preference dimensions.
    """
    if prefs is None:
        return PreferenceVector(
            earnings_per_month=0.5,
            physical_demand=0.5,
            social_interaction=0.5,
            career_growth=0.5,
        )
    return PreferenceVector(
        earnings_per_month=prefs.financial_importance,
        task_content=prefs.task_preference_importance,
        physical_demand=0.5,
        work_flexibility=prefs.work_life_balance_importance,
        social_interaction=0.5,
        career_growth=prefs.career_advancement_importance,
        social_meaning=prefs.social_impact_importance,
    )


def _enrich_matched_jobs(
    opportunities: list[CompassOpportunity],
    jobs_by_url: dict,
) -> list[MatchedJobDocument]:
    """Map CompassOpportunity entries to MatchedJobDocument and enrich with jobs-collection fields.

    Join key is `URL` (matching service) ↔ `application_url` (jobs collection). The matching
    service's `uuid` is stored on the entity for use as a row key on the frontend, but is not
    used for the join (see service.py docstring for the schema mismatch context).
    """
    results: list[MatchedJobDocument] = []
    for opp in opportunities:
        doc = MatchedJobDocument(
            uuid=opp.uuid or None,
            opportunity_title=opp.opportunity_title or None,
            location=opp.location,
            contract_type=opp.contract_type,
            URL=opp.url,
            final_score=opp.final_score,
            justification=opp.justification,
            rank=opp.rank or None,
        )
        job = jobs_by_url.get(doc.URL or "")
        if job:
            doc.employer = job.employer
            doc.category = job.category
            doc.posted_date = job.posted_date
        results.append(doc)
    return results


def add_jobs_routes(app: FastAPI, authentication: Optional[Authentication] = None):
    """
    Add all routes related to jobs to the FastAPI app.
    :param app: FastAPI: The FastAPI app to add the routes to.
    :param authentication: Optional[Authentication]: when provided, enables the authenticated
        /jobs/matched route which returns personalised matches via the matching service.
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

    if authentication is not None:
        @router.get(
            "/matched",
            response_model=MatchedJobsResponse,
            responses={
                HTTPStatus.UNAUTHORIZED: {"model": HTTPErrorResponse},
                HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
            },
            description=(
                "Return jobs personalised for the authenticated user. Prefers live S&I-extracted "
                "skills; falls back to the user's programme catalog skills; returns an empty list "
                "with skills_source=none when neither is available so the frontend can render an "
                "explanatory empty state instead of generic fallback matches."
            ),
        )
        async def get_matched_jobs(
            user_info: UserInfo = Depends(authentication.get_user_info()),
            job_preferences_service: IJobPreferencesService = Depends(get_job_preferences_service),
            job_service: IJobService = Depends(get_job_service),
            user_profile_repo: UserProfileRepository = Depends(_get_user_profile_repository),
            programme_skills_repo: ProgrammeSkillsRepository = Depends(_get_programme_skills_repository),
            limit: Annotated[int, Query(ge=1, le=100, description="Max results")] = 20,
        ):
            try:
                # Fetch session id and personal data in parallel
                session_id, personal_data = await asyncio.gather(
                    user_profile_repo.get_latest_session_id(user_info.user_id),
                    user_profile_repo.get_personal_data(user_info.user_id),
                )
                province = personal_data.get("province") if personal_data else None

                # Prefer live S&I-extracted skills; fall back to programme catalog skills.
                experiences = (
                    await user_profile_repo.get_explored_experience_entities(session_id)
                    if session_id is not None
                    else None
                )
                skills_source: SkillsSource
                if experiences:
                    skills_vector = _build_skills_vector_from_experiences(experiences)
                    skills_source = "s&i"
                else:
                    programme_name = personal_data.get("programme_name") if personal_data else None
                    programme_skills_doc = (
                        await programme_skills_repo.find_by_programme_name(programme_name)
                        if programme_name
                        else None
                    )
                    skills_vector = _build_skills_vector(programme_skills_doc)
                    skills_source = "programme" if skills_vector.top_skills else "none"

                # Short-circuit: no skills to match on → don't call the matching service
                # (it returns generic fallback junk for empty input). The frontend renders an
                # explanatory empty state from skills_source=none.
                if not skills_vector.top_skills:
                    logger.info(
                        "matched-jobs request user=%s skills_source=none — returning empty without calling matching service",
                        user_info.user_id,
                    )
                    return MatchedJobsResponse(matches=[], skills_source="none")

                prefs = (
                    await job_preferences_service.get_by_session(session_id)
                    if session_id is not None
                    else None
                )
                preference_vector = _build_preference_vector(prefs)

                logger.info(
                    "matched-jobs request user=%s skills_source=%s skills_count=%d has_prefs=%s",
                    user_info.user_id,
                    skills_source,
                    len(skills_vector.top_skills),
                    prefs is not None,
                )

                matching_service = get_matching_service()
                matching_result = await matching_service.generate_recommendations(
                    youth_id=user_info.user_id,
                    city=None,
                    province=str(province) if province else None,
                    skills_vector=skills_vector,
                    preference_vector=preference_vector,
                )
                opportunities = matching_result.opportunities[:limit]

                # Enrich matched jobs with employer/category/posted_date from the jobs collection.
                # Join key is application_url (matching service's `URL` == our `application_url`).
                matched_urls: list[str] = [
                    opp.url for opp in opportunities if opp.url
                ]
                jobs_by_url = await job_service.get_jobs_by_application_urls(matched_urls)
                results = _enrich_matched_jobs(opportunities, jobs_by_url)

                logger.info(
                    "matched-jobs response user=%s skills_source=%s matches_count=%d",
                    user_info.user_id,
                    skills_source,
                    len(results),
                )
                return MatchedJobsResponse(matches=results, skills_source=skills_source)

            except HTTPException:
                raise
            except MatchingServiceError as exc:
                logger.error("Matching service error for user %s: %s", user_info.user_id, exc)
                raise HTTPException(
                    status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                    detail="Matching service unavailable",
                ) from exc
            except Exception as exc:
                logger.exception("Error in get_matched_jobs for user %s", user_info.user_id)
                raise HTTPException(
                    status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                    detail="Failed to fetch matched jobs",
                ) from exc

    app.include_router(router)
