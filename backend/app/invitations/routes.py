import logging
from http import HTTPStatus

from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.params import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.constants.errors import HTTPErrorResponse
from app.invitations.repository import UserInvitationRepository
from app.invitations.types import GetInvitationCodeStatusResponse, InvitationCodeStatus
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement


async def get_user_invitation_repository(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)):
    return UserInvitationRepository(db)


def add_user_invitations_routes(app: FastAPI):
    """
    Add all routes related to user invitations to the FastAPI app.
    :param app: FastAPI: The FastAPI app to add the routes to.
    :return:
    """
    logger = logging.getLogger(__name__)

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
                                     invitations_repository: UserInvitationRepository = Depends(get_user_invitation_repository)
                                     ) -> GetInvitationCodeStatusResponse:

        try:
            invitation = await invitations_repository.get_valid_invitation_by_code(invitation_code)

            if not invitation:
                return GetInvitationCodeStatusResponse(
                    invitation_code=invitation_code,
                    status=InvitationCodeStatus.INVALID,
                    sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
                )

            return GetInvitationCodeStatusResponse(
                invitation_code=invitation_code,
                status=InvitationCodeStatus.VALID,
                # Return the invitation type if the status is valid
                invitation_type=invitation.invitation_type,
                sensitive_personal_data_requirement=invitation.sensitive_personal_data_requirement
            )
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Opps! Something went wrong.")

    ######################
    # Add the user invitations router to the app
    ######################
    app.include_router(router)
