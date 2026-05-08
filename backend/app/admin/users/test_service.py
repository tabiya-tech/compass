"""Tests for UsersService — covers the parts that orchestrate
custom-claims propagation and registrations cascade-delete."""
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.admin.firebase import FirebaseService
from app.admin.registrations.repository import AdminRegistrationRepository
from app.admin.users._types import (
    CreateUserRequest,
    Role,
    UpdateRoleRequest,
)
from app.admin.users.service import UsersService


def _build_service(
    *,
    firebase_user=None,
    firebase_email: str | None = None,
    delete_count: int = 0,
):
    firebase_service = MagicMock(spec=FirebaseService)
    firebase_service.create_user = MagicMock(
        return_value=firebase_user or SimpleNamespace(uid="uid-1", email=firebase_email or "u@e.com", display_name="U")
    )
    firebase_service.get_user = MagicMock(
        return_value=SimpleNamespace(uid="uid-1", email=firebase_email or "u@e.com")
    )
    firebase_service.delete_user = MagicMock()
    firebase_service.set_custom_claims = MagicMock()
    firebase_service.create_access_role = AsyncMock()
    firebase_service.update_access_role = AsyncMock()
    firebase_service.delete_access_role = AsyncMock()

    registrations_repo = MagicMock(spec=AdminRegistrationRepository)
    registrations_repo.delete_by_email = AsyncMock(return_value=delete_count)

    return UsersService(firebase_service, registrations_repo), firebase_service, registrations_repo


class TestCreateUser:
    @pytest.mark.asyncio
    async def test_mirrors_role_into_custom_claims_after_writing_access_role(self):
        # GIVEN a service set up to create an institution_staff user
        given_tenant = "Admin-Dashboard-test"
        given_request = CreateUserRequest(
            email="alice@school.edu",
            name="Alice",
            role=Role.INSTITUTION_STAFF,
            institution_id="inst-1",
        )
        service, firebase_service, _ = _build_service(
            firebase_user=SimpleNamespace(uid="uid-1", email="alice@school.edu", display_name="Alice"),
        )

        # WHEN create_user is called
        await service.create_user(tenant_id=given_tenant, request=given_request)

        # THEN custom claims are set with role + institutionId on the new user
        firebase_service.set_custom_claims.assert_called_once_with(
            tenant_id=given_tenant,
            user_id="uid-1",
            role="institution_staff",
            institution_id="inst-1",
        )

    @pytest.mark.asyncio
    async def test_does_not_generate_a_password_reset_link(self):
        # Regression guard: the backend must NOT generate or log reset links —
        # logged links are recoverable credentials. Email delivery is the
        # frontend's job (Firebase sendPasswordResetEmail).

        # GIVEN a service with a spy on the link generator
        given_tenant = "Admin-Dashboard-test"
        given_request = CreateUserRequest(
            email="alice@school.edu",
            name="Alice",
            role=Role.INSTITUTION_STAFF,
            institution_id="inst-1",
        )
        service, firebase_service, _ = _build_service()
        firebase_service.generate_password_reset_link = MagicMock(return_value="https://reset")

        # WHEN create_user is called
        await service.create_user(tenant_id=given_tenant, request=given_request)

        # THEN no reset link is generated server-side; email delivery is the frontend's job
        firebase_service.generate_password_reset_link.assert_not_called()

    @pytest.mark.asyncio
    async def test_does_not_set_institution_id_in_claims_for_admin(self):
        # GIVEN a service set up to create a cross-institution admin
        given_tenant = "Admin-Dashboard-test"
        given_request = CreateUserRequest(
            email="bob@org.edu",
            name="Bob",
            role=Role.ADMIN,
            institution_id=None,
        )
        service, firebase_service, _ = _build_service(
            firebase_user=SimpleNamespace(uid="uid-2", email="bob@org.edu", display_name="Bob"),
        )

        # WHEN create_user is called
        await service.create_user(tenant_id=given_tenant, request=given_request)

        # THEN custom claims are set with role only, no institutionId
        firebase_service.set_custom_claims.assert_called_once_with(
            tenant_id=given_tenant,
            user_id="uid-2",
            role="admin",
            institution_id=None,
        )


class TestUpdateRole:
    @pytest.mark.asyncio
    async def test_writes_firestore_doc_and_mirrors_into_custom_claims(self):
        # GIVEN a service and a role-change request to institution_staff
        given_tenant = "Admin-Dashboard-test"
        given_user_id = "uid-9"
        given_request = UpdateRoleRequest(role=Role.INSTITUTION_STAFF, institution_id="inst-9")
        service, firebase_service, _ = _build_service()

        # WHEN update_role is called
        await service.update_role(tenant_id=given_tenant, user_id=given_user_id, request=given_request)

        # THEN both the Firestore access_role doc and the token custom claims are updated
        firebase_service.update_access_role.assert_awaited_once_with(
            user_id=given_user_id,
            role="institution_staff",
            institution_id="inst-9",
        )
        firebase_service.set_custom_claims.assert_called_once_with(
            tenant_id=given_tenant,
            user_id=given_user_id,
            role="institution_staff",
            institution_id="inst-9",
        )


class TestDeleteUser:
    @pytest.mark.asyncio
    async def test_cascades_to_registrations_when_email_is_resolvable(self):
        # GIVEN a service whose Firebase user lookup returns an email
        given_tenant = "Admin-Dashboard-test"
        given_user_id = "uid-7"
        given_email = "to-delete@school.edu"
        service, firebase_service, registrations_repo = _build_service(
            firebase_email=given_email,
            delete_count=1,
        )

        # WHEN delete_user is called
        await service.delete_user(tenant_id=given_tenant, user_id=given_user_id)

        # THEN the email is read before the Firebase delete, and the registration row is cascade-deleted
        firebase_service.get_user.assert_called_once_with(tenant_id=given_tenant, user_id=given_user_id)
        firebase_service.delete_user.assert_called_once_with(tenant_id=given_tenant, user_id=given_user_id)
        firebase_service.delete_access_role.assert_awaited_once_with(user_id=given_user_id)
        registrations_repo.delete_by_email.assert_awaited_once_with(given_email)

    @pytest.mark.asyncio
    async def test_skips_cascade_when_firebase_user_no_longer_exists(self):
        # GIVEN a service where Firebase lookup returns None (user already gone)
        given_tenant = "Admin-Dashboard-test"
        given_user_id = "uid-missing"
        service, firebase_service, registrations_repo = _build_service()
        firebase_service.get_user = MagicMock(return_value=None)

        # WHEN delete_user is called
        await service.delete_user(tenant_id=given_tenant, user_id=given_user_id)

        # THEN Firebase + Firestore deletes are still attempted, but no cascade is performed
        firebase_service.delete_user.assert_called_once()
        firebase_service.delete_access_role.assert_awaited_once()
        registrations_repo.delete_by_email.assert_not_awaited()
