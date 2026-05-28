import logging
from http import HTTPStatus

from fastapi import FastAPI, APIRouter, Depends, HTTPException, status

from app.conversations.reactions.routes import get_user_preferences_repository
from app.errors.constants import NO_PERMISSION_FOR_SESSION
from app.errors.errors import UnauthorizedSessionAccessError
from app.job_preferences.get_job_preferences_service import get_job_preferences_service
from app.job_preferences.service import IJobPreferencesService
from app.job_preferences.types import JobPreferences
from app.users.auth import Authentication, UserInfo


def add_job_preferences_routes(app: FastAPI, authentication: Authentication):
    """
    Register the job-preferences routes with auth and per-session ownership checks.
    """
    logger = logging.getLogger(__name__)
    router = APIRouter(prefix="/conversations/{session_id}/job-preferences", tags=["job-preferences"])

    @router.post(
        path="",
        description="Create or update job preferences for a session",
        name="create or update job preferences",
        status_code=status.HTTP_201_CREATED,
    )
    async def _create_or_update_job_preferences(
        session_id: int,
        preferences: JobPreferences,
        user_info: UserInfo = Depends(authentication.get_user_info()),
        user_preferences_repository=Depends(get_user_preferences_repository),
        job_preferences_service: IJobPreferencesService = Depends(get_job_preferences_service),
    ):
        user_id = user_info.user_id
        try:
            current_user_preferences = await user_preferences_repository.get_user_preference_by_user_id(user_id)
            if current_user_preferences is None or session_id not in current_user_preferences.sessions:
                raise UnauthorizedSessionAccessError(user_id, session_id)

            await job_preferences_service.create_or_update(session_id=session_id, preferences=preferences)
            return {
                "status": "success",
                "message": f"Job preferences saved for session {session_id}",
                "confidence_score": preferences.confidence_score,
            }
        except UnauthorizedSessionAccessError as e:
            logger.warning(str(e))
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION) from e
        except ValueError as e:
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=str(e)) from e
        except HTTPException:
            raise
        except Exception as e:  # pylint: disable=broad-except
            logger.exception("Failed to save job preferences for session %s", session_id)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to save job preferences",
            ) from e

    @router.get(
        path="",
        description="Get job preferences for a session",
        name="get job preferences",
        response_model=JobPreferences,
    )
    async def _get_job_preferences(
        session_id: int,
        user_info: UserInfo = Depends(authentication.get_user_info()),
        user_preferences_repository=Depends(get_user_preferences_repository),
        job_preferences_service: IJobPreferencesService = Depends(get_job_preferences_service),
    ):
        user_id = user_info.user_id
        try:
            current_user_preferences = await user_preferences_repository.get_user_preference_by_user_id(user_id)
            if current_user_preferences is None or session_id not in current_user_preferences.sessions:
                raise UnauthorizedSessionAccessError(user_id, session_id)

            preferences = await job_preferences_service.get_by_session(session_id)
            if preferences is None:
                raise HTTPException(
                    status_code=HTTPStatus.NOT_FOUND,
                    detail=f"No job preferences found for session {session_id}",
                )
            return preferences
        except UnauthorizedSessionAccessError as e:
            logger.warning(str(e))
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=NO_PERMISSION_FOR_SESSION) from e
        except HTTPException:
            raise
        except Exception as e:  # pylint: disable=broad-except
            logger.exception("Failed to retrieve job preferences for session %s", session_id)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve job preferences",
            ) from e

    app.include_router(router)
