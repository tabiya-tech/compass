from fastapi import FastAPI, APIRouter

from app.constants.errors import HTTPErrorResponse
from app.invitations.service import UserInvitationService
from app.invitations.types import GetInvitationCodeStatusResponse


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

    invitations_service = UserInvitationService()

    @router.get(
        path="/check-status",
        description="""Get the status of the invitation code""",
        response_model=GetInvitationCodeStatusResponse,
        responses={500: {"model": HTTPErrorResponse}},
        name="get user invitation status"
    )
    async def _get_invitation_status(code: str) -> GetInvitationCodeStatusResponse:
        return await invitations_service.get_invitation_status(code)

    ######################
    # Add the user invitations router to the app
    ######################
    app.include_router(router)
