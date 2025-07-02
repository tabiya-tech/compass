import logging
from http import HTTPStatus
from typing import List, Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query

from app.application_state import ApplicationStateManager
from app.constants.errors import HTTPErrorResponse
from app.context_vars import session_id_ctx_var, user_id_ctx_var, client_id_ctx_var
from app.conversations.constants import UNEXPECTED_FAILURE_MESSAGE
from app.conversations.experience.service import ExperienceNotFoundError, ExperienceService, IExperienceService
from app.conversations.experience.types import ExperienceResponse, UpdateExperienceRequest
from app.errors.constants import NO_PERMISSION_FOR_SESSION
from app.errors.errors import UnauthorizedSessionAccessError
from app.metrics.application_state_metrics_recorder.recorder import ApplicationStateMetricsRecorder
from app.metrics.services.get_metrics_service import get_metrics_service
from app.metrics.services.service import IMetricsService
from app.server_dependencies.application_state_dependencies import get_application_state_manager
from app.users.auth import Authentication, UserInfo
from app.users.get_user_preferences_repository import get_user_preferences_repository


def get_experience_service(application_state_manager: ApplicationStateManager = Depends(
    get_application_state_manager),
        metrics_service: IMetricsService = Depends(
            get_metrics_service)) -> IExperienceService:
    return ExperienceService(application_state_metrics_recorder=ApplicationStateMetricsRecorder(
        application_state_manager=application_state_manager,
        metrics_service=metrics_service))


def add_experience_routes(conversation_router: APIRouter, authentication: Authentication):
    """
    Adds all the conversation routes to the FastAPI app

    :param conversation_router:
    :param authentication: Authentication Module Dependency: The authentication instance to use for the routes.
    """
    logger = logging.getLogger(__name__)

    experience_router = APIRouter(prefix="/experiences", tags=["experiences"])

    @experience_router.get(path="", response_model=List[ExperienceResponse],
                           responses={HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
                                      # user is not allowed to get the experiences of another user's session
                                      HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse}
                                      # Internal server error, any server error
                                      }, description="""Endpoint for retrieving the experiences of a user.""")
    async def _get_experiences(session_id: Annotated[
        int, Path(description="The session id for the conversation history.", examples=[123])],
                               original: Annotated[bool, Query(description="Whether to fetch original versions of the experiences.", examples=[True])] = False,
                               user_info: UserInfo = Depends(authentication.get_user_info()),
                               user_preferences_repository=Depends(get_user_preferences_repository),
                               service: ExperienceService = Depends(get_experience_service)) -> List[ExperienceResponse]:
        """
        Endpoint for retrieving the experiences of a user.
        """
        user_id = user_info.user_id

        # set the session_id, user_id in the context variable
        # so that it can be accessed by the logger
        # and downstream functions
        session_id_ctx_var.set(session_id)
        user_id_ctx_var.set(user_info.user_id)

        try:
            # check that the user making the request has the session_id in their user preferences
            current_user_preferences = await user_preferences_repository.get_user_preference_by_user_id(user_id)
            if current_user_preferences is None or session_id not in current_user_preferences.sessions:
                raise UnauthorizedSessionAccessError(user_id, session_id)

            # set the client_id in the context variable.
            client_id_ctx_var.set(current_user_preferences.client_id)

            if original:
                return await service.get_original_experiences(session_id)
            else:
                return await service.get_experiences_by_session_id(session_id)

        except UnauthorizedSessionAccessError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail=UNEXPECTED_FAILURE_MESSAGE)

    @experience_router.patch(path="/{experience_uuid}", response_model=ExperienceResponse,
                             responses={HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
                                        HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
                                        HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse}},
                             description="""Endpoint for editing an experience.""")
    async def _update_experience(session_id: Annotated[
        int, Path(description="The session id for the conversation history.", examples=[123])],
                                 experience_uuid: Annotated[str, Path(description="The uuid of the experience to edit.")],
                                 body: UpdateExperienceRequest,
                                 user_info: UserInfo = Depends(authentication.get_user_info()),
                                 user_preferences_repository=Depends(get_user_preferences_repository),
                                 service: IExperienceService = Depends(get_experience_service)) -> ExperienceResponse:
        """
        Endpoint for editing an experience.
        """
        user_id = user_info.user_id

        session_id_ctx_var.set(session_id)
        user_id_ctx_var.set(user_info.user_id)

        try:
            # check that the user making the request has the session_id in their user preferences
            current_user_preferences = await user_preferences_repository.get_user_preference_by_user_id(user_id)
            if current_user_preferences is None or session_id not in current_user_preferences.sessions:
                raise UnauthorizedSessionAccessError(user_id, session_id)

            return await service.update_experience(user_id, session_id, experience_uuid, body)
        except UnauthorizedSessionAccessError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION)
        except ExperienceNotFoundError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail=warning_msg)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail=UNEXPECTED_FAILURE_MESSAGE)

    @experience_router.get(path="/{experience_uuid}/original", response_model=ExperienceResponse,
                           responses={HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
                                      HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
                                      HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse}},
                           description="""Endpoint for retrieving the original experience by UUID.""")
    async def _get_original_experience(session_id: Annotated[
        int, Path(description="The session id for the conversation history.", examples=[123])],
                                       experience_uuid: Annotated[str, Path(description="The uuid of the experience to retrieve.")],
                                       user_info: UserInfo = Depends(authentication.get_user_info()),
                                       user_preferences_repository=Depends(get_user_preferences_repository),
                                       service: IExperienceService = Depends(get_experience_service)) -> ExperienceResponse:
        """
        Endpoint for retrieving the original experience by UUID.
        """
        user_id = user_info.user_id

        session_id_ctx_var.set(session_id)
        user_id_ctx_var.set(user_info.user_id)

        try:
            # check that the user making the request has the session_id in their user preferences
            current_user_preferences = await user_preferences_repository.get_user_preference_by_user_id(user_id)
            if current_user_preferences is None or session_id not in current_user_preferences.sessions:
                raise UnauthorizedSessionAccessError(user_id, session_id)

            return await service.get_original_experience_by_uuid(session_id, experience_uuid)
        except UnauthorizedSessionAccessError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION)
        except ExperienceNotFoundError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail=warning_msg)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail=UNEXPECTED_FAILURE_MESSAGE)

    @experience_router.delete(path="/{experience_uuid}", status_code=HTTPStatus.NO_CONTENT, response_model=None,
                              responses={HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
                                         HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
                                         HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse}},
                              description="""Endpoint for deleting an experience.""")
    async def _delete_experience(session_id: Annotated[
        int, Path(description="The session id for the conversation history.", examples=[123])],
                                 experience_uuid: Annotated[
                                     str,
                                     Path(
                                         description="The uuid of the experience to delete.",
                                         max_length=36  # uuid has a max length of 36 characters
                                     )],
                                 user_info: UserInfo = Depends(authentication.get_user_info()),
                                 user_preferences_repository=Depends(get_user_preferences_repository),
                                 service: IExperienceService = Depends(get_experience_service)) -> None:
        """
        Endpoint for deleting an experience.
        """
        user_id = user_info.user_id

        session_id_ctx_var.set(session_id)
        user_id_ctx_var.set(user_info.user_id)

        try:
            # check that the user making the request has the session_id in their user preferences
            current_user_preferences = await user_preferences_repository.get_user_preference_by_user_id(user_id)
            if current_user_preferences is None or session_id not in current_user_preferences.sessions:
                raise UnauthorizedSessionAccessError(user_id, session_id)

            await service.delete_experience(user_id, session_id, experience_uuid)
        except UnauthorizedSessionAccessError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION)
        except ExperienceNotFoundError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail=warning_msg)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! something went wrong")

    # Include the experience router directly with the conversation router
    # The conversation router already has the prefix /conversations/{session_id}
    conversation_router.include_router(experience_router)
