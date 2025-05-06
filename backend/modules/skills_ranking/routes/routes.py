import logging
from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, HTTPException
from fastapi.params import Depends, Path

from app.constants.errors import HTTPErrorResponse
from app.context_vars import user_id_ctx_var, session_id_ctx_var
from app.errors.errors import UnauthorizedSessionAccessError
from app.users.auth import Authentication, UserInfo
from app.users.get_user_preferences_repository import get_user_preferences_repository
from app.users.repositories import IUserPreferenceRepository
from modules.skills_ranking.constants import EXPERIMENT_ID
from modules.skills_ranking.errors import SkillsRankingStateNotFound, InvalidNewPhaseError
from modules.skills_ranking.repository.get_skills_ranking_repository import get_skills_ranking_repository
from modules.skills_ranking.repository.repository import ISkillsRankingRepository
from modules.skills_ranking.routes.types import SkillsRankingResponse, UpsertSkillsRankingRequest
from modules.skills_ranking.service.get_skills_ranking_service import get_skills_ranking_service
from modules.skills_ranking.service.service import ISkillsRankingService
from modules.skills_ranking.service.types import SkillsRankingState

logger = logging.getLogger(__name__)


def get_skills_ranking_router(auth: Authentication) -> APIRouter:
    """
    Add the skills ranking routes on the conversation router.
    """

    router = APIRouter(prefix="/conversations/{session_id}/skills-ranking", tags=["skills-ranking", "conversations"])

    @router.get("")
    async def _get_skills_ranking(
            session_id: Annotated[int, Path(description="The conversation identifier", examples=[1])],
            user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository),
            skills_ranking_repository: ISkillsRankingRepository = Depends(get_skills_ranking_repository),
            user_info: UserInfo = Depends(auth.get_user_info())) -> SkillsRankingResponse:
        try:
            # set the context variables
            user_id_ctx_var.set(user_info.user_id)
            session_id_ctx_var.set(session_id)

            # session authorization
            preferences = await user_preferences_repository.get_user_preference_by_user_id(user_info.user_id)
            if preferences is None or session_id not in preferences.sessions:
                raise UnauthorizedSessionAccessError(user_info.user_id, session_id)

            # get the state
            state = await skills_ranking_repository.get_by_session_id(session_id=session_id)
            if state is None:
                raise SkillsRankingStateNotFound()

            return SkillsRankingResponse.from_state(state)
        except UnauthorizedSessionAccessError:
            logger.warning(f"Unauthorized access to session_id: {session_id} by user_id: {user_info.user_id}")
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Unauthorized access to session.")
        except SkillsRankingStateNotFound:
            logger.warning(f"Skills ranking state not found for session_id: {session_id}")
            raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Skills ranking state not found.")
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Opps! Something went wrong.")

    @router.patch(
        path="",
        responses={
            HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
            HTTPStatus.NOT_MODIFIED: {"description": "Not modified, For concurrency request reasons"},
        },
        name="upsert skills ranking state",
        description="create or update the skills ranking state for a specific session",
        status_code=HTTPStatus.ACCEPTED)
    async def _upsert_skills_ranking(
            session_id: Annotated[int, Path(description="The conversation identifier", examples=[1])],
            request: UpsertSkillsRankingRequest,
            user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository),
            skills_ranking_service: ISkillsRankingService = Depends(get_skills_ranking_service),
            user_info: UserInfo = Depends(auth.get_user_info())) -> SkillsRankingState:
        try:
            # set the context variables
            user_id_ctx_var.set(user_info.user_id)
            session_id_ctx_var.set(session_id)

            # session authorization
            preferences = await user_preferences_repository.get_user_preference_by_user_id(user_info.user_id)
            if preferences is None or session_id not in preferences.sessions:
                raise UnauthorizedSessionAccessError(user_info.user_id, session_id)

            user_experiment_group = preferences.experiments.get(EXPERIMENT_ID)

            # upsert the state
            state = SkillsRankingState(
                session_id=session_id,
                experiment_group=user_experiment_group,
                current_state=request.current_state,
                self_ranking=request.self_ranking
            )

            new_state = await skills_ranking_service.upsert_state(state)
            return new_state

        except InvalidNewPhaseError as e:
            logger.error("Invalid new phase error occurred.")
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=dict(
                message="Invalid new phase error",
                current_phase=e.current_phase.value,
                expected_phases=[phase.value for phase in e.expected_phases]
            ))
        except UnauthorizedSessionAccessError:
            logger.warning(f"Unauthorized access to session_id: {session_id} by user_id: {user_info.user_id}")
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Unauthorized access to session.")
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Opps! Something went wrong.")

    return router
