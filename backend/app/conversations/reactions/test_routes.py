from http import HTTPStatus
from datetime import datetime
from typing import Generator
from unittest.mock import AsyncMock

import pytest
import pytest_mock
from fastapi import FastAPI, APIRouter
from fastapi.testclient import TestClient

from app.conversations.reactions.routes import add_reaction_routes, get_reaction_service, \
    get_user_preferences_repository, _ReactionRequest
from app.conversations.reactions.service import IReactionService
from app.conversations.reactions.types import ReactionKind, DislikeReason, Reaction
from app.users.repositories import IUserPreferenceRepository
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement
from app.users.types import UserPreferences, UserPreferencesRepositoryUpdateRequest
from app.users.auth import UserInfo
from common_libs.test_utilities.mock_auth import MockAuth, UnauthenticatedMockAuth

TestClientWithMocks = tuple[TestClient, IReactionService, IUserPreferenceRepository, UserInfo | None]


def get_mock_user_preferences(session_id: int):
    return UserPreferences(
        language="en",
        invitation_code="foo",
        accepted_tc=datetime.now(),
        sessions=[session_id],  # mock a user that owns the given session
        sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_REQUIRED
    )


def _create_test_client_with_mocks(auth) -> TestClientWithMocks:
    """
    Factory function to create a test client with mocked dependencies
    """

    # Mock the reaction service
    class MockedReactionService(IReactionService):
        async def add(self, reaction: Reaction, user_id: str) -> Reaction:
            return Reaction(
                id="mock_doc_id",
                session_id=reaction.session_id,
                message_id=reaction.message_id,
                kind=reaction.kind,
                reasons=reaction.reasons,
                created_at=datetime.now()
            )

        async def delete(self, session_id: int, message_id: str):
            return None

    mocked_reaction_service = MockedReactionService()

    # Mock the user preferences repository
    class MockedUserPreferencesRepository(IUserPreferenceRepository):
        async def get_user_preference_by_user_id(self, user_id: str) -> UserPreferences:
            raise NotImplementedError()

        async def update_user_preference(self, user_id: str,
                                         request: UserPreferencesRepositoryUpdateRequest) -> UserPreferences:
            raise NotImplementedError()

        async def insert_user_preference(self, user_id: str, user_preference: UserPreferences) -> UserPreferences:
            raise NotImplementedError()

    mocked_user_preferences_repository = MockedUserPreferencesRepository()

    # Set up the FastAPI app with the mocked dependencies
    app = FastAPI()

    # Set up the app dependency override
    app.dependency_overrides[get_reaction_service] = lambda: mocked_reaction_service
    app.dependency_overrides[get_user_preferences_repository] = lambda: mocked_user_preferences_repository

    conversation_router = APIRouter(
        prefix="/conversations/{session_id}",
        tags=["conversations"]
    )

    # Add the reaction routes to the conversations router
    add_reaction_routes(conversation_router, auth)
    app.include_router(conversation_router)

    # Create a test client
    client = TestClient(app)

    return client, mocked_reaction_service, mocked_user_preferences_repository, auth.mocked_user


@pytest.fixture(scope='function')
def authenticated_client_with_mocks() -> Generator[TestClientWithMocks, None, None]:
    """
    Returns a test client with authenticated mock auth
    """
    app = FastAPI()
    _instance_auth = MockAuth()

    client, service, preferences, user = _create_test_client_with_mocks(_instance_auth)
    yield client, service, preferences, user
    app.dependency_overrides = {}


@pytest.fixture(scope='function')
def unauthenticated_client_with_mocks() -> Generator[TestClientWithMocks, None, None]:
    """
    Returns a test client with unauthenticated mock auth
    """
    app = FastAPI()
    _instance_auth = UnauthenticatedMockAuth()

    client, service, preferences, user = _create_test_client_with_mocks(_instance_auth)
    yield client, service, preferences, user
    app.dependency_overrides = {}


class TestReactionRoutes:
    # ----- add reaction tests -----
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "given_reaction",
        [
            _ReactionRequest(kind=ReactionKind.LIKED, reasons=[]),
            _ReactionRequest(kind=ReactionKind.DISLIKED, reasons=[DislikeReason.INCORRECT_INFORMATION]),
        ],
    )
    async def test_add_reaction_successful(self, authenticated_client_with_mocks: TestClientWithMocks,
                                           mocker: pytest_mock.MockerFixture, given_reaction):
        client, mocked_service, mocked_preferences, mocked_user = authenticated_client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(
            return_value=get_mock_user_preferences(given_session_id))
        preferences_spy = mocker.spy(mocked_preferences, "get_user_preference_by_user_id")

        # AND the service's add method is spied on
        _add_spy = mocker.spy(mocked_service, "add")

        # WHEN a PUT request is made with the given reaction
        response = client.put(
            f"/conversations/{given_session_id}/messages/{given_message_id}/reactions",
            json=given_reaction.model_dump(),
        )

        # THEN the response is CREATED
        assert response.status_code == HTTPStatus.CREATED

        # AND the response contains the created reaction
        response_data = response.json()
        assert response_data["session_id"] == given_session_id
        assert response_data["message_id"] == given_message_id
        assert response_data["kind"] == given_reaction.kind
        if given_reaction.kind == ReactionKind.DISLIKED:
            assert response_data["reasons"] == given_reaction.reasons
        else:
            assert response_data["reasons"] == []
        # Verify ISO format string
        assert isinstance(response_data["created_at"], str)
        datetime.fromisoformat(response_data["created_at"])  # Should not raise error

        # AND the user preferences repository was called with the correct user_id
        preferences_spy.assert_called_once_with(mocked_user.user_id)

        # AND the service's add method was called with the correct parameters
        _add_spy.assert_called_once()
        actual_reaction = _add_spy.call_args[0][0]
        assert isinstance(actual_reaction, Reaction)
        assert actual_reaction.session_id == given_session_id
        assert actual_reaction.message_id == given_message_id
        assert actual_reaction.kind == ReactionKind(given_reaction.kind)

        assert _add_spy.call_args[0][1] == mocked_user.user_id

        assert [r for r in actual_reaction.reasons] == given_reaction.reasons

    @pytest.mark.asyncio
    async def test_add_reaction_unauthorized(self, unauthenticated_client_with_mocks: TestClientWithMocks,
                                             mocker: pytest_mock.MockerFixture):
        client, mocked_service, _, _ = unauthenticated_client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"
        given_reaction = _ReactionRequest(kind=ReactionKind.LIKED, reasons=[])

        # AND the service's add method is spied on
        _add_spy = mocker.spy(mocked_service, "add")

        # WHEN a PUT request is made without authentication
        response = client.put(
            f"/conversations/{given_session_id}/messages/{given_message_id}/reactions",
            json=given_reaction.model_dump(),
        )

        # THEN the response is UNAUTHORIZED
        assert response.status_code == HTTPStatus.UNAUTHORIZED
        # AND the service's add method was not called
        _add_spy.assert_not_called()

    @pytest.mark.asyncio
    async def test_add_reaction_forbidden(self, authenticated_client_with_mocks: TestClientWithMocks,
                                          mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_preferences, mocked_user = authenticated_client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"
        given_reaction = _ReactionRequest(kind=ReactionKind.LIKED, reasons=[])

        # AND the user doesn't have the given session_id in their sessions array
        mock_user_preferences = get_mock_user_preferences(456)  # Different session ID
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(return_value=mock_user_preferences)
        preferences_spy = mocker.spy(mocked_preferences, "get_user_preference_by_user_id")

        # AND the service's add method is spied on
        _add_spy = mocker.spy(mocked_service, "add")

        # WHEN a PUT request is made with the reaction
        response = client.put(
            f"/conversations/{given_session_id}/messages/{given_message_id}/reactions",
            json=given_reaction.model_dump(),
        )

        # THEN the response is FORBIDDEN
        assert response.status_code == HTTPStatus.FORBIDDEN
        # AND the service's add method was not called
        _add_spy.assert_not_called()

        # AND the user preferences repository was called with the correct user_id
        preferences_spy.assert_called_once_with(mocked_user.user_id)

    @pytest.mark.asyncio
    async def test_add_reaction_service_internal_server_error(self,
                                                              authenticated_client_with_mocks: TestClientWithMocks,
                                                              mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_preferences, mocked_user = authenticated_client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"
        given_reaction = _ReactionRequest(kind=ReactionKind.LIKED, reasons=[])

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(
            return_value=get_mock_user_preferences(given_session_id))
        preferences_spy = mocker.spy(mocked_preferences, "get_user_preference_by_user_id")

        # AND the service's add method will raise an unexpected error
        add_spy = mocker.spy(mocked_service, "add")
        add_spy.side_effect = Exception("Unexpected error")

        # WHEN a PUT request is made with the reaction
        response = client.put(
            f"/conversations/{given_session_id}/messages/{given_message_id}/reactions",
            json=given_reaction.model_dump(),
        )

        # THEN the response is INTERNAL_SERVER_ERROR
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        # AND the service's add method was called with the correct parameters
        add_spy.assert_called_once()
        actual_reaction = add_spy.call_args[0][0]
        assert isinstance(actual_reaction, Reaction)
        assert actual_reaction.session_id == given_session_id
        assert actual_reaction.message_id == given_message_id
        assert actual_reaction.kind == ReactionKind(given_reaction.kind)
        assert not actual_reaction.reasons

        # AND the user preferences repository was called with the correct user_id
        preferences_spy.assert_called_once_with(mocked_user.user_id)

    @pytest.mark.asyncio
    async def test_add_reaction_user_preferences_internal_server_error(self,
                                                                       authenticated_client_with_mocks: TestClientWithMocks,
                                                                       mocker: pytest_mock.MockerFixture):
        client, _, mocked_preferences_repository, mocked_user = authenticated_client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"
        given_reaction = _ReactionRequest(kind=ReactionKind.LIKED, reasons=[])

        # AND a UserPreferencesRepository that will raise an unexpected error
        get_user_preferences_spy = mocker.spy(mocked_preferences_repository, "get_user_preference_by_user_id")
        get_user_preferences_spy.side_effect = Exception("Unexpected error")

        # WHEN a PUT request is made with the reaction
        response = client.put(
            f"/conversations/{given_session_id}/messages/{given_message_id}/reactions",
            json=given_reaction.model_dump(),
        )

        # THEN the response is INTERNAL_SERVER_ERROR
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        # AND the user preferences repository was called with the correct user_id
        get_user_preferences_spy.assert_called_once_with(mocked_user.user_id)

    @pytest.mark.asyncio
    async def test_invalid_payload(self, authenticated_client_with_mocks: TestClientWithMocks):
        client, _, mocked_preferences, _ = authenticated_client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"
        given_invalid_payload = {"foo": "bar"}

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(
            return_value=get_mock_user_preferences(given_session_id))

        # WHEN a PUT request where `session_id` in the path matches the user's `session_id`
        response = client.put(
            f"/conversations/{given_session_id}/messages/{given_message_id}/reactions",
            json=given_invalid_payload,
        )

        # THEN the response is UNPROCESSABLE_ENTITY due to ReactionRequest validation
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    # ----- delete reaction tests -----
    @pytest.mark.asyncio
    async def test_delete_reaction_successful(self, authenticated_client_with_mocks: TestClientWithMocks,
                                              mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_preferences, mocked_user = authenticated_client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(
            return_value=get_mock_user_preferences(given_session_id))
        preferences_spy = mocker.spy(mocked_preferences, "get_user_preference_by_user_id")

        # AND the service's delete method is spied on
        _delete_spy = mocker.spy(mocked_service, "delete")

        # WHEN a DELETE request is made
        response = client.delete(
            f"/conversations/{given_session_id}/messages/{given_message_id}/reactions"
        )

        # THEN the response is NO_CONTENT
        assert response.status_code == HTTPStatus.NO_CONTENT
        # AND the response is empty
        assert response.content == b""

        # AND the user preferences repository was called with the correct user_id
        preferences_spy.assert_called_once_with(mocked_user.user_id)

        # AND the service's delete method was called with the correct parameters
        _delete_spy.assert_called_once_with(given_session_id, given_message_id)

    @pytest.mark.asyncio
    async def test_delete_reaction_unauthorized(self, unauthenticated_client_with_mocks: TestClientWithMocks,
                                                mocker: pytest_mock.MockerFixture):
        client, mocked_service, _, _ = unauthenticated_client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND the service's delete method is spied on
        _delete_spy = mocker.spy(mocked_service, "delete")

        # WHEN a DELETE request is made without authentication
        response = client.delete(
            f"/conversations/{given_session_id}/messages/{given_message_id}/reactions"
        )

        # THEN the response is UNAUTHORIZED
        assert response.status_code == HTTPStatus.UNAUTHORIZED
        # AND the service's delete method was not called
        _delete_spy.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_reaction_forbidden(self, authenticated_client_with_mocks: TestClientWithMocks,
                                             mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_preferences, mocked_user = authenticated_client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND the user doesn't have the given session_id in their sessions array
        mock_user_preferences = get_mock_user_preferences(456)  # Different session ID
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(return_value=mock_user_preferences)
        preferences_spy = mocker.spy(mocked_preferences, "get_user_preference_by_user_id")
        # AND the service's delete method is spied on
        _delete_spy = mocker.spy(mocked_service, "delete")

        # WHEN a DELETE request is made
        response = client.delete(
            f"/conversations/{given_session_id}/messages/{given_message_id}/reactions"
        )

        # THEN the response is FORBIDDEN
        assert response.status_code == HTTPStatus.FORBIDDEN
        # AND the service's delete method was not called
        _delete_spy.assert_not_called()

        # AND the user preferences repository was called with the correct user_id
        preferences_spy.assert_called_once_with(mocked_user.user_id)

    @pytest.mark.asyncio
    async def test_delete_reaction_service_internal_server_error(self,
                                                                 authenticated_client_with_mocks: TestClientWithMocks,
                                                                 mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_preferences, mocked_user = authenticated_client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(
            return_value=get_mock_user_preferences(given_session_id))
        preferences_spy = mocker.spy(mocked_preferences, "get_user_preference_by_user_id")

        # AND the service's delete method will raise an unexpected error
        delete_spy = mocker.spy(mocked_service, "delete")
        delete_spy.side_effect = Exception("Unexpected error")

        # WHEN a DELETE request is made
        response = client.delete(
            f"/conversations/{given_session_id}/messages/{given_message_id}/reactions"
        )

        # THEN the response is INTERNAL_SERVER_ERROR
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        # AND the service's delete method was called with the correct parameters
        delete_spy.assert_called_once_with(given_session_id, given_message_id)

        # AND the user preferences repository was called with the correct user_id
        preferences_spy.assert_called_once_with(mocked_user.user_id)

    @pytest.mark.asyncio
    async def test_delete_reaction_user_preferences_internal_server_error(self,
                                                                          authenticated_client_with_mocks: TestClientWithMocks,
                                                                          mocker: pytest_mock.MockerFixture):
        client, _, mocked_preferences_repository, mocked_user = authenticated_client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND a UserPreferencesRepository that will raise an unexpected error
        get_user_preferences_spy = mocker.spy(mocked_preferences_repository, "get_user_preference_by_user_id")
        get_user_preferences_spy.side_effect = Exception("Unexpected error")

        # WHEN a DELETE request is made
        response = client.delete(f"/conversations/{given_session_id}/messages/{given_message_id}/reactions")

        # THEN the response is INTERNAL_SERVER_ERROR
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        # AND the user preferences repository was called with the correct user_id
        get_user_preferences_spy.assert_called_once_with(mocked_user.user_id)
