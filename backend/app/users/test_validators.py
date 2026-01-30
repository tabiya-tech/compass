from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.app_config import ApplicationConfig
from app.invitations import UserInvitation, InvitationType, UserInvitationRepository
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement
from app.users.validators import AnonymousUserValidator, RegisteredUserValidator
from common_libs.test_utilities import get_random_printable_string


def _create_user_invitation(invitation_type: InvitationType) -> UserInvitation:
    """Helper function to create a UserInvitation with the specified type"""
    return UserInvitation(
        invitation_code=get_random_printable_string(10),
        remaining_usage=100,
        allowed_usage=100,
        valid_from=datetime(2024, 1, 1, tzinfo=timezone.utc),
        valid_until=datetime(2025, 12, 31, tzinfo=timezone.utc),
        invitation_type=invitation_type,
        sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
    )


def _create_mock_app_config(disable_registration_code: bool) -> ApplicationConfig:
    """Helper function to create a mock ApplicationConfig with the specified disable_registration_code value"""
    return MagicMock(spec=ApplicationConfig, disable_registration_code=disable_registration_code)


@pytest.mark.asyncio
class TestAnonymousUserValidatorIsInvitationCodeValid:
    """
    Tests for the AnonymousUserValidator.is_invitation_code_valid method
    """

    async def test_returns_false_when_invitation_code_is_none(self):
        # GIVEN a mock user invitation repository
        given_user_invitation_repository = MagicMock(spec=UserInvitationRepository)

        # AND an AnonymousUserValidator
        given_validator = AnonymousUserValidator(given_user_invitation_repository)

        # AND no invitation code
        given_invitation_code = None

        # WHEN validating the invitation code
        actual_is_valid, actual_invitation = await given_validator.is_invitation_code_valid(given_invitation_code)

        # THEN the invitation code should be invalid
        assert actual_is_valid is False

        # AND the invitation should be None
        assert actual_invitation is None

    async def test_returns_false_when_invitation_code_is_not_found(self):
        # GIVEN a mock user invitation repository that returns None
        given_user_invitation_repository = MagicMock(spec=UserInvitationRepository)
        given_user_invitation_repository.get_valid_invitation_by_code = AsyncMock(return_value=None)

        # AND an AnonymousUserValidator
        given_validator = AnonymousUserValidator(given_user_invitation_repository)

        # AND an invitation code
        given_invitation_code = get_random_printable_string(10)

        # WHEN validating the invitation code
        actual_is_valid, actual_invitation = await given_validator.is_invitation_code_valid(given_invitation_code)

        # THEN the invitation code should be invalid
        assert actual_is_valid is False
        # AND the invitation should be None
        assert actual_invitation is None

    async def test_returns_false_when_invitation_type_is_not_login(self):
        # GIVEN a REGISTER type invitation
        given_invitation = _create_user_invitation(InvitationType.REGISTER)

        # AND a mock user invitation repository that returns the invitation
        given_user_invitation_repository = MagicMock(spec=UserInvitationRepository)
        given_user_invitation_repository.get_valid_invitation_by_code = AsyncMock(return_value=given_invitation)

        # AND an AnonymousUserValidator
        given_validator = AnonymousUserValidator(given_user_invitation_repository)

        # AND an invitation code
        given_invitation_code = given_invitation.invitation_code

        # WHEN validating the invitation code
        actual_is_valid, actual_invitation = await given_validator.is_invitation_code_valid(given_invitation_code)

        # THEN the invitation code should be invalid
        assert actual_is_valid is False
        # AND the invitation should be None
        assert actual_invitation is None

    async def test_returns_true_when_invitation_type_is_login(self):
        # GIVEN a LOGIN type invitation
        given_invitation = _create_user_invitation(InvitationType.LOGIN)

        # AND a mock user invitation repository that returns the invitation
        given_user_invitation_repository = MagicMock(spec=UserInvitationRepository)
        given_user_invitation_repository.get_valid_invitation_by_code = AsyncMock(return_value=given_invitation)

        # AND an AnonymousUserValidator
        given_validator = AnonymousUserValidator(given_user_invitation_repository)

        # AND an invitation code
        given_invitation_code = given_invitation.invitation_code

        # WHEN validating the invitation code
        actual_is_valid, actual_invitation = await given_validator.is_invitation_code_valid(given_invitation_code)

        # THEN the invitation code should be valid
        assert actual_is_valid is True
        # AND the invitation should be returned
        assert actual_invitation == given_invitation


@pytest.mark.asyncio
class TestRegisteredUserValidatorIsInvitationCodeValid:
    """
    Tests for the RegisteredUserValidator.is_invitation_code_valid method
    """

    async def test_returns_true_when_registration_code_bypass_is_enabled_without_invitation_code(self):
        # GIVEN an application config with registration code bypass enabled
        given_app_config = _create_mock_app_config(disable_registration_code=True)

        # AND a mock user invitation repository
        given_user_invitation_repository = MagicMock(spec=UserInvitationRepository)

        # AND a RegisteredUserValidator
        given_validator = RegisteredUserValidator(given_app_config, given_user_invitation_repository)

        # AND no invitation code
        given_invitation_code = None

        # WHEN validating the invitation code
        actual_is_valid, actual_invitation = await given_validator.is_invitation_code_valid(given_invitation_code)

        # THEN the invitation code should be valid
        assert actual_is_valid is True
        # AND the invitation should be None
        assert actual_invitation is None

    async def test_returns_true_and_logs_warning_when_bypass_enabled_with_invitation_code(self, caplog):
        # GIVEN an application config with registration code bypass enabled
        given_app_config = _create_mock_app_config(disable_registration_code=True)

        # AND a mock user invitation repository
        given_user_invitation_repository = MagicMock(spec=UserInvitationRepository)

        # AND a RegisteredUserValidator
        given_validator = RegisteredUserValidator(given_app_config, given_user_invitation_repository)

        # AND an invitation code
        given_invitation_code = get_random_printable_string(10)

        # WHEN validating the invitation code
        actual_is_valid, actual_invitation = await given_validator.is_invitation_code_valid(given_invitation_code)

        # THEN the invitation code should be valid
        assert actual_is_valid is True

        # AND the invitation should be None
        assert actual_invitation is None

        # AND a warning should be logged
        assert "Registration code bypass is enabled but an invitation code was provided" in caplog.text
        assert given_invitation_code in caplog.text

    async def test_returns_false_when_bypass_disabled_and_invitation_not_found(self):
        # GIVEN an application config with registration code bypass disabled
        given_app_config = _create_mock_app_config(disable_registration_code=False)

        # AND a mock user invitation repository that returns None
        given_user_invitation_repository = MagicMock(spec=UserInvitationRepository)
        given_user_invitation_repository.get_valid_invitation_by_code = AsyncMock(return_value=None)

        # AND a RegisteredUserValidator
        given_validator = RegisteredUserValidator(given_app_config, given_user_invitation_repository)

        # AND an invitation code
        given_invitation_code = get_random_printable_string(10)

        # WHEN validating the invitation code
        actual_is_valid, actual_invitation = await given_validator.is_invitation_code_valid(given_invitation_code)

        # THEN the invitation code should be invalid
        assert actual_is_valid is False
        # AND the invitation should be None
        assert actual_invitation is None

    async def test_returns_false_when_bypass_disabled_and_invitation_type_is_not_register(self):
        # GIVEN an application config with registration code bypass disabled
        given_app_config = _create_mock_app_config(disable_registration_code=False)

        # AND a LOGIN type invitation
        given_invitation = _create_user_invitation(InvitationType.LOGIN)

        # AND a mock user invitation repository that returns the invitation
        given_user_invitation_repository = MagicMock(spec=UserInvitationRepository)
        given_user_invitation_repository.get_valid_invitation_by_code = AsyncMock(return_value=given_invitation)

        # AND a RegisteredUserValidator
        given_validator = RegisteredUserValidator(given_app_config, given_user_invitation_repository)

        # AND an invitation code
        given_invitation_code = given_invitation.invitation_code

        # WHEN validating the invitation code
        actual_is_valid, actual_invitation = await given_validator.is_invitation_code_valid(given_invitation_code)

        # THEN the invitation code should be invalid
        assert actual_is_valid is False
        # AND the invitation should be None
        assert actual_invitation is None

    async def test_returns_true_when_bypass_disabled_and_invitation_type_is_register(self):
        # GIVEN an application config with registration code bypass disabled
        given_app_config = _create_mock_app_config(disable_registration_code=False)

        # AND a REGISTER type invitation
        given_invitation = _create_user_invitation(InvitationType.REGISTER)

        # AND a mock user invitation repository that returns the invitation
        given_user_invitation_repository = MagicMock(spec=UserInvitationRepository)
        given_user_invitation_repository.get_valid_invitation_by_code = AsyncMock(return_value=given_invitation)

        # AND a RegisteredUserValidator
        given_validator = RegisteredUserValidator(given_app_config, given_user_invitation_repository)

        # AND an invitation code
        given_invitation_code = given_invitation.invitation_code

        # WHEN validating the invitation code
        actual_is_valid, actual_invitation = await given_validator.is_invitation_code_valid(given_invitation_code)

        # THEN the invitation code should be valid
        assert actual_is_valid is True
        # AND the invitation should be returned
        assert actual_invitation == given_invitation
