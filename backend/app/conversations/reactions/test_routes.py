from http import HTTPStatus

import pytest
import pytest_mock
from fastapi import FastAPI, APIRouter
from fastapi.testclient import TestClient

from app.conversations.reactions.routes import add_reaction_routes, get_reaction_service
from app.conversations.reactions.service import IReactionService
from app.conversations.reactions.types import ReactionRequest, ReactionKind, DislikeReason

TestClientWithMocks = tuple[TestClient, IReactionService]


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

    # Set up the FastAPI app with the mocked dependencies
    api_router = APIRouter()
    app = FastAPI()

    # Set up the app dependency override
    app.dependency_overrides[get_reaction_service] = _mocked_get_reaction_service

    # Add the reaction routes to the conversations router
    add_reaction_routes(api_router)
    app.include_router(api_router)

    yield TestClient(app), _instance_reaction_service
    app.dependency_overrides = {}


class TestAddReaction:
    @pytest.mark.asyncio
    async def test_add_liked_reaction_success(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND a valid liked reaction request
        given_reaction = ReactionRequest(kind=ReactionKind.LIKED)

        # AND the service's add method is spied on
        _add_spy = mocker.spy(mocked_service, "add")

        # WHEN a PUT request is made with the reaction
        response = client.put(
            f"/{given_session_id}/messages/{given_message_id}/reaction",
            json=given_reaction.model_dump(),
        )

        # THEN the response is CREATED
        assert response.status_code == HTTPStatus.CREATED
        # AND the response is empty
        assert response.json() is None
        # AND the service's add method was called with the correct parameters
        _add_spy.assert_called_once_with(given_session_id, given_message_id, given_reaction)

    @pytest.mark.asyncio
    async def test_add_disliked_reaction_success(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND a valid disliked reaction request with reasons
        given_reaction = ReactionRequest(
            kind=ReactionKind.DISLIKED,
            reason=[DislikeReason.INCORRECT]
        )

        # AND the service's add method is spied on
        _add_spy = mocker.spy(mocked_service, "add")

        # WHEN a PUT request is made with the reaction
        response = client.put(
            f"/{given_session_id}/messages/{given_message_id}/reaction",
            json=given_reaction.model_dump(),
        )

        # THEN the response is CREATED
        assert response.status_code == HTTPStatus.CREATED
        # AND the response is empty
        assert response.json() is None
        # AND the service's add method was called with the correct parameters
        _add_spy.assert_called_once_with(given_session_id, given_message_id, given_reaction)

    @pytest.mark.asyncio
    async def test_add_liked_reaction_with_reason_fails(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND an invalid liked reaction request with reasons
        given_reaction = {
            "kind": ReactionKind.LIKED,
            "reason": [DislikeReason.INCORRECT]
        }

        # AND the service's add method is spied on
        _add_spy = mocker.spy(mocked_service, "add")

        # WHEN a PUT request is made with the reaction
        response = client.put(
            f"/{given_session_id}/messages/{given_message_id}/reaction",
            json=given_reaction,
        )

        # THEN the response is BAD REQUEST
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
        # AND the service's add method was not called
        _add_spy.assert_not_called()

    @pytest.mark.asyncio
    async def test_add_disliked_reaction_without_reason_fails(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND an invalid disliked reaction request without reasons
        given_reaction = {
            "kind": ReactionKind.DISLIKED
        }

        # AND the service's add method is spied on
        _add_spy = mocker.spy(mocked_service, "add")

        # WHEN a PUT request is made with the reaction
        response = client.put(
            f"/{given_session_id}/messages/{given_message_id}/reaction",
            json=given_reaction,
        )

        # THEN the response is BAD REQUEST
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
        # AND the service's add method was not called
        _add_spy.assert_not_called()

    @pytest.mark.asyncio
    async def test_add_reaction_with_invalid_reaction_kind_fails(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service = client_with_mocks
        # GIVEN an invalid reaction kind
        given_session_id = 123
        given_message_id = "message123"
        given_reaction = {
            "kind": "invalid_kind"
        }

        # AND the service's add method is spied on
        _add_spy = mocker.spy(mocked_service, "add")

        # WHEN a PUT request is made with the reaction
        response = client.put(
            f"/{given_session_id}/messages/{given_message_id}/reaction",
            json=given_reaction,
        )

        # THEN the response is BAD REQUEST
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
        # AND the service's add method was not called
        _add_spy.assert_not_called()


class TestDeleteReaction:
    @pytest.mark.asyncio
    async def test_delete_reaction_success(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service = client_with_mocks
        # GIVEN a valid session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND the service's delete method is spied on
        _delete_spy = mocker.spy(mocked_service, "delete")

        # WHEN a DELETE request is made
        response = client.delete(
            f"/{given_session_id}/messages/{given_message_id}/reaction"
        )

        # THEN the response is NO CONTENT
        assert response.status_code == HTTPStatus.NO_CONTENT
        # AND the response is empty
        assert response.content == b""
        # AND the service's delete method was called with the correct parameters
        _delete_spy.assert_called_once_with(given_session_id, given_message_id) 