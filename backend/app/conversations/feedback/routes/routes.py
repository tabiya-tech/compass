"""
This module contains functions to add feedback routes to the users router.
"""
import asyncio
import logging
from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Path
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import Field

from app.constants.errors import HTTPErrorResponse
from app.context_vars import session_id_ctx_var, user_id_ctx_var, client_id_ctx_var
from app.conversations.feedback.services.errors import InvalidOptionError, InvalidQuestionError, QuestionsFileError
from app.conversations.feedback.services.service import IUserFeedbackService, UserFeedbackService, NewFeedbackSpec
from app.errors.constants import NO_PERMISSION_FOR_SESSION
from app.errors.errors import UnauthorizedSessionAccessError
from app.metrics.services.get_metrics_service import get_metrics_service
from app.metrics.services.service import IMetricsService
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication, UserInfo
from app.users.get_user_preferences_repository import get_user_preferences_repository
from app.users.repositories import IUserPreferenceRepository
from ._types import FeedbackResponse
from ..repository import UserFeedbackRepository

logger = logging.getLogger(__name__)

# Maximum allowed payload size in characters (3KB)
MAX_PAYLOAD_SIZE = 3072


class _PayloadTooLargeErrorResponse(HTTPErrorResponse):
    """
    Response model for payload size validation errors.
    """
    detail: str = Field(
        description="Error message indicating which field exceeded the size limit",
    )


# Lock to ensure that the singleton instance is thread-safe
_user_preferences_repository_lock = asyncio.Lock()
_user_preferences_repository_singleton: IUserFeedbackService | None = None


# Lock to ensure that the singleton instance is thread-safe
_user_feedback_service_lock = asyncio.Lock()
_user_feedback_service_singleton: IUserFeedbackService | None = None


async def _get_user_feedback_service(
        application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
        metrics_service: IMetricsService = Depends(get_metrics_service)) -> IUserFeedbackService:
    global _user_feedback_service_singleton
    if _user_feedback_service_singleton is None:  # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
        async with _user_feedback_service_lock:  # before modifying the singleton instance, acquire the lock
            if _user_feedback_service_singleton is None:  # double check after acquiring the lock
                _user_feedback_service_singleton = UserFeedbackService(
                    user_feedback_repository=UserFeedbackRepository(application_db),
                    metrics_service=metrics_service
                )
    return _user_feedback_service_singleton


def add_user_feedback_routes(users_router: APIRouter, auth: Authentication):
    """
    Add all routes related to user feedback to the user's router.
    :param users_router: APIRouter: The router to add the user feedback routes to.
    :param auth: Authentication: The authentication instance to use for the routes.
    """
    router = APIRouter(prefix="/feedback", tags=["users-feedback"])

    @router.patch("",
                  status_code=HTTPStatus.OK,
                  response_model=FeedbackResponse,
                  responses={
                      HTTPStatus.REQUEST_ENTITY_TOO_LARGE: {"model": _PayloadTooLargeErrorResponse},
                      HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},
                      HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
                      HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse}
                  },
                  name="upsert feedback response",
                  description="create or update user feedback responses for a specific session"
                  )
    async def _user_feedback_handler(
            request: Request,
            feedback_request: NewFeedbackSpec,
            session_id: Annotated[int, Path(description="the unique identifier of the session", examples=[123])],
            user_info: UserInfo = Depends(auth.get_user_info()),
            user_feedback_service: IUserFeedbackService = Depends(_get_user_feedback_service),
            user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository)
    ) -> FeedbackResponse:
        """
        Creates or updates feedback for a session.

        :param feedback_request: The feedback details
        :param user_info: Information about the authenticated user
        :param user_feedback_service: Service for managing user feedback
        :param user_preferences_repository: Repository for user preferences
        :return: The created/updated feedback
        :raises HTTPException: If the request is invalid or unauthorized
        """
        session_id_ctx_var.set(session_id)
        user_id_ctx_var.set(user_info.user_id)

        if len(await request.body()) > MAX_PAYLOAD_SIZE:
            logger.warning(f"Payload size exceeds {MAX_PAYLOAD_SIZE} characters")
            raise HTTPException(
                status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                detail=f"Total payload size exceeds {MAX_PAYLOAD_SIZE} characters"
            )

        try:
            # First check if the user has access to the session
            preferences = await user_preferences_repository.get_user_preference_by_user_id(user_info.user_id)
            if preferences is None or session_id not in preferences.sessions:
                raise UnauthorizedSessionAccessError(user_info.user_id, session_id)

            # Set the client_id context variable
            client_id_ctx_var.set(preferences.client_id)

            feedback = await user_feedback_service.upsert_user_feedback(user_info.user_id, session_id, feedback_request)
            return FeedbackResponse.from_feedback(feedback)

        except UnauthorizedSessionAccessError as e:
            logger.warning(e)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION)
        except (InvalidQuestionError, InvalidOptionError) as e:
            error_msg = str(e)
            logger.error(error_msg)
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=error_msg)
        except (QuestionsFileError, Exception) as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    ######################
    # Add the user feedback router to the users router
    ######################
    users_router.include_router(router)
