import logging
import os
from http import HTTPStatus

from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.params import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.constants.errors import HTTPErrorResponse
from app.invitations.repository import UserInvitationRepository
from app.invitations.types import GetInvitationCodeStatusResponse, InvitationCodeStatus, ClaimSource
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.get_user_preferences_repository import get_user_preferences_repository
from app.users.repositories import IUserPreferenceRepository
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
    async def _get_invitation_status(
        invitation_code: str | None = Query(default=None, description="Legacy invitation code for manual entry"),
        reg_code: str | None = Query(default=None, alias="reg_code", description="Secure-link registration code"),
        report_token: str | None = Query(default=None, alias="report_token", description="Token required for secure links"),
        invitations_repository: UserInvitationRepository = Depends(get_user_invitation_repository),
        user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository)
    ) -> GetInvitationCodeStatusResponse:

        try:
            # Secure-link validation path
            if reg_code:
                sec_token = os.getenv("SEC_TOKEN")
                normalized_report_token = report_token.casefold() if report_token else None
                normalized_sec_token = sec_token.casefold() if sec_token else None
                if not normalized_report_token or not normalized_sec_token:
                    raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail="Security token required")
                if normalized_report_token != normalized_sec_token:
                    raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Invalid security token")

                claim = await invitations_repository.get_claim_by_registration_code(reg_code)
                if claim is not None:
                    return GetInvitationCodeStatusResponse(
                        code=reg_code,
                        status=InvitationCodeStatus.USED,
                        source=ClaimSource.SECURE_LINK.value,
                        sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
                    )

                user_with_code = await user_preferences_repository.get_user_preference_by_registration_code(reg_code)
                if user_with_code is not None:
                    return GetInvitationCodeStatusResponse(
                        code=reg_code,
                        status=InvitationCodeStatus.USED,
                        source=ClaimSource.SECURE_LINK.value,
                        sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
                    )

                return GetInvitationCodeStatusResponse(
                    code=reg_code,
                    status=InvitationCodeStatus.VALID,
                    source=ClaimSource.SECURE_LINK.value,
                    sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
                )

            if not invitation_code:
                raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="invitation_code or reg_code is required")

            invitation = await invitations_repository.get_valid_invitation_by_code(invitation_code, enforce_capacity=False)

            if not invitation:
                return GetInvitationCodeStatusResponse(
                    code=invitation_code,
                    status=InvitationCodeStatus.INVALID,
                    sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE,
                    source=ClaimSource.INVITATION.value
                )

            return GetInvitationCodeStatusResponse(
                code=invitation_code,
                status=InvitationCodeStatus.VALID,
                source=ClaimSource.INVITATION.value,
                # Return the invitation type if the status is valid
                invitation_type=invitation.invitation_type,
                sensitive_personal_data_requirement=invitation.sensitive_personal_data_requirement
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Opps! Something went wrong.")

    ######################
    # Add the user invitations router to the app
    ######################
    app.include_router(router)
