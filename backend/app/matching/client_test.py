"""Tests for the generic `MatchingServiceClient` in `app/matching/client.py`."""

from unittest.mock import AsyncMock, patch

import httpx
import pytest
from pydantic import BaseModel

from app.matching.client import MatchingServiceClient, MatchingServiceError
from app.matching.matching_types import (
    MatchingRequest,
    PreferenceVector,
    Skill,
    SkillsVector,
)


class _FooResponse(BaseModel):
    """Sample response model used to exercise the generic client."""
    foo: str
    bar: int


def _make_matching_request(user_id: str = "user-123") -> MatchingRequest:
    """Build a minimal valid MatchingRequest for tests."""
    return MatchingRequest(
        user_id=user_id,
        city="city",
        province="province",
        skills_vector=SkillsVector(
            top_skills=[
                Skill(
                    origin_uuid="origin-uuid",
                    preferred_label="preferred-label",
                    proficiency=0.5,
                )
            ]
        ),
        skill_groups_origin_uuids=[],
        preference_vector=PreferenceVector(
            earnings_per_month=0.1,
            physical_demand=0.2,
            social_interaction=0.3,
            career_growth=0.4,
        ),
    )


@pytest.fixture
def given_test_request() -> MatchingRequest:
    return _make_matching_request()


@pytest.fixture
def given_test_client() -> MatchingServiceClient:
    return MatchingServiceClient(
        base_url="https://test-service.com",
        api_key="test-api-key",
        timeout=10.0,
    )


class TestInit:
    def test_strips_trailing_slash_from_base_url(self):
        # GIVEN a base_url with a trailing slash
        given_base_url = "https://test-service.com/"
        # AND a valid api key
        given_api_key = "test-api-key"

        # WHEN the client is initialized
        actual_client = MatchingServiceClient(base_url=given_base_url, api_key=given_api_key)

        # THEN the stored base_url has no trailing slash
        assert actual_client.base_url == "https://test-service.com"

    def test_preserves_base_url_without_trailing_slash(self):
        # GIVEN a base_url without a trailing slash
        given_base_url = "https://test-service.com"

        # WHEN the client is initialized
        actual_client = MatchingServiceClient(base_url=given_base_url, api_key="api-key")

        # THEN the base_url is unchanged
        assert actual_client.base_url == "https://test-service.com"

    def test_stores_api_key_and_timeout(self):
        # GIVEN an api key and a custom timeout
        given_api_key = "some-api-key"
        given_timeout = 7.5

        # WHEN the client is initialized
        actual_client = MatchingServiceClient(
            base_url="https://test-service.com",
            api_key=given_api_key,
            timeout=given_timeout,
        )

        # THEN the api key and timeout are stored
        assert actual_client.api_key == given_api_key
        assert actual_client.timeout == given_timeout

    def test_default_timeout_is_thirty_seconds(self):
        # GIVEN a client constructed without an explicit timeout
        # WHEN the client is initialized
        actual_client = MatchingServiceClient(base_url="https://test-service.com", api_key="k")

        # THEN the timeout defaults to 30 seconds
        assert actual_client.timeout == 300.0


class TestProcessRequestSuccess:
    @pytest.mark.asyncio
    async def test_sends_post_to_base_url_plus_path_with_expected_headers_and_body(
        self,
        given_test_client: MatchingServiceClient,
        given_test_request: MatchingRequest,
    ):
        # GIVEN a path on the matching service
        given_path = "/match"
        # AND the service responds with a JSON body matching _FooResponse
        given_response_body = {"foo": "hello", "bar": 42}
        mock_request = httpx.Request("POST", "https://test-service.com/match")
        mock_response = httpx.Response(
            status_code=200,
            json=given_response_body,
            request=mock_request,
        )

        with patch("app.matching.client.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # WHEN process_request is called
            actual_result = await given_test_client.process_request(
                response_cls=_FooResponse,
                path=given_path,
                request=given_test_request,
            )

            # THEN the result is the parsed response model
            assert actual_result == _FooResponse(foo="hello", bar=42)

            # AND the POST was made exactly once to base_url + path
            mock_client.post.assert_called_once()
            actual_args, actual_kwargs = mock_client.post.call_args
            assert actual_args[0] == "https://test-service.com/match"

            # AND the x-api-key and Content-Type headers were sent
            assert actual_kwargs["headers"]["x-api-key"] == "test-api-key"
            assert actual_kwargs["headers"]["Content-Type"] == "application/json"

            # AND the JSON body is the request's serialized form wrapped in a
            # one-element list (the matching service accepts a batch of users)
            assert actual_kwargs["json"] == [given_test_request.to_json()]

            # AND the configured timeout is forwarded
            assert actual_kwargs["timeout"] == given_test_client.timeout

    @pytest.mark.asyncio
    async def test_appends_path_correctly_when_base_url_has_trailing_slash(
        self,
        given_test_request: MatchingRequest,
    ):
        # GIVEN a client whose base_url was constructed with a trailing slash
        given_client = MatchingServiceClient(
            base_url="https://test-service.com/",
            api_key="test-api-key",
        )
        # AND a path with a leading slash
        given_path = "/match"
        # AND the service responds successfully
        mock_request = httpx.Request("POST", "https://test-service.com/match")
        mock_response = httpx.Response(
            status_code=200,
            json={"foo": "ok", "bar": 1},
            request=mock_request,
        )

        with patch("app.matching.client.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # WHEN process_request is called
            await given_client.process_request(
                response_cls=_FooResponse,
                path=given_path,
                request=given_test_request,
            )

            # THEN the URL contains no double slash between base_url and path
            actual_url = mock_client.post.call_args[0][0]
            assert actual_url == "https://test-service.com/match"


class TestProcessRequestErrors:
    @pytest.mark.asyncio
    async def test_raises_matching_service_error_on_http_status_error(
        self,
        given_test_client: MatchingServiceClient,
        given_test_request: MatchingRequest,
    ):
        # GIVEN the service returns a 500 response
        mock_request = httpx.Request("POST", "https://test-service.com/match")
        mock_response = httpx.Response(
            status_code=500,
            request=mock_request,
            text="Internal server error from upstream",
        )
        given_http_error = httpx.HTTPStatusError(
            "Server error", request=mock_request, response=mock_response
        )

        with patch("app.matching.client.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = given_http_error
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # WHEN process_request is called
            # THEN a MatchingServiceError is raised
            with pytest.raises(MatchingServiceError) as exc_info:
                await given_test_client.process_request(
                    response_cls=_FooResponse,
                    path="/match",
                    request=given_test_request,
                )

            # AND the error message includes the status code and upstream body
            assert "500" in str(exc_info.value)
            assert "Internal server error from upstream" in str(exc_info.value)
            # AND the original HTTPStatusError is the cause
            assert isinstance(exc_info.value.__cause__, httpx.HTTPStatusError)

    @pytest.mark.asyncio
    async def test_raises_matching_service_error_when_response_status_is_non_2xx(
        self,
        given_test_client: MatchingServiceClient,
        given_test_request: MatchingRequest,
    ):
        # GIVEN the service returns a 404 (raise_for_status will fire)
        mock_request = httpx.Request("POST", "https://test-service.com/match")
        mock_response = httpx.Response(
            status_code=404,
            request=mock_request,
            text="Not found",
        )

        with patch("app.matching.client.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # WHEN process_request is called
            # THEN a MatchingServiceError is raised (via raise_for_status)
            with pytest.raises(MatchingServiceError) as exc_info:
                await given_test_client.process_request(
                    response_cls=_FooResponse,
                    path="/match",
                    request=given_test_request,
                )

            # AND the error message contains the upstream status
            assert "404" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_raises_matching_service_error_on_connect_error(
        self,
        given_test_client: MatchingServiceClient,
        given_test_request: MatchingRequest,
    ):
        # GIVEN the service cannot be reached (connect error)
        given_request_error = httpx.ConnectError("connection refused")

        with patch("app.matching.client.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = given_request_error
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # WHEN process_request is called
            # THEN a MatchingServiceError is raised
            with pytest.raises(MatchingServiceError) as exc_info:
                await given_test_client.process_request(
                    response_cls=_FooResponse,
                    path="/match",
                    request=given_test_request,
                )

            # AND the error message indicates a connection failure
            assert "Failed to connect to matching service" in str(exc_info.value)
            # AND the underlying httpx error is preserved as the cause
            assert isinstance(exc_info.value.__cause__, httpx.ConnectError)

    @pytest.mark.asyncio
    async def test_raises_matching_service_error_on_timeout(
        self,
        given_test_client: MatchingServiceClient,
        given_test_request: MatchingRequest,
    ):
        # GIVEN the service times out (httpx.TimeoutException is a RequestError)
        given_timeout_error = httpx.TimeoutException("timed out")

        with patch("app.matching.client.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = given_timeout_error
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # WHEN process_request is called
            # THEN a MatchingServiceError is raised
            with pytest.raises(MatchingServiceError) as exc_info:
                await given_test_client.process_request(
                    response_cls=_FooResponse,
                    path="/match",
                    request=given_test_request,
                )

            # AND the underlying timeout error is preserved as the cause
            assert isinstance(exc_info.value.__cause__, httpx.TimeoutException)

    @pytest.mark.asyncio
    async def test_raises_matching_service_error_when_response_does_not_match_schema(
        self,
        given_test_client: MatchingServiceClient,
        given_test_request: MatchingRequest,
    ):
        # GIVEN the service returns 200 but the body does not match _FooResponse
        mock_request = httpx.Request("POST", "https://test-service.com/match")
        mock_response = httpx.Response(
            status_code=200,
            json={"unexpected": "shape"},
            request=mock_request,
        )

        with patch("app.matching.client.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.return_value = mock_response
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # WHEN process_request is called
            # THEN a MatchingServiceError is raised
            with pytest.raises(MatchingServiceError) as exc_info:
                await given_test_client.process_request(
                    response_cls=_FooResponse,
                    path="/match",
                    request=given_test_request,
                )

            # AND the error message names the expected response class
            assert "_FooResponse" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_raises_matching_service_error_on_unexpected_exception(
        self,
        given_test_client: MatchingServiceClient,
        given_test_request: MatchingRequest,
    ):
        # GIVEN an unexpected exception is raised inside the request flow
        given_unexpected_error = RuntimeError("something went wrong")

        with patch("app.matching.client.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = given_unexpected_error
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # WHEN process_request is called
            # THEN a MatchingServiceError is raised
            with pytest.raises(MatchingServiceError) as exc_info:
                await given_test_client.process_request(
                    response_cls=_FooResponse,
                    path="/match",
                    request=given_test_request,
                )

            # AND the error message indicates an unexpected error
            assert "Unexpected matching service error" in str(exc_info.value)
            # AND the original exception is preserved as the cause
            assert exc_info.value.__cause__ is given_unexpected_error

    @pytest.mark.asyncio
    async def test_does_not_double_wrap_matching_service_error(
        self,
        given_test_client: MatchingServiceClient,
        given_test_request: MatchingRequest,
    ):
        # GIVEN a MatchingServiceError is raised inside the request flow
        given_inner_error = MatchingServiceError("inner failure")

        with patch("app.matching.client.httpx.AsyncClient") as mock_client_class:
            mock_client = AsyncMock()
            mock_client.post.side_effect = given_inner_error
            mock_client_class.return_value.__aenter__.return_value = mock_client

            # WHEN process_request is called
            # THEN the same MatchingServiceError is propagated unchanged
            with pytest.raises(MatchingServiceError) as exc_info:
                await given_test_client.process_request(
                    response_cls=_FooResponse,
                    path="/match",
                    request=given_test_request,
                )

            # AND it is the exact same instance (not re-wrapped)
            assert exc_info.value is given_inner_error
