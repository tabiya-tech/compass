from fastapi import FastAPI, APIRouter
from fastapi.params import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.constants.errors import HTTPErrorResponse
from app.invitations.service import UserInvitationService
from app.invitations.types import GetInvitationCodeStatusResponse
from app.server_dependencies.db_dependencies import CompassDBProvider


async def get_user_invitations_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)):
    return UserInvitationService(db)


def add_user_invitations_routes(app: FastAPI):
    """
    Add all routes related to user invitations to the FastAPI app.
    :param app: FastAPI: The FastAPI app to add the routes to.
    :return:
    """

    router = APIRouter(prefix="/user-invitations", tags=["user-invitations"])
    """
    User Invitations Routes
    """

    @router.get(
        path="/check-status",
        description="""Get the status of the invitation code""",
        response_model=GetInvitationCodeStatusResponse,
        responses={500: {"model": HTTPErrorResponse}},
        name="get user invitation status"
    )
    async def _get_invitation_status(invitation_code: str,
                                     invitations_service: UserInvitationService = Depends(get_user_invitations_service)) -> GetInvitationCodeStatusResponse:
        return await invitations_service.get_invitation_status(invitation_code)

    ######################
    # Add the user invitations router to the app
    ######################
    app.include_router(router)
