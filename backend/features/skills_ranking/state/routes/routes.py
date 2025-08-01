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
from features.skills_ranking.errors import InvalidNewPhaseError, InvalidFieldsForPhaseError
from features.skills_ranking.state.repositories.get_skills_ranking_state_repository import get_skills_ranking_state_mongo_repository
from features.skills_ranking.state.repositories.skills_ranking_state_repository import ISkillsRankingStateRepository
from features.skills_ranking.state.routes.type import UpsertSkillsRankingRequest, SkillsRankingStateResponse
from features.skills_ranking.state.services.get_skills_ranking_state_service import get_skills_ranking_state_service
from features.skills_ranking.state.services.skills_ranking_state_service import ISkillsRankingStateService
from features.skills_ranking.state.services.type import UpdateSkillsRankingRequest
from features.skills_ranking.errors import SkillsRankingStateNotFound

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
            skills_ranking_repository: ISkillsRankingStateRepository = Depends(get_skills_ranking_state_mongo_repository),
            user_info: UserInfo = Depends(auth.get_user_info())) -> SkillsRankingStateResponse | None:
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

            # Return the full phase array
            return SkillsRankingStateResponse(**state.model_dump())
        except UnauthorizedSessionAccessError:
            logger.warning(f"Unauthorized access to session_id: {session_id} by user_id: {user_info.user_id}")
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    @router.patch(
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
            skills_ranking_repository: ISkillsRankingStateRepository = Depends(get_skills_ranking_state_mongo_repository),
            skills_ranking_service: ISkillsRankingStateService = Depends(get_skills_ranking_state_service),
            user_info: UserInfo = Depends(auth.get_user_info())) -> SkillsRankingStateResponse:
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
                if request.phase != "INITIAL":
                    raise SkillsRankingStateNotFound(session_id=session_id)

            new_state = await skills_ranking_service.upsert_state(
                session_id=session_id,
                update_request=UpdateSkillsRankingRequest(
                    phase=request.phase,
                    cancelled_after=request.cancelled_after,
                    succeeded_after=request.succeeded_after,
                    puzzles_solved=request.puzzles_solved,
                    correct_rotations=request.correct_rotations,
                    clicks_count=request.clicks_count,
                    perceived_rank_percentile=request.perceived_rank_percentile,
                    retyped_rank_percentile=request.retyped_rank_percentile,
                )
            )

            # Convert the state to response format, using the latest phase
            return SkillsRankingStateResponse(**new_state.model_dump())

        except InvalidNewPhaseError as e:
            logger.error("Invalid new phase error occurred.")
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Invalid new phase provided.") from e
        except UnauthorizedSessionAccessError:
            logger.warning(f"Unauthorized access to session_id: {session_id} by user_id: {user_info.user_id}")
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Unauthorized access to session.")
        except SkillsRankingStateNotFound as e:
            logger.warning(f"Skills ranking state not found: {e}")
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Skills ranking state not found")
        except InvalidFieldsForPhaseError as e:
            logger.warning(f"Invalid fields for phase: {e}")
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="Invalid fields for the current phase.") from e
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    return router
