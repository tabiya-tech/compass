"""Tests for the public + super-admin registration routes."""
from http import HTTPStatus
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.admin.registrations import rate_limit as rate_limit_module
from app.admin.registrations.routes import _get_registrations_service, add_admin_registrations_routes
from app.admin.registrations.types import (
    AdminRegistration,
    ApproveRegistrationResponse,
    DuplicateActiveRegistrationError,
    RegistrationRoleRequest,
    RegistrationStatus,
    RegistrationStatusResponse,
)
from app.users.auth import SignInProvider, UserInfo
from common_libs.test_utilities.mock_auth import MockAuth
from common_libs.time_utilities import get_now


def _make_app(role: str = "super_admin") -> tuple[TestClient, MagicMock]:
    """Build a TestClient with a mocked AdminRegistrationsService and an authed user with the given role."""
    mocked_service = MagicMock()

    mock_auth = MockAuth(
        user=UserInfo(
            user_id="caller-uid",
            email="caller@example.com",
            token="t",  # nosec B106 # test fixture token, not a real credential
            sign_in_provider=SignInProvider.PASSWORD,
            role=role,
        )
    )

    app = FastAPI()
    app.dependency_overrides[_get_registrations_service] = lambda: mocked_service
    add_admin_registrations_routes(app, auth=mock_auth)
    return TestClient(app), mocked_service


def _sample_pending_registration() -> AdminRegistration:
    return AdminRegistration(
        id="65a1b2c3d4e5f6a7b8c9d0e1",
        email="alice@school.edu",
        name="Alice Test",
        requested_role=RegistrationRoleRequest.INSTITUTION_STAFF,
        institution_id="inst-1",
        status=RegistrationStatus.PENDING,
        submitted_at=get_now(),
    )


@pytest.fixture(autouse=True)
def _clear_rate_limit_buckets():
    """Reset the in-memory rate-limit buckets between tests so cases don't bleed into each other."""
    rate_limit_module._buckets.clear()  # pylint: disable=protected-access
    yield
    rate_limit_module._buckets.clear()  # pylint: disable=protected-access


class TestSubmitRegistration:
    def test_returns_201_for_valid_instructor_signup(self):
        # GIVEN a TestClient and a service that accepts the submission
        client, mocked_service = _make_app()
        mocked_service.submit = AsyncMock(return_value=_sample_pending_registration())

        # WHEN POST /admin-registrations is called with a valid payload
        actual_response = client.post(
            "/admin-registrations",
            json={
                "email": "alice@school.edu",
                "name": "Alice Test",
                "requested_role": "institution_staff",
                "institution_id": "inst-1",
            },
        )

        # THEN 201 is returned
        assert actual_response.status_code == HTTPStatus.CREATED
        # AND the response carries the new id and pending status
        actual_body = actual_response.json()
        assert actual_body["id"] == "65a1b2c3d4e5f6a7b8c9d0e1"
        assert actual_body["status"] == "pending"

    def test_returns_422_when_institution_id_missing_for_institution_staff(self):
        # GIVEN a TestClient
        client, _ = _make_app()

        # WHEN POST is called with a payload missing institution_id for an institution_staff signup
        actual_response = client.post(
            "/admin-registrations",
            json={
                "email": "alice@school.edu",
                "name": "Alice Test",
                "requested_role": "institution_staff",
            },
        )

        # THEN Pydantic rejects the payload
        assert actual_response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    def test_returns_422_when_requested_role_is_super_admin(self):
        # GIVEN a TestClient
        client, _ = _make_app()

        # WHEN someone tries to register as super_admin via the public endpoint
        actual_response = client.post(
            "/admin-registrations",
            json={
                "email": "evil@nope.com",
                "name": "Evil",
                "requested_role": "super_admin",
            },
        )

        # THEN Pydantic rejects the payload because super_admin is not in the allowed enum
        assert actual_response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    def test_returns_409_with_generic_detail_when_active_pending_exists(self):
        # GIVEN a service that reports a duplicate active registration
        client, mocked_service = _make_app()
        mocked_service.submit = AsyncMock(
            side_effect=DuplicateActiveRegistrationError("already pending for alice@school.edu")
        )

        # WHEN POST is called for that email
        actual_response = client.post(
            "/admin-registrations",
            json={
                "email": "alice@school.edu",
                "name": "Alice Test",
                "requested_role": "admin",
            },
        )

        # THEN 409 is returned
        assert actual_response.status_code == HTTPStatus.CONFLICT
        # AND the response detail does NOT include the email (no account enumeration)
        actual_detail = actual_response.json()["detail"]
        assert "alice@school.edu" not in actual_detail
        assert actual_detail == "An active registration already exists for this email."

    def test_returns_429_when_per_ip_rate_limit_exceeded(self):
        # GIVEN a TestClient and a service that always succeeds
        client, mocked_service = _make_app()
        mocked_service.submit = AsyncMock(return_value=_sample_pending_registration())
        given_payload = {
            "email": "alice@school.edu",
            "name": "Alice Test",
            "requested_role": "institution_staff",
            "institution_id": "inst-1",
        }
        # AND the per-IP limit is N requests per minute
        given_limit = rate_limit_module.REGISTRATION_RATE_LIMIT_PER_MIN

        # WHEN the limit is exhausted from a single IP
        for _ in range(given_limit):
            allowed = client.post("/admin-registrations", json=given_payload)
            assert allowed.status_code == HTTPStatus.CREATED
        # AND one more request is made from the same IP
        actual_response = client.post("/admin-registrations", json=given_payload)

        # THEN that request is rate-limited
        assert actual_response.status_code == HTTPStatus.TOO_MANY_REQUESTS


class TestGetRegistrationStatus:
    def test_returns_status_for_known_email(self):
        # GIVEN a service that knows about the email
        client, mocked_service = _make_app()
        mocked_service.get_status = AsyncMock(
            return_value=RegistrationStatusResponse(email="alice@school.edu", status=RegistrationStatus.PENDING)
        )

        # WHEN GET /status is called for that email
        actual_response = client.get("/admin-registrations/status", params={"email": "alice@school.edu"})

        # THEN 200 is returned
        assert actual_response.status_code == HTTPStatus.OK
        # AND the body carries the status
        assert actual_response.json() == {"email": "alice@school.edu", "status": "pending"}

    def test_returns_null_status_for_unknown_email(self):
        # GIVEN a service that has no record for the email
        client, mocked_service = _make_app()
        mocked_service.get_status = AsyncMock(
            return_value=RegistrationStatusResponse(email="ghost@nowhere.io", status=None)
        )

        # WHEN GET /status is called for that unknown email
        actual_response = client.get("/admin-registrations/status", params={"email": "ghost@nowhere.io"})

        # THEN 200 is returned with null status (no enumeration)
        assert actual_response.status_code == HTTPStatus.OK
        assert actual_response.json() == {"email": "ghost@nowhere.io", "status": None}

    def test_returns_429_when_per_ip_rate_limit_exceeded(self):
        # GIVEN a service that always returns null status
        client, mocked_service = _make_app()
        mocked_service.get_status = AsyncMock(
            return_value=RegistrationStatusResponse(email="ghost@nowhere.io", status=None)
        )
        given_limit = rate_limit_module.STATUS_RATE_LIMIT_PER_MIN

        # WHEN the limit is exhausted from a single IP
        for _ in range(given_limit):
            allowed = client.get("/admin-registrations/status", params={"email": "ghost@nowhere.io"})
            assert allowed.status_code == HTTPStatus.OK
        # AND one more request is made from the same IP
        actual_response = client.get("/admin-registrations/status", params={"email": "ghost@nowhere.io"})

        # THEN that request is rate-limited
        assert actual_response.status_code == HTTPStatus.TOO_MANY_REQUESTS


class TestSuperAdminGate:
    def test_list_returns_403_for_admin_role(self):
        # GIVEN a caller authenticated as admin
        client, _ = _make_app(role="admin")

        # WHEN they GET /admin-registrations
        actual_response = client.get("/admin-registrations")

        # THEN the request is forbidden
        assert actual_response.status_code == HTTPStatus.FORBIDDEN

    def test_list_returns_403_for_institution_staff_role(self):
        # GIVEN a caller authenticated as institution_staff
        client, _ = _make_app(role="institution_staff")

        # WHEN they GET /admin-registrations
        actual_response = client.get("/admin-registrations")

        # THEN the request is forbidden
        assert actual_response.status_code == HTTPStatus.FORBIDDEN

    def test_list_returns_200_for_super_admin(self):
        # GIVEN a caller authenticated as super_admin
        client, mocked_service = _make_app(role="super_admin")
        mocked_service.list = AsyncMock(return_value=([], 0))

        # WHEN they GET /admin-registrations
        actual_response = client.get("/admin-registrations")

        # THEN 200 is returned
        assert actual_response.status_code == HTTPStatus.OK
        # AND the body carries the empty list and pending count
        assert actual_response.json() == {"registrations": [], "pending_count": 0}

    def test_approve_returns_403_for_admin_role(self):
        # GIVEN a caller authenticated as admin
        client, _ = _make_app(role="admin")

        # WHEN they POST /approve
        actual_response = client.post("/admin-registrations/65a1b2c3d4e5f6a7b8c9d0e1/approve")

        # THEN the request is forbidden
        assert actual_response.status_code == HTTPStatus.FORBIDDEN

    def test_approve_returns_200_for_super_admin(self):
        # GIVEN a caller authenticated as super_admin and a service that approves
        client, mocked_service = _make_app(role="super_admin")
        approved = _sample_pending_registration().model_copy(update={"status": RegistrationStatus.APPROVED})
        mocked_service.approve = AsyncMock(return_value=ApproveRegistrationResponse(
            registration=approved,
            uid="new-user-uid",
        ))

        # WHEN they POST /approve
        actual_response = client.post("/admin-registrations/65a1b2c3d4e5f6a7b8c9d0e1/approve")

        # THEN 200 is returned
        assert actual_response.status_code == HTTPStatus.OK
        # AND the body includes the registration and uid
        assert actual_response.json()["registration"]["status"] == "approved"
        assert actual_response.json()["uid"] == "new-user-uid"


class TestReject:
    def test_returns_422_when_reason_missing(self):
        # GIVEN a super_admin caller
        client, _ = _make_app(role="super_admin")

        # WHEN they POST /reject with an empty reason
        actual_response = client.post(
            "/admin-registrations/65a1b2c3d4e5f6a7b8c9d0e1/reject",
            json={"reason": ""},
        )

        # THEN Pydantic rejects with 422
        assert actual_response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    def test_returns_403_for_non_super_admin(self):
        # GIVEN a caller authenticated as admin
        client, _ = _make_app(role="admin")

        # WHEN they POST /reject with a valid reason
        actual_response = client.post(
            "/admin-registrations/65a1b2c3d4e5f6a7b8c9d0e1/reject",
            json={"reason": "no"},
        )

        # THEN the request is forbidden
        assert actual_response.status_code == HTTPStatus.FORBIDDEN
