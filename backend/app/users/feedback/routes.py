from fastapi import APIRouter, status
from fastapi.params import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.constants.errors import HTTPErrorResponse
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication, UserInfo
from app.users.feedback.service import UserFeedbackService
from app.users.feedback.types import CreateFeedbackRequest


def add_user_feedback_routes(users_router: APIRouter, auth: Authentication):
    """
    Add all routes related to user feedback to the user's router.
    :param users_router: APIRouter: The router to add the user feedback routes to.
    :param auth: Authentication: The authentication instance to use for the routes.
    """

    router = APIRouter(prefix="/feedback", tags=["users-feedback"])
    """
    User Feedback Routes
    """

    @router.post("",
                 status_code=status.HTTP_201_CREATED,
                 responses={400: {"model": HTTPErrorResponse}, 403: {"model": HTTPErrorResponse},
                            409: {"model": HTTPErrorResponse}, 500: {"model": HTTPErrorResponse}},
                 name="add feedback response",
                 description="add user feedback responses for a specific session"
                 )
    async def _user_feedback_handler(body: CreateFeedbackRequest, user_info: UserInfo = Depends(auth.get_user_info()),
                                     db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)):
        user_feedback_service = UserFeedbackService(db)
        await user_feedback_service.create_user_feedback(body, user_info)
        return {}

    ######################
    # Add the user feedback router to the users router
    ######################
    users_router.include_router(router)
