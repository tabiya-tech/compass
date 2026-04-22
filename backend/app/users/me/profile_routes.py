"""
Consolidated profile endpoint: GET /users/me/profile

Returns personal data and programme skills in a single call,
replacing the two separate calls:
  - GET /users/{user_id}/plain-personal-data
  - GET /users/{user_id}/programme-skills
"""
import asyncio
import logging
from http import HTTPStatus
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.constants.errors import HTTPErrorResponse
from app.context_vars import user_id_ctx_var
from app.programme_skills.repository import IProgrammeSkillsRepository, ProgrammeSkillsRepository
from app.server_dependencies.database_collections import Collections
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication, UserInfo
from app.users.plain_personal_data.repository import PlainPersonalDataRepository
from app.users.plain_personal_data.routes import get_plain_personal_data_service
from app.users.plain_personal_data.service import IPlainPersonalDataService

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_programme_skills_repo_singleton: Optional[IProgrammeSkillsRepository] = None


async def _get_programme_skills_repository(
    application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
) -> IProgrammeSkillsRepository:
    global _programme_skills_repo_singleton
    if _programme_skills_repo_singleton is None:
        async with _lock:
            if _programme_skills_repo_singleton is None:
                _programme_skills_repo_singleton = ProgrammeSkillsRepository(
                    application_db.get_collection(Collections.PROGRAMME_SKILLS)
                )
    return _programme_skills_repo_singleton


class PersonalDataResponse(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    province: Optional[str] = None
    institution_name: Optional[str] = None
    programme_name: Optional[str] = None
    school_year: Optional[str] = None


class UserProfileResponse(BaseModel):
    personal_data: Optional[PersonalDataResponse] = None
    programme_skills: list[str] = []


def add_user_me_profile_routes(users_router: APIRouter, auth: Authentication) -> None:
    """
    Add GET /users/me/profile to the users router.

    This endpoint consolidates:
      - GET /users/{user_id}/plain-personal-data
      - GET /users/{user_id}/programme-skills
    """

    router = APIRouter(prefix="/me", tags=["user-profile"])

    @router.get(
        path="/profile",
        response_model=UserProfileResponse,
        status_code=HTTPStatus.OK,
        responses={
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description=(
            "Returns the authenticated user's personal data and programme skills "
            "in a single call. personal_data is null if the user has not yet set up "
            "their profile. programme_skills is an empty list if the user has no "
            "programme or no skills are mapped."
        ),
    )
    async def _get_user_profile(
        user_info: UserInfo = Depends(auth.get_user_info()),
        plain_personal_data_service: IPlainPersonalDataService = Depends(get_plain_personal_data_service),
        programme_skills_repo: IProgrammeSkillsRepository = Depends(_get_programme_skills_repository),
        user_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db),
    ) -> UserProfileResponse:
        user_id = user_info.user_id
        user_id_ctx_var.set(user_id)

        try:
            # Fetch plain personal data and programme skills concurrently.
            # Programme skills require plain personal data first (to get the programme_name),
            # so we fetch plain personal data once and reuse it for both.
            plain_personal_data = await plain_personal_data_service.get(user_id)

            # Now fetch programme skills using the programme_name from personal data
            programme_name = (
                (plain_personal_data.data.get("programme_name") or "")
                if plain_personal_data
                else ""
            )

            if programme_name:
                doc = await programme_skills_repo.find_by_programme_name(programme_name)
                programme_skills = [s.preferredLabel for s in doc.skills] if doc else []
            else:
                programme_skills = []

            personal_data_response: Optional[PersonalDataResponse] = None
            if plain_personal_data is not None:
                data = plain_personal_data.data or {}
                personal_data_response = PersonalDataResponse(
                    first_name=data.get("first_name"),
                    last_name=data.get("last_name"),
                    province=data.get("province"),
                    institution_name=data.get("institution_name"),
                    programme_name=data.get("programme_name"),
                    school_year=data.get("school_year"),
                )

            return UserProfileResponse(
                personal_data=personal_data_response,
                programme_skills=programme_skills,
            )

        except Exception as exc:
            logger.exception("Error fetching user profile for user %s: %s", user_id, exc)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to fetch user profile",
            ) from exc

    users_router.include_router(router)
