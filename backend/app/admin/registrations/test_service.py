"""Tests for the AdminRegistrationsService orchestration logic."""
from datetime import datetime, timezone
from typing import Optional
from unittest.mock import AsyncMock, MagicMock

import pytest
from firebase_admin.auth import EmailAlreadyExistsError

from app.admin.registrations.service import AdminRegistrationsService
from app.admin.registrations.types import (
    AdminRegistration,
    RegistrationRoleRequest,
    RegistrationStatus,
)
from app.admin.users._types import Role


def _build_pending_registration(
    requested_role: RegistrationRoleRequest = RegistrationRoleRequest.INSTITUTION_STAFF,
    institution_id: Optional[str] = "inst-1",
) -> AdminRegistration:
    return AdminRegistration(
        id="65a1b2c3d4e5f6a7b8c9d0e1",
        email="alice@school.edu",
        name="Alice Test",
        requested_role=requested_role,
        institution_id=institution_id,
        status=RegistrationStatus.PENDING,
        submitted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


def _service_with_mocks(
    *,
    initial_registration: AdminRegistration,
    create_user_side_effect=None,
):
    repository = MagicMock()
    repository.get_by_id = AsyncMock(return_value=initial_registration)
    repository.mark_decided = AsyncMock(return_value=initial_registration.model_copy(
        update={"status": RegistrationStatus.APPROVED}
    ))
    repository.create_or_replace_pending = AsyncMock(return_value=initial_registration)

    users_service = MagicMock()
    create_user_return = MagicMock(uid="new-firebase-uid")
    users_service.create_user = AsyncMock(
        return_value=create_user_return,
        side_effect=create_user_side_effect,
    )

    return AdminRegistrationsService(repository, users_service), repository, users_service


class TestApprove:
    @pytest.mark.asyncio
    async def test_calls_create_user_and_marks_approved(self, mocker):
        # GIVEN a pending instructor registration
        registration = _build_pending_registration()
        mocker.patch(
            "app.admin.registrations.service.get_application_config",
            return_value=MagicMock(admin_firebase_tenant_id="tenant-X"),
        )
        service, repository, users_service = _service_with_mocks(initial_registration=registration)

        # WHEN approve is called
        actual = await service.approve(registration.id, super_admin_uid="super-1")

        # THEN UsersService.create_user is invoked with the institution_staff role
        users_service.create_user.assert_awaited_once()
        call_kwargs = users_service.create_user.await_args.kwargs
        assert call_kwargs["tenant_id"] == "tenant-X"
        assert call_kwargs["request"].role == Role.INSTITUTION_STAFF
        assert call_kwargs["request"].institution_id == "inst-1"
        # AND the row is marked approved
        repository.mark_decided.assert_awaited_once()
        assert actual.registration.status == RegistrationStatus.APPROVED
        assert actual.uid == "new-firebase-uid"

    @pytest.mark.asyncio
    async def test_does_not_mark_decided_when_firebase_email_already_exists(self, mocker):
        # GIVEN a pending registration AND Firebase reports the email already exists
        registration = _build_pending_registration(RegistrationRoleRequest.ADMIN, institution_id=None)
        mocker.patch(
            "app.admin.registrations.service.get_application_config",
            return_value=MagicMock(admin_firebase_tenant_id="tenant-X"),
        )
        service, repository, _ = _service_with_mocks(
            initial_registration=registration,
            create_user_side_effect=EmailAlreadyExistsError(message="exists", cause=None, http_response=None),
        )

        # WHEN approve raises EmailAlreadyExistsError
        with pytest.raises(EmailAlreadyExistsError):
            await service.approve(registration.id, super_admin_uid="super-1")

        # THEN mark_decided is NOT called (the registration stays pending)
        repository.mark_decided.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_raises_when_not_pending(self, mocker):
        # GIVEN an already-approved registration
        registration = _build_pending_registration().model_copy(
            update={"status": RegistrationStatus.APPROVED}
        )
        mocker.patch(
            "app.admin.registrations.service.get_application_config",
            return_value=MagicMock(admin_firebase_tenant_id="tenant-X"),
        )
        service, _, users_service = _service_with_mocks(initial_registration=registration)

        # WHEN approve is called
        # THEN ValueError is raised and create_user is never called
        with pytest.raises(ValueError):
            await service.approve(registration.id, super_admin_uid="super-1")
        users_service.create_user.assert_not_awaited()


class TestReject:
    @pytest.mark.asyncio
    async def test_marks_rejected_with_reason_and_does_not_touch_firebase(self):
        # GIVEN a pending registration
        registration = _build_pending_registration()
        service, repository, users_service = _service_with_mocks(initial_registration=registration)
        repository.mark_decided.return_value = registration.model_copy(
            update={"status": RegistrationStatus.REJECTED, "rejection_reason": "not affiliated"}
        )

        # WHEN reject is called with a reason
        actual = await service.reject(registration.id, super_admin_uid="super-1", reason="not affiliated")

        # THEN the row is marked rejected with the reason and Firebase is not touched
        repository.mark_decided.assert_awaited_once()
        decided_kwargs = repository.mark_decided.await_args.kwargs
        assert decided_kwargs["status"] == RegistrationStatus.REJECTED
        assert decided_kwargs["rejection_reason"] == "not affiliated"
        users_service.create_user.assert_not_awaited()
        assert actual.status == RegistrationStatus.REJECTED


class TestGetStatus:
    @pytest.mark.asyncio
    async def test_returns_none_when_no_record(self):
        # GIVEN no record for the email
        repository = MagicMock()
        repository.get_by_email = AsyncMock(return_value=None)
        service = AdminRegistrationsService(repository, MagicMock())

        # WHEN get_status is called
        actual = await service.get_status("ghost@nowhere.io")

        # THEN status is None (no enumeration)
        assert actual.status is None
        assert actual.email == "ghost@nowhere.io"
