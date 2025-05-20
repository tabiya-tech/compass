import logging
from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, HTTPException
from fastapi.params import Depends, Path

from app.constants.errors import HTTPErrorResponse
from app.context_vars import user_id_ctx_var, session_id_ctx_var
from app.errors.constants import NO_PERMISSION_FOR_SESSION
from app.errors.errors import UnauthorizedSessionAccessError
from app.users.auth import Authentication, UserInfo
from app.users.get_user_preferences_repository import get_user_preferences_repository
from app.users.repositories import IUserPreferenceRepository
from modules.skills_ranking.errors import InvalidNewPhaseError, InvalidSkillsRankingInitializationRequest
from modules.skills_ranking.repository.get_skills_ranking_repository import get_skills_ranking_repository
from modules.skills_ranking.repository.repository import ISkillsRankingRepository
from modules.skills_ranking.routes.types import UpsertSkillsRankingRequest, GetRankingResponse
from modules.skills_ranking.service.get_skills_ranking_service import get_skills_ranking_service
from modules.skills_ranking.service.service import ISkillsRankingService
from modules.skills_ranking.service.types import SkillsRankingState, SkillsRankingPhase
from modules.skills_ranking.errors import SkillsRankingStateNotFound
logger = logging.getLogger(__name__)


def get_skills_ranking_router(auth: Authentication) -> APIRouter:
    """
    Add the skills ranking routes on the conversation router.
    """

    router = APIRouter(prefix="/conversations/{session_id}/skills-ranking", tags=["skills-ranking", "conversations"])

    @router.get("/state")
    async def _get_skills_ranking_state(
            session_id: Annotated[int, Path(description="The conversation identifier", examples=[1])],
            user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository),
            skills_ranking_repository: ISkillsRankingRepository = Depends(get_skills_ranking_repository),
            skills_ranking_service: ISkillsRankingService = Depends(get_skills_ranking_service),
            user_info: UserInfo = Depends(auth.get_user_info())) -> SkillsRankingState | None:
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
                # return None if no state exists
                return None

            return state
        except UnauthorizedSessionAccessError:
            logger.warning(f"Unauthorized access to session_id: {session_id} by user_id: {user_info.user_id}")
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    @router.post(
        path="/state",
        responses={
            HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
            HTTPStatus.NOT_MODIFIED: {"description": "Not modified, For concurrency request reasons"},
        },
        name="upsert skills ranking state",
        description="create or update the skills ranking state for a specific session",
        status_code=HTTPStatus.ACCEPTED)
    async def _upsert_skills_ranking_state(
            session_id: Annotated[int, Path(description="The conversation identifier", examples=[1])],
            request: UpsertSkillsRankingRequest,
            user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository),
            skills_ranking_repository: ISkillsRankingRepository = Depends(get_skills_ranking_repository),
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

            # check if state exists
            existing_state = await skills_ranking_repository.get_by_session_id(session_id=session_id)

            if existing_state is None:
                # if INITIAL create a new state, else throw a state not found error
                if request.phase != SkillsRankingPhase.INITIAL:
                    raise SkillsRankingStateNotFound(session_id=session_id)

                # create the state
                new_state = await skills_ranking_service.upsert_state(
                    session_id=session_id,
                    user_id=user_info.user_id,
                    phase=request.phase,
                )
                return new_state
            else:
                # upsert/update as normal
                new_state = await skills_ranking_service.upsert_state(
                    session_id=session_id,
                    phase=request.phase,
                    experiment_groups=existing_state.experiment_groups,
                    self_ranking=request.self_ranking,
                    ranking=existing_state.ranking
                )
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
        except SkillsRankingStateNotFound as e:
            logger.warning(f"Skills ranking state not found: {e}")
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Skills ranking state not found")
        except InvalidSkillsRankingInitializationRequest as e:
            logger.warning(f"Invalid skill ranking initialization request: {e}")
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Invalid skill ranking initialization request")
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    @router.get(
        path="/ranking",
        responses={
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        name="get ranking",
        description="get the ranking for a specific session",
        status_code=HTTPStatus.OK)
    async def _get_ranking(
            session_id: Annotated[int, Path(description="The conversation identifier", examples=[1])],
            user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository),
            skills_ranking_service: ISkillsRankingService = Depends(get_skills_ranking_service),
            user_info: UserInfo = Depends(auth.get_user_info())) -> GetRankingResponse:
        try:
            # set the context variables
            user_id_ctx_var.set(user_info.user_id)
            session_id_ctx_var.set(session_id)

            # session authorization
            preferences = await user_preferences_repository.get_user_preference_by_user_id(user_info.user_id)
            if preferences is None or session_id not in preferences.sessions:
                raise UnauthorizedSessionAccessError(user_info.user_id, session_id)

            # get the ranking
            return GetRankingResponse(ranking=await skills_ranking_service.get_ranking(session_id))

        except UnauthorizedSessionAccessError:
            logger.warning(f"Unauthorized access to session_id: {session_id} by user_id: {user_info.user_id}")
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Unauthorized access to session.")
        except SkillsRankingStateNotFound:
            logger.warning(f"Skills ranking state not found for session_id: {session_id}")
            raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="Skills ranking state not found.")
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Opps! Something went wrong.")

    return router
