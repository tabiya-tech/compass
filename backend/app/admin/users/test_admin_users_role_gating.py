"""Tests verifying that /admin/users actions respect the role gating contract:
- POST / DELETE / PATCH role: super_admin only
- GET: any authenticated admin-tier role
- PATCH profile: any authenticated admin-tier role (no anonymous access)
"""
from http import HTTPStatus
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.admin.users._types import (
    CreateUserResponse,
    DeleteUserResponse,
    ListUsersResponse,
    UpdateProfileResponse,
    UpdateRoleResponse,
)
from app.admin.users.routes import get_admin_users_routes
from app.admin.users.service import UsersService, get_users_service
from app.users.auth import SignInProvider, UserInfo
from common_libs.test_utilities.mock_auth import MockAuth, UnauthenticatedMockAuth


@pytest.fixture(autouse=True)
def _stub_application_config(monkeypatch):
    """Stub the application config so admin_firebase_tenant_id is available in tests that hit the handler."""
    cfg = MagicMock()
    cfg.admin_firebase_tenant_id = "tenant-X"
    monkeypatch.setattr("app.admin.users.routes.get_application_config", lambda: cfg)


def _client_for(role: str) -> tuple[TestClient, MagicMock]:
    """Build a TestClient where the caller is mocked with the given role and a Firebase email/password sign-in."""
    mocked_users_service = MagicMock(spec=UsersService)
    mocked_users_service.list_users = AsyncMock(
        return_value=ListUsersResponse(users=[], next_page_token=None)
    )
    mocked_users_service.create_user = AsyncMock(
        return_value=CreateUserResponse(
            uid="new-uid",
            email="new@example.com",
            display_name="New",
            role="admin",
            institution_id=None,
        )
    )
    mocked_users_service.delete_user = AsyncMock(
        return_value=DeleteUserResponse(uid="some-uid", deleted=True)
    )
    mocked_users_service.update_role = AsyncMock(
        return_value=UpdateRoleResponse(uid="some-uid", role="admin", institution_id=None)
    )
    mocked_users_service.update_profile = AsyncMock(
        return_value=UpdateProfileResponse(uid="some-uid", name="New Name", email="new@example.com")
    )

    mock_auth = MockAuth(
        user=UserInfo(
            user_id="caller-uid",
            email="caller@example.com",
            token="t",  # nosec B106 — test fixture, not a credential
            sign_in_provider=SignInProvider.PASSWORD,
            role=role,
        )
    )

    app = FastAPI()
    app.dependency_overrides[get_users_service] = lambda: mocked_users_service
    router = get_admin_users_routes(mock_auth)
    app.include_router(router, prefix="/admin/users")
    return TestClient(app), mocked_users_service


def _unauthenticated_client() -> TestClient:
    """Build a TestClient where every request fails the JWT check with 401."""
    mocked_users_service = MagicMock(spec=UsersService)
    mocked_users_service.update_profile = AsyncMock()

    app = FastAPI()
    app.dependency_overrides[get_users_service] = lambda: mocked_users_service
    router = get_admin_users_routes(UnauthenticatedMockAuth())
    app.include_router(router, prefix="/admin/users")
    return TestClient(app)


class TestCreateUserGating:
    """POST /admin/users must reject non-super-admin callers and accept super_admin."""

    @pytest.mark.parametrize("given_role", ["admin", "institution_staff"])
    def test_returns_403_for_non_super_admin(self, given_role: str):
        # GIVEN a caller authenticated with a non-super_admin role
        client, _ = _client_for(given_role)

        # WHEN they POST a new user
        actual_response = client.post(
            "/admin/users",
            json={"email": "new@example.com", "name": "New", "role": "admin"},
        )

        # THEN the request is forbidden
        assert actual_response.status_code == HTTPStatus.FORBIDDEN

    def test_returns_201_for_super_admin(self):
        # GIVEN a caller authenticated as super_admin
        client, mocked_users_service = _client_for("super_admin")

        # WHEN they POST a new user
        actual_response = client.post(
            "/admin/users",
            json={"email": "new@example.com", "name": "New", "role": "admin"},
        )

        # THEN the request is accepted
        assert actual_response.status_code == HTTPStatus.CREATED
        # AND the service is invoked
        mocked_users_service.create_user.assert_awaited_once()


class TestDeleteUserGating:
    """DELETE /admin/users/{uid} must reject non-super-admin callers and accept super_admin."""

    @pytest.mark.parametrize("given_role", ["admin", "institution_staff"])
    def test_returns_403_for_non_super_admin(self, given_role: str):
        # GIVEN a caller authenticated with a non-super_admin role
        client, _ = _client_for(given_role)

        # WHEN they DELETE a user
        actual_response = client.delete("/admin/users/some-uid")

        # THEN the request is forbidden
        assert actual_response.status_code == HTTPStatus.FORBIDDEN

    def test_returns_200_for_super_admin(self):
        # GIVEN a caller authenticated as super_admin
        client, mocked_users_service = _client_for("super_admin")

        # WHEN they DELETE a user
        actual_response = client.delete("/admin/users/some-uid")

        # THEN the request is accepted
        assert actual_response.status_code == HTTPStatus.OK
        # AND the service is invoked
        mocked_users_service.delete_user.assert_awaited_once()


class TestUpdateRoleGating:
    """PATCH /admin/users/{uid}/role must reject non-super-admin callers and accept super_admin."""

    @pytest.mark.parametrize("given_role", ["admin", "institution_staff"])
    def test_returns_403_for_non_super_admin(self, given_role: str):
        # GIVEN a caller authenticated with a non-super_admin role
        client, _ = _client_for(given_role)

        # WHEN they PATCH the role of a user
        actual_response = client.patch(
            "/admin/users/some-uid/role",
            json={"role": "admin"},
        )

        # THEN the request is forbidden
        assert actual_response.status_code == HTTPStatus.FORBIDDEN

    def test_returns_200_for_super_admin(self):
        # GIVEN a caller authenticated as super_admin
        client, mocked_users_service = _client_for("super_admin")

        # WHEN they PATCH the role of a user
        actual_response = client.patch(
            "/admin/users/some-uid/role",
            json={"role": "admin"},
        )

        # THEN the request is accepted
        assert actual_response.status_code == HTTPStatus.OK
        # AND the service is invoked
        mocked_users_service.update_role.assert_awaited_once()


class TestListUsersGating:
    """GET /admin/users must accept any authenticated admin-tier role (read-only access)."""

    @pytest.mark.parametrize("given_role", ["super_admin", "admin", "institution_staff"])
    def test_returns_200_for_any_authenticated_admin_tier_role(self, given_role: str):
        # GIVEN a caller authenticated with any admin-tier role
        client, mocked_users_service = _client_for(given_role)

        # WHEN they GET the user list
        actual_response = client.get("/admin/users")

        # THEN the request is accepted
        assert actual_response.status_code == HTTPStatus.OK
        # AND the service is invoked
        mocked_users_service.list_users.assert_awaited_once()


class TestUpdateProfileGating:
    """PATCH /admin/users/{uid}/profile must require a valid JWT but is not super-admin-restricted."""

    def test_returns_401_without_authentication(self):
        # GIVEN no caller authentication
        client = _unauthenticated_client()

        # WHEN a PATCH /profile is attempted
        actual_response = client.patch(
            "/admin/users/some-uid/profile",
            json={"name": "Whatever"},
        )

        # THEN the request is rejected before reaching the service
        assert actual_response.status_code == HTTPStatus.UNAUTHORIZED

    @pytest.mark.parametrize("given_role", ["super_admin", "admin", "institution_staff"])
    def test_returns_200_for_any_authenticated_admin_tier_role(self, given_role: str):
        # GIVEN a caller authenticated with any admin-tier role
        client, mocked_users_service = _client_for(given_role)

        # WHEN they PATCH a profile
        actual_response = client.patch(
            "/admin/users/some-uid/profile",
            json={"name": "New Name"},
        )

        # THEN the request is accepted
        assert actual_response.status_code == HTTPStatus.OK
        # AND the service is invoked
        mocked_users_service.update_profile.assert_awaited_once()
