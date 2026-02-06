from fastapi import FastAPI, APIRouter, Depends

from app.career_path.get_career_path_service import get_career_path_service
from app.career_path.service import ICareerPathService


def add_career_path_routes(app: FastAPI):
    """
    Add all routes related to career paths to the FastAPI app.
    :param app: FastAPI: The FastAPI app to add the routes to.
    :return:
    """
    # TODO: Implement career path routes as needed for Epic 3
    router = APIRouter(prefix="/career-path", tags=["career-path"])

    # TODO change the path and implement the logic as needed
    @router.post(
        path="/",
        description="Create a new career path record",
        name="create career path"
    )
    async def _create_career_path(
        career_path_service: ICareerPathService = Depends(get_career_path_service) # this is an example route with dependency injection of the career path service
    ):
        pass

    app.include_router(router)
