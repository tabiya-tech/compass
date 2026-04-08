import asyncio
import logging
from http import HTTPStatus
from typing import Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Path
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.constants.errors import HTTPErrorResponse
from app.context_vars import user_id_ctx_var
from app.programme_skills.repository import ProgrammeSkillsRepository, IProgrammeSkillsRepository
from app.programme_skills.types import ProgrammeSkillsResponse
from app.server_dependencies.database_collections import Collections
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication, UserInfo
from app.users.plain_personal_data.repository import PlainPersonalDataRepository

_lock = asyncio.Lock()
_repository_singleton: Optional[IProgrammeSkillsRepository] = None


async def _get_programme_skills_repository(
    application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
) -> IProgrammeSkillsRepository:
    global _repository_singleton
    if _repository_singleton is None:
        async with _lock:
            if _repository_singleton is None:
                _repository_singleton = ProgrammeSkillsRepository(
                    application_db.get_collection(Collections.PROGRAMME_SKILLS)
                )
    return _repository_singleton


def add_programme_skills_routes(users_router: APIRouter, auth: Authentication) -> None:
    """Add GET /users/{user_id}/programme-skills to the users router."""
    logger = logging.getLogger(__name__)

    router = APIRouter(
        prefix="/{user_id}/programme-skills",
        tags=["programme-skills"],
    )

    @router.get(
        "",
        response_model=ProgrammeSkillsResponse,
        responses={
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description=(
            "Return the ESCO skills associated with the programme the user is enrolled in. "
            "The programme is read from the user's plain personal data ('program' key). "
            "Returns an empty list if the user has no programme or no skills are mapped."
        ),
    )
    async def get_programme_skills(
        user_id: str = Path(description="The unique identifier of the user"),
        user_info: UserInfo = Depends(auth.get_user_info()),
        repository: IProgrammeSkillsRepository = Depends(_get_programme_skills_repository),
        user_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db),
    ) -> ProgrammeSkillsResponse:
        user_id_ctx_var.set(user_id)

        if user_info.user_id != user_id:
            msg = f"User {user_info.user_id} is not allowed to access programme skills for user {user_id}"
            logger.warning(msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=msg)

        try:
            plain_data_repo = PlainPersonalDataRepository(user_db)
            personal_data = await plain_data_repo.find_by_user_id(user_id)
            programme_name = (personal_data.data.get("programme_name") or "") if personal_data else ""

            if not programme_name:
                return ProgrammeSkillsResponse(skills=[])

            doc = await repository.find_by_programme_name(programme_name)
            if doc is None:
                logger.info("No skills found for programme %r (user %s)", programme_name, user_id)
                return ProgrammeSkillsResponse(skills=[])

            return ProgrammeSkillsResponse(skills=[s.preferredLabel for s in doc.skills])

        except HTTPException:
            raise
        except Exception as exc:
            logger.exception(exc)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to fetch programme skills",
            ) from exc

    users_router.include_router(router)
