"""
This module contains tests for the sensitive personal data routes.
"""
from http import HTTPStatus

import pytest
import pytest_mock
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.testclient import TestClient

from app.users.auth import UserInfo
from app.users.sensitive_personal_data.service import ISensitivePersonalDataService
from app.users.sensitive_personal_data.types import CreateSensitivePersonalDataRequest
from app.users.sensitive_personal_data.routes import add_user_sensitive_personal_data_routes, get_sensitive_personal_data_service
from app.users.sensitive_personal_data.errors import (
    DuplicateSensitivePersonalDataError,
    UserPreferencesNotFoundError,
    SensitivePersonalDataRequiredError,
    SensitivePersonalDataNotAvailableError
)
from common_libs.test_utilities.mock_auth import MockAuth

TestClientWithMocks = tuple[TestClient, ISensitivePersonalDataService, UserInfo | None]


@pytest.fixture(scope='function')
def client_with_mocks() -> TestClientWithMocks:
    # Mock the sensitive personal data service
    class MockSensitivePersonalDataService(ISensitivePersonalDataService):
        async def exists_by_user_id(self, user_id: str) -> bool:
            return False

        async def create(self, user_id: str, request_body: CreateSensitivePersonalDataRequest):
            return None

        async def skip(self, user_id: str):
            return None

    _instance_sensitive_personal_data_service = MockSensitivePersonalDataService()

    def _mocked_get_sensitive_personal_data_service() -> ISensitivePersonalDataService:
        return _instance_sensitive_personal_data_service

    _instance_auth = MockAuth()

    # Set up the FastAPI app with the mocked dependencies
    api_router = APIRouter()
    app = FastAPI()

    # Set up the app dependency override
    app.dependency_overrides[get_sensitive_personal_data_service] = _mocked_get_sensitive_personal_data_service

    # Add the sensitive personal data routes to the users router
    add_user_sensitive_personal_data_routes(api_router, auth=_instance_auth)
    app.include_router(api_router)

    yield TestClient(app), _instance_sensitive_personal_data_service, _instance_auth.mocked_user
    app.dependency_overrides = {}


class TestHandleSensitivePersonalData:
    """Test cases for handling sensitive personal data (both create and skip cases)."""

    @pytest.mark.asyncio
    async def test_create_success(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_authed_user = client_with_mocks
        # GIVEN a payload to create sensitive personal data
        given_sensitive_personal_data = CreateSensitivePersonalDataRequest(
            sensitive_personal_data={
                "rsa_key_id": "foo",
                "aes_encryption_key": "bar",
                "aes_encrypted_data": "baz"
            }
        )

        # AND the user is authenticated
        given_user_id = mocked_authed_user.user_id

        # WHEN a POST request where `user_id` in the path matches the authenticated user's `user_id`
        _create_spy = mocker.spy(mocked_service, "create")
        response = client.post(
            f"/{given_user_id}/sensitive-personal-data",
            json=given_sensitive_personal_data.model_dump(),
        )
        # THEN the response is CREATED
        assert response.status_code == HTTPStatus.CREATED
        # AND the response is empty
        assert response.json() is None

        # AND sensitive_personal_data_service's create method was called with the given user_id and sensitive personal data
        _create_spy.assert_called_once_with(given_user_id, given_sensitive_personal_data)

    @pytest.mark.asyncio
    async def test_skip_success(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_authed_user = client_with_mocks
        # GIVEN a payload with None sensitive personal data to indicate skip
        given_sensitive_personal_data = CreateSensitivePersonalDataRequest(
            sensitive_personal_data=None
        )

        # AND the user is authenticated
        given_user_id = mocked_authed_user.user_id

        # WHEN a POST request where `user_id` in the path matches the authenticated user's `user_id`
        _skip_spy = mocker.spy(mocked_service, "skip")
        response = client.post(
            f"/{given_user_id}/sensitive-personal-data",
            json=given_sensitive_personal_data.model_dump(),
        )
        # THEN the response is CREATED
        assert response.status_code == HTTPStatus.CREATED
        # AND the response is empty
        assert response.json() is None

        # AND sensitive_personal_data_service's skip method was called with the given user_id
        _skip_spy.assert_called_once_with(given_user_id)

    @pytest.mark.asyncio
    async def test_forbidden(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_authed_user = client_with_mocks
        # GIVEN a payload to create sensitive personal data
        given_sensitive_personal_data = CreateSensitivePersonalDataRequest(
            sensitive_personal_data={
                "rsa_key_id": "foo",
                "aes_encryption_key": "bar",
                "aes_encrypted_data": "baz"
            }
        )

        # AND the user is authenticated
        given_user_id = mocked_authed_user.user_id
        # AND a different user_id
        other_user_id = given_user_id + "_other_user_id"

        # WHEN a POST request where `user_id` does not match the authenticated user's `user_id`
        _create_spy = mocker.spy(mocked_service, "create")
        response = client.post(
            f"/{other_user_id}/sensitive-personal-data",
            json=given_sensitive_personal_data.model_dump(),
        )

        # THEN the response is FORBIDDEN
        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": f"User {given_user_id} is not allowed to handle sensitive personal data for another user {other_user_id}"}
        # AND sensitive_personal_data_service's create method was not called
        _create_spy.assert_not_called()

    @pytest.mark.asyncio
    async def test_conflict(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_authed_user = client_with_mocks
        # GIVEN a payload to create sensitive personal data
        given_sensitive_personal_data = CreateSensitivePersonalDataRequest(
            sensitive_personal_data={
                "rsa_key_id": "foo",
                "aes_encryption_key": "bar",
                "aes_encrypted_data": "baz"
            }
        )

        # AND the user is authenticated
        given_user_id = mocked_authed_user.user_id

        # AND the sensitive personal data already exists for the user and will raise a DuplicateSensitivePersonalDataError
        _create_spy = mocker.patch.object(mocked_service, "create")
        _create_spy.side_effect = DuplicateSensitivePersonalDataError(given_user_id)

        # WHEN a POST request where `user_id` in the path matches the authenticated user's `user_id`
        response = client.post(
            f"/{given_user_id}/sensitive-personal-data",
            json=given_sensitive_personal_data.model_dump(),
        )

        # THEN the response is CONFLICT
        assert response.status_code == HTTPStatus.CONFLICT
        # AND the response contains the error message with the given user_id
        assert response.json() == {"detail": f"Sensitive personal data already exists for user {given_user_id}"}

    @pytest.mark.asyncio
    async def test_required_data(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_authed_user = client_with_mocks
        # GIVEN a payload with None sensitive personal data to indicate skip
        given_sensitive_personal_data = CreateSensitivePersonalDataRequest(
            sensitive_personal_data=None
        )

        # AND the user is authenticated
        given_user_id = mocked_authed_user.user_id

        # AND the service raises an error saying sensitive personal data is required
        _skip_spy = mocker.patch.object(mocked_service, "skip")
        _skip_spy.side_effect = SensitivePersonalDataRequiredError(given_user_id)

        # WHEN a POST request where `user_id` in the path matches the authenticated user's `user_id`
        response = client.post(
            f"/{given_user_id}/sensitive-personal-data",
            json=given_sensitive_personal_data.model_dump(),
        )

        # THEN the response is BAD_REQUEST
        assert response.status_code == HTTPStatus.BAD_REQUEST
        # AND the response contains the error message
        assert response.json() == {"detail": f"Sensitive personal data is required for user {given_user_id} and cannot be skipped"}

    @pytest.mark.asyncio
    async def test_not_found(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_authed_user = client_with_mocks
        # GIVEN a payload to create sensitive personal data
        given_sensitive_personal_data = CreateSensitivePersonalDataRequest(
            sensitive_personal_data={
                "rsa_key_id": "foo",
                "aes_encryption_key": "bar",
                "aes_encrypted_data": "baz"
            }
        )

        # AND the user is authenticated
        given_user_id = mocked_authed_user.user_id

        # AND the service raises a not found error
        _create_spy = mocker.patch.object(mocked_service, "create")
        _create_spy.side_effect = UserPreferencesNotFoundError(given_user_id)

        # WHEN a POST request where `user_id` in the path matches the authenticated user's `user_id`
        response = client.post(
            f"/{given_user_id}/sensitive-personal-data",
            json=given_sensitive_personal_data.model_dump(),
        )

        # THEN the response is NOT_FOUND
        assert response.status_code == HTTPStatus.NOT_FOUND
        # AND the response contains the error message
        assert response.json() == {"detail": f"User preferences not found for user {given_user_id}"}

    @pytest.mark.asyncio
    async def test_internal_server_error(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_authed_user = client_with_mocks
        # GIVEN a payload to create sensitive personal data
        given_sensitive_personal_data = CreateSensitivePersonalDataRequest(
            sensitive_personal_data={
                "rsa_key_id": "foo",
                "aes_encryption_key": "bar",
                "aes_encrypted_data": "baz"
            }
        )

        # AND the user is authenticated
        given_user_id = mocked_authed_user.user_id

        # AND the sensitive personal data service raises an exception
        _create_spy = mocker.patch.object(mocked_service, "create")
        _create_spy.side_effect = Exception("Some error")

        # WHEN a POST request where `user_id` in the path matches the authenticated user's `user_id`
        response = client.post(
            f"/{given_user_id}/sensitive-personal-data",
            json=given_sensitive_personal_data.model_dump(),
        )

        # THEN the response is INTERNAL_SERVER_ERROR
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
        # AND the response contains the error message
        assert response.json() == {"detail": "Opps! Something went wrong."}

    @pytest.mark.asyncio
    async def test_invalid_payload(self, client_with_mocks: TestClientWithMocks):
        client, _, mocked_authed_user = client_with_mocks
        # GIVEN am invalid payload as a dictionary
        given_invalid_payload = {"foo": "bar"}

        # AND the user is authenticated
        given_user_id = mocked_authed_user.user_id

        # WHEN a POST request where `user_id` in the path matches the authenticated user's `user_id`
        response = client.post(
            f"/{given_user_id}/sensitive-personal-data",
            json=given_invalid_payload,
        )

        # THEN the response is UNPROCESSABLE_ENTITY
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
