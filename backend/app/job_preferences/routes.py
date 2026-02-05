from fastapi import FastAPI, APIRouter, Depends, HTTPException, status

from app.job_preferences.get_job_preferences_service import get_job_preferences_service
from app.job_preferences.service import IJobPreferencesService
from app.job_preferences.types import JobPreferences


def add_job_preferences_routes(app: FastAPI):
    """
    Add all routes related to job preferences to the FastAPI app.
    :param app: FastAPI: The FastAPI app to add the routes to.
    :return:
    """
    router = APIRouter(prefix="/job-preferences", tags=["job-preferences"])

    @router.post(
        path="/session/{session_id}",
        description="Create or update job preferences for a session",
        name="create or update job preferences",
        status_code=status.HTTP_201_CREATED
    )
    async def _create_or_update_job_preferences(
        session_id: int,
        preferences: JobPreferences,
        job_preferences_service: IJobPreferencesService = Depends(get_job_preferences_service)
    ):
        """
        Create or update job preferences for a session.

        Args:
            session_id: Compass user session ID
            preferences: JobPreferences object with all preference data

        Returns:
            Success message

        Raises:
            HTTPException: If validation fails or database error occurs
        """
        try:
            await job_preferences_service.create_or_update(
                session_id=session_id,
                preferences=preferences
            )
            return {
                "status": "success",
                "message": f"Job preferences saved for session {session_id}",
                "confidence_score": preferences.confidence_score
            }
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save job preferences: {str(e)}"
            )

    @router.get(
        path="/session/{session_id}",
        description="Get job preferences for a session",
        name="get job preferences",
        response_model=JobPreferences
    )
    async def _get_job_preferences(
        session_id: int,
        job_preferences_service: IJobPreferencesService = Depends(get_job_preferences_service)
    ):
        """
        Retrieve job preferences for a session.

        Args:
            session_id: Compass user session ID

        Returns:
            JobPreferences object if found

        Raises:
            HTTPException: If preferences not found or database error occurs
        """
        try:
            preferences = await job_preferences_service.get_by_session(session_id)
            if preferences is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No job preferences found for session {session_id}"
                )
            return preferences
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to retrieve job preferences: {str(e)}"
            )

    app.include_router(router)
