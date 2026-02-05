import abc
import logging
from abc import ABC
from typing import Optional

from app.app_config import get_application_config, ApplicationConfig
from app.invitations import UserInvitationRepository, InvitationType, UserInvitation


class UserPreferencesValidator(ABC):
    @abc.abstractmethod
    async def is_invitation_code_valid(self, invitation_code: Optional[str]) -> tuple[bool, Optional[UserInvitation]]:
        raise NotImplementedError


class AnonymousUserValidator(UserPreferencesValidator):
    def __init__(self, user_invitation_repository: UserInvitationRepository):
        self._user_invitation_repository = user_invitation_repository

    async def is_invitation_code_valid(self, invitation_code: Optional[str]) -> tuple[bool, Optional[UserInvitation]]:
        if invitation_code is None:
            return False, None

        invitation = await self._user_invitation_repository.get_valid_invitation_by_code(invitation_code)

        if invitation is None:
            return False, None

        if invitation.invitation_type != InvitationType.LOGIN:
             return False, None

        return True, invitation


class RegisteredUserValidator(UserPreferencesValidator):
    def __init__(self, app_config: ApplicationConfig, user_invitation_repository: UserInvitationRepository):
        self._app_config = app_config
        self._user_invitation_repository = user_invitation_repository
        self._logger = logging.getLogger(self.__class__.__name__)

    async def is_invitation_code_valid(self, invitation_code: Optional[str]) -> tuple[bool, Optional[UserInvitation]]:
        can_bypass = self._app_config.disable_registration_code

        if can_bypass:
            if invitation_code is not None:
                self._logger.warning(f"Registration code bypass is enabled but an invitation code was provided. {invitation_code}")

            return True, None

        invitation = await self._user_invitation_repository.get_valid_invitation_by_code(invitation_code)

        if invitation is None:
            return False, None

        if invitation.invitation_type != InvitationType.REGISTER:
            return False, None

        return True, invitation
