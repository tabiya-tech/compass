from http import HTTPStatus
from datetime import datetime
from unittest.mock import AsyncMock

import pytest
import pytest_mock
from fastapi import FastAPI, APIRouter
from fastapi.testclient import TestClient

from app.conversations.reactions.routes import add_reaction_routes, get_reaction_service, \
    get_user_preferences_repository
from app.conversations.reactions.service import IReactionService
from app.conversations.reactions.types import ReactionRequest, ReactionKind, DislikeReason
from app.users.repositories import IUserPreferenceRepository
from app.users.types import UserPreferences, UserPreferencesRepositoryUpdateRequest
from common_libs.test_utilities.mock_auth import MockAuth

TestClientWithMocks = tuple[TestClient, IReactionService, IUserPreferenceRepository]

def get_mock_user_preferences(session_id: int):
    return UserPreferences(
        language="en",
        invitation_code="foo",
        accepted_tc=datetime.now(),
        sessions=[session_id],  # mock a user that owns the given session
        sensitive_personal_data_requirement="NOT_REQUIRED"
    )

@pytest.fixture(scope='function')
def client_with_mocks() -> TestClientWithMocks:
    # Mock the reaction service
    class MockReactionService(IReactionService):
        async def add(self, session_id: int, message_id: str, reaction: ReactionRequest):
            return None

        async def delete(self, session_id: int, message_id: str):
            return None

    _instance_reaction_service = MockReactionService()

    def _mocked_get_reaction_service() -> IReactionService:
        return _instance_reaction_service

    class MockPreferencesRepository(IUserPreferenceRepository):
        async def get_user_preference_by_user_id(self, user_id: str):
            return None
        async def insert_user_preference(self, user_id: str, user_preference: UserPreferences):
            return None
        async def update_user_preference(self, user_id: str, update: UserPreferencesRepositoryUpdateRequest):
            return None

    _instance_user_preferences = MockPreferencesRepository()

    def _mocked_preferences_repository() -> IUserPreferenceRepository:
        return _instance_user_preferences

    # Set up the FastAPI app with the mocked dependencies
    api_router = APIRouter()
    app = FastAPI()

    # Mock the auth
    _instance_auth = MockAuth()

    # Set up the app dependency override
    app.dependency_overrides[get_reaction_service] = _mocked_get_reaction_service
    app.dependency_overrides[get_user_preferences_repository] = _mocked_preferences_repository

    # Add the reaction routes to the conversations router
    add_reaction_routes(api_router, _instance_auth)
    app.include_router(api_router)

    yield TestClient(app), _instance_reaction_service, _instance_user_preferences
    app.dependency_overrides = {}

class TestReactionRoutes:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "given_reaction",
        [
            ReactionRequest(kind=ReactionKind.LIKED),
            ReactionRequest(kind=ReactionKind.DISLIKED, reason=[DislikeReason.INCORRECT_INFORMATION]),
        ],
    )
    async def test_add_reaction_successful(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture, given_reaction):
        client, mocked_service, mocked_preferences = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))

        # AND the service's add method is spied on
        _add_spy = mocker.spy(mocked_service, "add")

        # WHEN a PUT request is made with the given reaction
        response = client.put(
            f"/{given_session_id}/messages/{given_message_id}/reactions",
            json=given_reaction.model_dump(),
        )

        # THEN the response is CREATED
        assert response.status_code == HTTPStatus.CREATED
        # AND the response is empty
        assert response.json() is None
        # AND the service's add method was called with the correct parameters
        _add_spy.assert_called_once()
        # AND the reaction passed to the service is a ReactionRequest instance (validating model usage)
        actual_reaction = _add_spy.call_args[0][2]
        assert isinstance(actual_reaction, ReactionRequest)
        assert actual_reaction.kind == given_reaction.kind
        assert actual_reaction.reason == given_reaction.reason

    @pytest.mark.asyncio
    async def test_add_reaction_forbidden(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_preferences = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"
        given_reaction = ReactionRequest(kind=ReactionKind.LIKED)

        # AND the user doesn't have the given session_id in their sessions array
        mock_user_preferences = get_mock_user_preferences(456)  # Different session ID
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(return_value=mock_user_preferences)

        # AND the service's add method is spied on
        _add_spy = mocker.spy(mocked_service, "add")

        # WHEN a PUT request is made with the reaction
        response = client.put(
            f"/{given_session_id}/messages/{given_message_id}/reactions",
            json=given_reaction.model_dump(),
        )

        # THEN the response is FORBIDDEN
        assert response.status_code == HTTPStatus.FORBIDDEN
        # AND the service's add method was not called
        _add_spy.assert_not_called()

    @pytest.mark.asyncio
    async def test_add_reaction_service_internal_server_error(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_preferences = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"
        given_reaction = ReactionRequest(kind=ReactionKind.LIKED)

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))

        # AND the service's add method will raise an unexpected error
        add_spy = mocker.spy(mocked_service, "add")
        add_spy.side_effect = Exception("Unexpected error")

        # WHEN a PUT request is made with the reaction
        response = client.put(
            f"/{given_session_id}/messages/{given_message_id}/reactions",
            json=given_reaction.model_dump(),
        )

        # THEN the response is INTERNAL_SERVER_ERROR
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

    @pytest.mark.asyncio
    async def test_add_reaction_user_preferences_internal_server_error(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, _, mocked_preferences_repository = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"
        given_reaction = ReactionRequest(kind=ReactionKind.LIKED)

        # AND a UserPreferencesRepository that will raise an unexpected error
        get_user_preferences_spy = mocker.spy(mocked_preferences_repository, "get_user_preference_by_user_id")
        get_user_preferences_spy.side_effect = Exception("Unexpected error")

        # WHEN a PUT request is made with the reaction
        response = client.put(
            f"/{given_session_id}/messages/{given_message_id}/reactions",
            json=given_reaction.model_dump(),
        )

        # THEN the response is INTERNAL_SERVER_ERROR
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

    @pytest.mark.asyncio
    async def test_invalid_payload(self, client_with_mocks: TestClientWithMocks):
        client, _, mocked_preferences = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"
        given_invalid_payload = {"foo": "bar"}

         # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))

        # WHEN a PUT request where `session_id` in the path matches the user's `session_id`
        response = client.put(
            f"/{given_session_id}/messages/{given_message_id}/reactions",
            json=given_invalid_payload,
        )

        # THEN the response is UNPROCESSABLE_ENTITY due to ReactionRequest validation
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    @pytest.mark.asyncio
    async def test_delete_reaction_successful(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_preferences = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))

        # AND the service's delete method is spied on
        _delete_spy = mocker.spy(mocked_service, "delete")

        # WHEN a DELETE request is made
        response = client.delete(
            f"/{given_session_id}/messages/{given_message_id}/reactions"
        )

        # THEN the response is NO_CONTENT
        assert response.status_code == HTTPStatus.NO_CONTENT
        # AND the response is empty
        assert response.content == b""
        # AND the service's delete method was called with the correct parameters
        _delete_spy.assert_called_once_with(given_session_id, given_message_id)

    @pytest.mark.asyncio
    async def test_delete_reaction_forbidden(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_preferences = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND the user doesn't have the given session_id in their sessions array
        mock_user_preferences = get_mock_user_preferences(456)  # Different session ID
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(return_value=mock_user_preferences)

        # AND the service's delete method is spied on
        _delete_spy = mocker.spy(mocked_service, "delete")

        # WHEN a DELETE request is made
        response = client.delete(
            f"/{given_session_id}/messages/{given_message_id}/reactions"
        )

        # THEN the response is FORBIDDEN
        assert response.status_code == HTTPStatus.FORBIDDEN
        # AND the service's delete method was not called
        _delete_spy.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_reaction_service_internal_server_error(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_preferences = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))

        # AND the service's delete method will raise an unexpected error
        delete_spy = mocker.spy(mocked_service, "delete")
        delete_spy.side_effect = Exception("Unexpected error")

        # WHEN a DELETE request is made
        response = client.delete(
            f"/{given_session_id}/messages/{given_message_id}/reactions"
        )

        # THEN the response is INTERNAL_SERVER_ERROR
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR 

    @pytest.mark.asyncio
    async def test_delete_reaction_user_preferences_internal_server_error(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, _, mocked_preferences_repository = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"


        # AND a UserPreferencesRepository that will raise an unexpected error
        get_user_preferences_spy = mocker.spy(mocked_preferences_repository, "get_user_preference_by_user_id")
        get_user_preferences_spy.side_effect = Exception("Unexpected error")

        # WHEN a DELETE request is made
        response = client.delete(f"/{given_session_id}/messages/{given_message_id}/reactions")

        # THEN the response is INTERNAL_SERVER_ERROR
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR