import re
import uuid
from http import HTTPStatus
from unittest.mock import patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import BaseModel, field_validator

from app.errors.handlers import register_exception_handlers
from app.middleware.correlation_id_middleware import CorrelationIdMiddleware


@pytest.fixture
def app():
    _app = FastAPI()
    _app.add_middleware(CorrelationIdMiddleware)
    register_exception_handlers(_app)

    @_app.get("/raises-http")
    async def _raises_http():
        raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail="bad input")

    @_app.get("/raises-http-500")
    async def _raises_http_500():
        raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    @_app.get("/raises-unhandled")
    async def _raises_unhandled():
        raise RuntimeError("surprise")

    class _Payload(BaseModel):
        name: str

    @_app.post("/validated")
    async def _validated(_: _Payload):
        return {"ok": True}

    class _CustomValidatedPayload(BaseModel):
        # Mirrors the plain-personal-data name field: a custom validator that raises ValueError.
        # Pydantic wraps the raw ValueError in the error `ctx`, which is not JSON-serializable.
        name: str

        @field_validator("name")
        @classmethod
        def _only_letters_spaces_dots(cls, value: str) -> str:
            if not re.match(r"^[\w\s.]+$", value, re.UNICODE):
                raise ValueError("must contain only letters, spaces, and dots")
            return value

    @_app.post("/validated-custom")
    async def _validated_custom(_: _CustomValidatedPayload):
        return {"ok": True}

    return _app


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


class TestHttpExceptionHandler:
    def test_http_exception_is_returned_with_detail_and_correlation_id(self, client):
        # GIVEN a client-provided correlation id
        given_correlation_id = str(uuid.uuid4())

        # WHEN a route raises HTTPException with a 4xx status
        actual_response = client.get("/raises-http", headers={"X-Correlation-ID": given_correlation_id})

        # THEN the response preserves status and detail
        assert actual_response.status_code == HTTPStatus.BAD_REQUEST
        actual_body = actual_response.json()
        assert actual_body["detail"] == "bad input"
        # AND the correlation id is included in the body
        assert actual_body["correlation_id"] == given_correlation_id
        # AND no sentry_event_id is present (4xx is not captured)
        assert "sentry_event_id" not in actual_body

    def test_http_exception_500_captures_sentry_event_id_when_enabled(self, client, monkeypatch):
        # GIVEN Sentry is enabled and capture_exception returns a known event id
        monkeypatch.setenv("BACKEND_ENABLE_SENTRY", "True")
        given_event_id = "deadbeef"
        with patch("app.errors.handlers.sentry_sdk.capture_exception", return_value=given_event_id) as mocked_capture:
            # WHEN a route raises a 5xx HTTPException
            actual_response = client.get("/raises-http-500")

            # THEN the exception is captured and the event id is surfaced in the body
            assert actual_response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
            actual_body = actual_response.json()
            assert actual_body["detail"] == "Oops! Something went wrong."
            assert actual_body["sentry_event_id"] == given_event_id
            mocked_capture.assert_called_once()

    def test_http_exception_does_not_capture_when_sentry_disabled(self, client, monkeypatch):
        # GIVEN Sentry is disabled
        monkeypatch.setenv("BACKEND_ENABLE_SENTRY", "False")
        with patch("app.errors.handlers.sentry_sdk.capture_exception") as mocked_capture:
            # WHEN a route raises a 5xx HTTPException
            actual_response = client.get("/raises-http-500")

            # THEN no capture happens and no sentry_event_id is present
            assert actual_response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
            mocked_capture.assert_not_called()
            assert "sentry_event_id" not in actual_response.json()


class TestUnhandledExceptionHandler:
    def test_unhandled_exception_returns_generic_500_with_correlation_id(self, client, monkeypatch):
        # GIVEN Sentry is disabled and a correlation id is provided
        monkeypatch.setenv("BACKEND_ENABLE_SENTRY", "False")
        given_correlation_id = str(uuid.uuid4())

        # WHEN a route raises an unexpected exception
        actual_response = client.get("/raises-unhandled", headers={"X-Correlation-ID": given_correlation_id})

        # THEN the response is a generic 500 with the correlation id
        assert actual_response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
        actual_body = actual_response.json()
        assert actual_body["detail"] == "Oops! Something went wrong."
        assert actual_body["correlation_id"] == given_correlation_id

    def test_unhandled_exception_captures_sentry_event_when_enabled(self, client, monkeypatch):
        # GIVEN Sentry is enabled and capture_exception returns a known event id
        monkeypatch.setenv("BACKEND_ENABLE_SENTRY", "True")
        given_event_id = "cafef00d"
        with patch("app.errors.handlers.sentry_sdk.capture_exception", return_value=given_event_id) as mocked_capture:
            # WHEN a route raises an unexpected exception
            actual_response = client.get("/raises-unhandled")

            # THEN the event is captured and surfaced in the body
            assert actual_response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
            assert actual_response.json()["sentry_event_id"] == given_event_id
            mocked_capture.assert_called_once()


class TestValidationExceptionHandler:
    def test_validation_errors_preserve_detail_shape_and_add_correlation_id(self, client):
        # GIVEN a correlation id
        given_correlation_id = str(uuid.uuid4())

        # WHEN submitting a payload that fails validation
        actual_response = client.post(
            "/validated",
            json={"wrong_field": 1},
            headers={"X-Correlation-ID": given_correlation_id},
        )

        # THEN the status is 422 and detail is the default pydantic error list
        assert actual_response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
        actual_body = actual_response.json()
        assert isinstance(actual_body["detail"], list)
        # AND the correlation id is attached
        assert actual_body["correlation_id"] == given_correlation_id

    def test_validation_error_raised_by_custom_validator_is_serialized_to_422(self, client):
        # GIVEN a correlation id
        given_correlation_id = str(uuid.uuid4())

        # WHEN submitting a value that trips a custom validator which raises ValueError
        # (pydantic puts the raw ValueError in the error ctx, which json.dumps cannot serialize)
        actual_response = client.post(
            "/validated-custom",
            json={"name": "O'Brien"},
            headers={"X-Correlation-ID": given_correlation_id},
        )

        # THEN the status is 422 (not a 500 from a non-serializable error payload)
        assert actual_response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
        actual_body = actual_response.json()
        # AND the detail is the JSON-serializable pydantic error list
        assert isinstance(actual_body["detail"], list)
        # AND the validator's message is preserved for the client
        assert any("letters, spaces, and dots" in error["msg"] for error in actual_body["detail"])
        # AND the correlation id is attached
        assert actual_body["correlation_id"] == given_correlation_id
