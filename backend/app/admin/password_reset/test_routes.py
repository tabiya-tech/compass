"""Tests for the public POST /password-reset endpoint."""
import logging
from http import HTTPStatus
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from firebase_admin.auth import UserNotFoundError

from app.admin.firebase import FirebaseService, get_firebase_service
from app.admin.password_reset.routes import add_password_reset_routes
from app.admin.registrations import rate_limit as rate_limit_module


@pytest.fixture(autouse=True)
def _clear_rate_limit_buckets():
    """Reset the in-memory rate-limit buckets between tests so cases don't bleed into each other."""
    rate_limit_module._buckets.clear()  # pylint: disable=protected-access
    yield
    rate_limit_module._buckets.clear()  # pylint: disable=protected-access


@pytest.fixture
def app_setup(monkeypatch):
    """FastAPI app + mocked FirebaseService."""
    mocked_firebase = MagicMock(spec=FirebaseService)

    def _override_firebase():
        return mocked_firebase

    app = FastAPI()
    app.dependency_overrides[get_firebase_service] = _override_firebase
    add_password_reset_routes(app)

    # Stub the application config so admin_firebase_tenant_id is available.
    cfg = MagicMock()
    cfg.admin_firebase_tenant_id = "tenant-X"
    monkeypatch.setattr(
        "app.admin.password_reset.routes.get_application_config", lambda: cfg
    )

    yield TestClient(app), mocked_firebase
    app.dependency_overrides = {}


class TestRequestPasswordReset:
    def test_returns_204_for_known_email_and_logs_link(
        self, app_setup, caplog: pytest.LogCaptureFixture
    ):
        client, mocked_firebase = app_setup
        # GIVEN Firebase generates a real reset link
        mocked_firebase.generate_password_reset_link.return_value = "https://reset.example/abc"

        # WHEN POST /password-reset is called
        with caplog.at_level(logging.INFO):
            actual = client.post("/password-reset", json={"email": "user@example.com"})

        # THEN the response is 204 and the link is logged
        assert actual.status_code == HTTPStatus.NO_CONTENT
        assert "https://reset.example/abc" in caplog.text

    def test_returns_204_for_unknown_email_and_does_not_log_link(
        self, app_setup, caplog: pytest.LogCaptureFixture
    ):
        client, mocked_firebase = app_setup
        # GIVEN Firebase says the user does not exist
        mocked_firebase.generate_password_reset_link.side_effect = UserNotFoundError(
            message="not found"
        )

        # WHEN POST /password-reset is called
        with caplog.at_level(logging.INFO):
            actual_response = client.post("/password-reset", json={"email": "ghost@nowhere.io"})

        # THEN the response is still 204 (no enumeration)
        assert actual_response.status_code == HTTPStatus.NO_CONTENT
        # AND no reset link is in the logs
        assert "https://reset.example" not in caplog.text
        assert "Password reset requested for unknown email" in caplog.text

    def test_returns_429_when_per_ip_rate_limit_exceeded(self, app_setup):
        # GIVEN a TestClient and Firebase always returns a link
        client, mocked_firebase = app_setup
        mocked_firebase.generate_password_reset_link.return_value = "https://reset.example/abc"
        given_payload = {"email": "user@example.com"}
        given_limit = rate_limit_module.PASSWORD_RESET_RATE_LIMIT_PER_MIN

        # WHEN the limit is exhausted from a single IP
        for _ in range(given_limit):
            allowed = client.post("/password-reset", json=given_payload)
            assert allowed.status_code == HTTPStatus.NO_CONTENT
        # AND one more request is made from the same IP
        actual_response = client.post("/password-reset", json=given_payload)

        # THEN that request is rate-limited
        assert actual_response.status_code == HTTPStatus.TOO_MANY_REQUESTS
