from fastapi import FastAPI, APIRouter, Depends

from app.job_preferences.get_job_preferences_service import get_job_preferences_service
from app.job_preferences.service import IJobPreferencesService


def add_job_preferences_routes(app: FastAPI):
    """
    Add all routes related to job preferences to the FastAPI app.
    :param app: FastAPI: The FastAPI app to add the routes to.
    :return:
    """
    router = APIRouter(prefix="/job-preferences", tags=["job-preferences"])

    # TODO change the path and implement the logic as needed
    @router.post(
        path="/session/{session_id}",
        description="Create or update job preferences for a session",
        name="create or update job preferences"
    )
    async def _create_or_update_job_preferences(
        session_id: int,
        job_preferences_service: IJobPreferencesService = Depends(get_job_preferences_service) # this is an example route with dependency injection of the job preferences service
    ):
        pass

    app.include_router(router)
