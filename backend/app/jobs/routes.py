from fastapi import FastAPI, APIRouter, Depends

from app.jobs.get_job_service import get_job_service
from app.jobs.service import IJobService


def add_jobs_routes(app: FastAPI):
    """
    Add all routes related to jobs to the FastAPI app.
    :param app: FastAPI: The FastAPI app to add the routes to.
    :return: #TODO defne as needed
    """
    # TODO adjust path as needed
    # Also remove the include_in_schema=False once the route is working
    router = APIRouter(prefix="/jobs", tags=["jobs"], include_in_schema=False)

    @router.post(
        path="/",
        description="Create a new job credential record",
        name="create job"
    )

    async def _create_job(
        job_service: IJobService = Depends(get_job_service)  #ths is an example route with dependency injection of the job service
    ):
        pass

    app.include_router(router)