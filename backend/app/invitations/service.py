from motor.motor_asyncio import AsyncIOMotorDatabase

from app.constants.errors import ErrorService
from app.invitations.repository import UserInvitationRepository
from app.invitations.types import GetInvitationCodeStatusResponse, InvitationCodeStatus


class UserInvitationService:
    """
    The UserInvitationService class is responsible for handling all the business logic related to user invitations.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        """
        Initialize the UserInvitationService and inject the user_invitation_repository
        """
        self._repository: UserInvitationRepository = UserInvitationRepository(db)

    async def get_invitation_status(self, invitation_code: str) -> GetInvitationCodeStatusResponse:
        """
        Get the status of a user invitation
        :param invitation_code: str: The code of the user invitation
        :return: dict: The status of the user invitation
        """
        try:
            invitation = await self._repository.get_valid_invitation_by_code(invitation_code)

            if not invitation:
                return GetInvitationCodeStatusResponse(
                    invitation_code=invitation_code,
                    status=InvitationCodeStatus.INVALID
                )

            return GetInvitationCodeStatusResponse(
                invitation_code=invitation_code,
                status=InvitationCodeStatus.VALID,
                # Return the invitation type if the status is valid
                invitation_type=invitation.invitation_type
            )
        except Exception as e:
            ErrorService.handle(__name__, e)

    async def reduce_invitation_code_capacity(self, invitation_code: str) -> bool:
        """
        Reduce the remaining usage of the invitation code
        :param invitation_code: str: The code of the invitation
        :return:  Bool, whether the capacity was reduced or not
        """
        try:
            return await self._repository.reduce_capacity(invitation_code)
        except Exception as e:
            ErrorService.handle(__name__, e)
