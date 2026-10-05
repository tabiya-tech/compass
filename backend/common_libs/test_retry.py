"""
Tests for the classification of the errors worth retrying.
"""
import httpx
import pytest
from google.api_core.exceptions import TooManyRequests, ServiceUnavailable, BadRequest
from google.genai.errors import ClientError, ServerError

from common_libs.retry import is_retryable_error


class _StatusCodeError(Exception):
    """An error with a status code, like the google-genai Interactions API errors."""

    def __init__(self, status_code: int):
        super().__init__(f"status {status_code}")
        self.status_code = status_code


class APIConnectionError(Exception):
    """An error named like the google-genai Interactions API connection error."""


class TestIsRetryableError:
    @pytest.mark.parametrize("given_error", [
        TooManyRequests("foo"),
        ServiceUnavailable("foo"),
        ClientError(429, {"error": {"message": "foo"}}),
        ServerError(503, {"error": {"message": "foo"}}),
        _StatusCodeError(429),
        _StatusCodeError(500),
        _StatusCodeError(504),
        APIConnectionError("foo"),
        httpx.ConnectError("foo"),
    ], ids=["api_core 429", "api_core 503", "genai 429", "genai 503", "interactions 429", "interactions 500",
            "interactions 504", "interactions connection", "httpx connection"])
    def test_transient_errors_are_retryable(self, given_error: BaseException):
        # GIVEN a transient error
        # WHEN it is classified
        actual_retryable = is_retryable_error(given_error)

        # THEN expect it to be retryable
        assert actual_retryable is True

    @pytest.mark.parametrize("given_error", [
        BadRequest("foo"),
        ClientError(400, {"error": {"message": "foo"}}),
        _StatusCodeError(404),
        ValueError("foo"),
    ], ids=["api_core 400", "genai 400", "interactions 404", "value error"])
    def test_other_errors_are_not_retryable(self, given_error: BaseException):
        # GIVEN an error that is not transient
        # WHEN it is classified
        actual_retryable = is_retryable_error(given_error)

        # THEN expect it not to be retryable
        assert actual_retryable is False
