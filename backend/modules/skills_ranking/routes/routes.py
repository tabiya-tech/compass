import logging
from http import HTTPStatus
from typing import Annotated
import random

from fastapi import APIRouter, HTTPException
from fastapi.params import Depends, Path

from app.constants.errors import HTTPErrorResponse
from app.context_vars import user_id_ctx_var, session_id_ctx_var
from app.errors.errors import UnauthorizedSessionAccessError
from app.users.auth import Authentication, UserInfo
from app.users.get_user_preferences_repository import get_user_preferences_repository
from app.users.repositories import IUserPreferenceRepository
from modules.skills_ranking.constants import FEATURE_ID
from modules.skills_ranking.errors import InvalidNewPhaseError
from modules.skills_ranking.repository.get_skills_ranking_repository import get_skills_ranking_repository
from modules.skills_ranking.repository.repository import ISkillsRankingRepository
from modules.skills_ranking.routes.types import SkillsRankingResponse, UpsertSkillsRankingRequest, GetRankingResponse
from modules.skills_ranking.service.get_skills_ranking_service import get_skills_ranking_service
from modules.skills_ranking.service.service import ISkillsRankingService
from modules.skills_ranking.service.types import SkillsRankingState, SkillsRankingCurrentState, SkillRankingExperimentGroups
from modules.skills_ranking.errors import ExperimentGroupsNotFound, SkillsRankingStateNotFound
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
            skills_ranking_service: ISkillsRankingService = Depends(get_skills_ranking_service),
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
                # if no state is found, create a new one
                new_state = SkillsRankingState(
                    session_id=session_id,
                    experiment_groups=SkillRankingExperimentGroups(),
                    current_state=SkillsRankingCurrentState.INITIAL
                )
                # write the experiment groups to the user preferences
                await user_preferences_repository.set_experiment_by_user_id(
                    user_id=user_info.user_id,
                    experiment_id=FEATURE_ID,
                    experiment_config=new_state.experiment_groups.model_dump()
                )

                state = await skills_ranking_service.upsert_state(new_state)

            return SkillsRankingResponse.from_state(state)
        except UnauthorizedSessionAccessError:
            logger.warning(f"Unauthorized access to session_id: {session_id} by user_id: {user_info.user_id}")
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Unauthorized access to session.")
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

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

            experiment_group = preferences.experiments.get(FEATURE_ID, None)
            # if the user is in the experiment, add it to the skills ranking experiments
            if experiment_group is None:
                raise ExperimentGroupsNotFound(user_info.user_id, session_id)
            experiment_groups = SkillRankingExperimentGroups(**experiment_group)

            # upsert the state
            state = SkillsRankingState(
                session_id=session_id,
                experiment_groups=experiment_groups,
                current_state=request.current_state,
                self_ranking=request.self_ranking,
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
        except ExperimentGroupsNotFound as e:
            logger.warning(f"Experiment groups not found for user_id: {user_info.user_id} and session_id: {session_id}")
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=dict(
                message="Experiment groups not found",
                user_id=user_info.user_id,
                session_id=session_id
            ))
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Opps! Something went wrong.")

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
