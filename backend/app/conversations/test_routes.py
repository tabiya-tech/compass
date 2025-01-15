from datetime import datetime
from http import HTTPStatus
from unittest.mock import AsyncMock

import pytest
import pytest_mock

from app.agent.experience import WorkType
from app.conversations.types import ConversationResponse, ConversationMessage, ConversationInput, \
    ConversationMessageSender
from app.conversations.constants import MAX_MESSAGE_LENGTH
from app.conversations.routes import get_conversation_service, add_conversation_routes
from app.conversations.service import IConversationService, UnauthorizedSessionAccessError, \
    ConversationAlreadyConcludedError
from app.types import Experience, Skill
from app.users.auth import UserInfo

from fastapi.testclient import TestClient
from fastapi import FastAPI

from common_libs.test_utilities.mock_auth import MockAuth

TestClientWithMocks = tuple[TestClient, IConversationService, UserInfo]

def normalize(obj):
    """
    Recursively convert enums to their underlying values in the given object.
    Used because we use enum values and `.model_dump()` doesn't automatically convert enums
    """
    if isinstance(obj, dict):
        return {key: normalize(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [normalize(item) for item in obj]
    # If it's an enum, return its value.
    elif hasattr(obj, "value"):
        return obj.value
    else:
        return obj

@pytest.fixture(scope='function')
def client_with_mocks() -> TestClientWithMocks:
    # mock the conversation service
    class MockConversationService(IConversationService):
        async def send(self, user_id: str, session_id: int, user_input: str, clear_memory: bool, filter_pii: bool):
            return None
        async def get_history_by_session_id(self, user_id: str, session_id: int):
            return None
        async def get_experiences_by_session_id(self, user_id: str, session_id: int):
            return None

    _instance_conversation_service = MockConversationService()

    def _mocked_conversation_service() -> IConversationService:
        return _instance_conversation_service

    _instance_auth = MockAuth()

    # Set up the FastAPI app with the mocked dependencies
    app = FastAPI()

    # Set up the app dependency override
    app.dependency_overrides[get_conversation_service] = _mocked_conversation_service

    # Add the conversation routes to the app
    add_conversation_routes(app, authentication=_instance_auth)

    yield TestClient(app), _instance_conversation_service, _instance_auth.mocked_user
    app.dependency_overrides = {}

class TestConversationsRoutes:
    @pytest.mark.asyncio
    # ----- _send_message tests -----
    async def test_send_successful(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, _ = client_with_mocks
        # GIVEN a payload to send a message
        given_user_message = ConversationInput(
            user_input="foo"
        )

        # AND the user has a valid session
        given_session_id = 123

        # AND a ConversationService that will return a valid conversation response
        expected_response = ConversationResponse(
            messages=[
                ConversationMessage(
                    message_id = "foo_id",
                    message = given_user_message.user_input,
                    sender = ConversationMessageSender.USER,
                    sent_at = datetime.now().isoformat()
                ),
                ConversationMessage(
                    message_id = "bar_id",
                    message = "Hello, I'm compass",
                    sender = ConversationMessageSender.COMPASS,
                    sent_at = datetime.now().isoformat()
                ),
            ],
            conversation_completed=False,
            conversation_conducted_at=datetime.now().isoformat(),
            experiences_explored=0
        )
        mocked_service.send = AsyncMock(return_value=expected_response)
        # WHEN a POST request where the session_id is in the Path
        response = client.post(
            f"/conversations/{given_session_id}/messages",
            json=given_user_message.model_dump(),
        )

        # THEN the response is CREATED
        assert response.status_code == HTTPStatus.CREATED

        # AND the response is the expected response
        assert response.json() == normalize(expected_response.model_dump())

    @pytest.mark.asyncio
    async def test_send_forbidden(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, _ = client_with_mocks
        # GIVEN a payload to send a message
        given_user_message = ConversationInput(
            user_input="foo"
        )

        # AND the user has a valid session
        given_session_id = 123

        # AND a ConversationService that will raise an UnauthorizedSessionAccessError
        send_spy = mocker.spy(mocked_service, "send")
        send_spy.side_effect = UnauthorizedSessionAccessError("test_user", given_session_id)

        # WHEN a POST request where the session_id is in the Path
        response = client.post(
            f"/conversations/{given_session_id}/messages",
            json=given_user_message.model_dump(),
        )

        # THEN the response is FORBIDDEN
        assert response.status_code == HTTPStatus.FORBIDDEN

    @pytest.mark.asyncio
    async def test_send_message_too_large(self, client_with_mocks: TestClientWithMocks):
        client, _, _ = client_with_mocks
        # GIVEN a payload with a message that is too long
        given_user_message = ConversationInput(
            user_input="a" * (MAX_MESSAGE_LENGTH + 1)  # Create a string longer than MAX_MESSAGE_LENGTH characters
        )

        # AND the user has a valid session
        given_session_id = 123

        # WHEN a POST request where the session_id is in the Path
        response = client.post(
            f"/conversations/{given_session_id}/messages",
            json=given_user_message.model_dump(),
        )

        # THEN the response is REQUEST_ENTITY_TOO_LARGE
        assert response.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE

    @pytest.mark.asyncio
    async def test_send_conversation_already_concluded(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, _ = client_with_mocks
        # GIVEN a payload to send a message
        given_user_message = ConversationInput(
            user_input="foo"
        )

        # AND the user has a valid session
        given_session_id = 123

        # AND a ConversationService that will raise a ConversationAlreadyConcludedError
        send_spy = mocker.spy(mocked_service, "send")
        send_spy.side_effect = ConversationAlreadyConcludedError(given_session_id)

        # WHEN a POST request where the session_id is in the Path
        response = client.post(
            f"/conversations/{given_session_id}/messages",
            json=given_user_message.model_dump(),
        )

        # THEN the response is BAD_REQUEST
        assert response.status_code == HTTPStatus.BAD_REQUEST

    @pytest.mark.asyncio
    async def test_send_internal_server_error(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, _ = client_with_mocks
        # GIVEN a payload to send a message
        given_user_message = ConversationInput(
            user_input="foo"
        )

        # AND the user has a valid session
        given_session_id = 123

        # AND a ConversationService that will raise an unexpected error
        send_spy = mocker.spy(mocked_service, "send")
        send_spy.side_effect = Exception("Unexpected error")

        # WHEN a POST request where the session_id is in the Path
        response = client.post(
            f"/conversations/{given_session_id}/messages",
            json=given_user_message.model_dump(),
        )

        # THEN the response is INTERNAL_SERVER_ERROR
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

    @pytest.mark.asyncio
    async def test_send_invalid_payload(self, client_with_mocks: TestClientWithMocks):
        client, _, _ = client_with_mocks
        # GIVEN an invalid payload as a dictionary
        given_invalid_payload = {"foo": "bar"} # expected object with user_input

        # AND the request has a valid session id
        given_session_id = 123

        # WHEN a GET request where `user_id` in the path matches the authenticated user's `user_id`
        response = client.post(
            f"/conversations/{given_session_id}/messages",
            json=given_invalid_payload,
        )

        # THEN the response is UNPROCESSABLE_ENTITY
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    # ----- _get_conversation_history tests -----
    @pytest.mark.asyncio
    async def test_get_history_successful(self, client_with_mocks: TestClientWithMocks):
        client, mocked_service, _ = client_with_mocks
        # GIVEN a valid session id
        given_session_id = 123

        # AND a ConversationService that will return a valid conversation response
        expected_response = ConversationResponse(
            messages=[
                ConversationMessage(
                    message_id="test_id",
                    message="test message",
                    sender=ConversationMessageSender.USER,
                    sent_at=datetime.now().isoformat()
                )
            ],
            conversation_completed=False,
            conversation_conducted_at=datetime.now().isoformat(),
            experiences_explored=0
        )
        mocked_service.get_history_by_session_id = AsyncMock(return_value=expected_response)

        # WHEN a GET request where the session_id is in the Path
        response = client.get(f"/conversations/{given_session_id}/messages")

        # THEN the response is OK
        assert response.status_code == HTTPStatus.OK
        # AND the response matches the expected response
        assert response.json() == normalize(expected_response.model_dump())

    @pytest.mark.asyncio
    async def test_get_history_forbidden(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, _ = client_with_mocks
        # GIVEN a valid session id
        given_session_id = 123

        # AND a ConversationService that will raise an UnauthorizedSessionAccessError
        get_history_spy = mocker.spy(mocked_service, "get_history_by_session_id")
        get_history_spy.side_effect = UnauthorizedSessionAccessError("test_user", given_session_id)

        # WHEN a GET request where the session_id is in the Path
        response = client.get(f"/conversations/{given_session_id}/messages")

        # THEN the response is FORBIDDEN
        assert response.status_code == HTTPStatus.FORBIDDEN

    @pytest.mark.asyncio
    async def test_get_history_internal_server_error(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, _ = client_with_mocks
        # GIVEN a valid session id
        given_session_id = 123

        # AND a ConversationService that will raise an unexpected error
        get_history_spy = mocker.spy(mocked_service, "get_history_by_session_id")
        get_history_spy.side_effect = Exception("Unexpected error")

        # WHEN a GET request where the session_id is in the Path
        response = client.get(f"/conversations/{given_session_id}/messages")

        # THEN the response is INTERNAL_SERVER_ERROR
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

    # ----- _get_experiences tests -----
    @pytest.mark.asyncio
    async def test_get_experiences_successful(self, client_with_mocks: TestClientWithMocks):
        client, mocked_service, _ = client_with_mocks
        # GIVEN a valid session id
        given_session_id = 123

        # AND a ConversationService that will return a list of experiences
        expected_response = [
            Experience(
                UUID="foo_uuid",
                experience_title="Foo Bar",
                company="Foo Company",
                location="Foo Location",
                start_date="2020-01-01",
                end_date="2021-01-01",
                work_type=WorkType.SELF_EMPLOYMENT,
                top_skills=[
                    Skill(
                        UUID="bar_uuid",
                        preferredLabel="Baz",
                        description="Foo bar baz",
                        altLabels=["foo_label_1", "bar_label_2"]
                    )
                ]
            )
        ]
        mocked_service.get_experiences_by_session_id = AsyncMock(return_value=expected_response)

        # WHEN a GET request where the session_id is in the Path
        response = client.get(f"/conversations/{given_session_id}/experiences")

        # THEN the response is OK
        assert response.status_code == HTTPStatus.OK
        # AND the response matches the expected response
        assert response.json() == normalize([exp.model_dump() for exp in expected_response])

    @pytest.mark.asyncio
    async def test_get_experiences_forbidden(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, _ = client_with_mocks
        # GIVEN a valid session id
        given_session_id = 123

        # AND a ConversationService that will raise an UnauthorizedSessionAccessError
        get_experiences_spy = mocker.spy(mocked_service, "get_experiences_by_session_id")
        get_experiences_spy.side_effect = UnauthorizedSessionAccessError("test_user", given_session_id)

        # WHEN a GET request where the session_id is in the Path
        response = client.get(f"/conversations/{given_session_id}/experiences")

        # THEN the response is FORBIDDEN
        assert response.status_code == HTTPStatus.FORBIDDEN

    @pytest.mark.asyncio
    async def test_get_experiences_internal_server_error(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, _ = client_with_mocks
        # GIVEN a valid session id
        given_session_id = 123

        # AND a ConversationService that will raise an unexpected error
        get_experiences_spy = mocker.spy(mocked_service, "get_experiences_by_session_id")
        get_experiences_spy.side_effect = Exception("Unexpected error")

        # WHEN a GET request where the session_id is in the Path
        response = client.get(f"/conversations/{given_session_id}/experiences")

        # THEN the response is INTERNAL_SERVER_ERROR
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

