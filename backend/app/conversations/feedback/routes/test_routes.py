"""
Tests for the feedback routes
"""
import json
from datetime import datetime
from http import HTTPStatus
from typing import Generator
from unittest.mock import AsyncMock

import pytest
import pytest_mock
from fastapi import FastAPI, APIRouter
from fastapi.testclient import TestClient

from app.conversations.feedback.services.errors import InvalidQuestionError, InvalidOptionError
from app.conversations.feedback.services.service import IUserFeedbackService
from app.conversations.feedback.services.types import NewFeedbackSpec, NewFeedbackVersionSpec, NewFeedbackItemSpec, \
    Feedback, \
    Version, FeedbackItem, Answer
from app.users.auth import UserInfo
from app.users.get_user_preferences_repository import get_user_preferences_repository
from app.users.repositories import IUserPreferenceRepository
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement
from app.users.types import UserPreferences, UserPreferencesRepositoryUpdateRequest
from common_libs.test_utilities.mock_auth import MockAuth, UnauthenticatedMockAuth
from ._types import SimplifiedAnswer, FeedbackResponse
from .routes import add_user_feedback_routes, _get_user_feedback_service, \
    MAX_PAYLOAD_SIZE

TestClientWithMocks = tuple[TestClient, IUserFeedbackService, IUserPreferenceRepository, UserInfo | None]


def _get_new_feedback_spec() -> NewFeedbackSpec:
    return NewFeedbackSpec(
        version=NewFeedbackVersionSpec(frontend="1.0.0"),
        feedback_items_specs=[NewFeedbackItemSpec(
            question_id="interaction_ease",
            simplified_answer=SimplifiedAnswer(selected_options_keys=["5"]),
        )]
    )


def _def_feedback() -> Feedback:
    return Feedback(
        id="mock_doc_id",
        session_id=1,
        user_id="user_id",
        version=Version(frontend="1.0.0", backend="1.0.0"),
        feedback_items=[FeedbackItem(
            question_id="foo",
            question_text="bar",
            description="baz",
            answer=Answer(
                selected_options={"foo": "bar"},
                rating_numeric=5,
                rating_boolean=True,
                comment="baz"
            )
        )],
        created_at=datetime.now()
    )


def _get_mock_user_preferences(session_id: int):
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

    # Mock the feedback service
    class MockedFeedbackService(IUserFeedbackService):
        async def upsert_user_feedback(self, user_id: str, session_id: int, feedback: Feedback) -> Feedback:
            raise NotImplementedError()

        async def get_answered_questions(self, user_id: str) -> list[int]:
            raise NotImplementedError()

    mocked_feedback_service = MockedFeedbackService()

    # Mock the user preferences repository
    class MockedUserPreferencesRepository(IUserPreferenceRepository):
        async def get_user_preference_by_user_id(self, user_id: str) -> UserPreferences:
            raise NotImplementedError()

        async def update_user_preference(self, user_id: str,
                                         request: UserPreferencesRepositoryUpdateRequest) -> UserPreferences:
            raise NotImplementedError()

        async def insert_user_preference(self, user_id: str, user_preference: UserPreferences) -> UserPreferences:
            raise NotImplementedError()

        async def get_experiments_by_user_id(self, user_id: str) -> dict[str, str]:
            raise NotImplementedError()

        async def get_experiments_by_user_ids(self, user_ids: list[str]) -> dict[str, dict[str, str]]:
            raise NotImplementedError()

        async def set_experiment_by_user_id(self, user_id: str, experiment_id: str, experiment_class: str) -> None:
            raise NotImplementedError()

    mocked_user_preferences_repository = MockedUserPreferencesRepository()

    # Set up the FastAPI app with the mocked dependencies
    app = FastAPI()

    # Set up the app dependency override
    app.dependency_overrides[_get_user_feedback_service] = lambda: mocked_feedback_service
    app.dependency_overrides[get_user_preferences_repository] = lambda: mocked_user_preferences_repository

    conversations_router = APIRouter(
        prefix="/conversations/{session_id}",
        tags=["conversations"]
    )

    # Add the feedback routes to the conversations router
    add_user_feedback_routes(conversations_router, auth)
    app.include_router(conversations_router)

    # Create a test client
    client = TestClient(app)

    return client, mocked_feedback_service, mocked_user_preferences_repository, auth.mocked_user


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


class TestFeedbackRoutes:
    @pytest.mark.asyncio
    async def test_upsert_feedback_successful(self, authenticated_client_with_mocks: TestClientWithMocks):
        client, mocked_service, mocked_preferences, mocked_user = authenticated_client_with_mocks
        # GIVEN a valid feedback request
        given_session_id = 123
        given_feedback_request = _get_new_feedback_spec()

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(
            return_value=_get_mock_user_preferences(given_session_id))

        # AND the service's upsert_user_feedback method will return some feedback object it upserted in the database
        given_upserted_feedback = _def_feedback()
        mocked_service.upsert_user_feedback = AsyncMock(return_value=given_upserted_feedback)

        # WHEN a PATCH request is made with the given feedback request
        actual_response = client.patch(
            f"conversations/{given_session_id}/feedback",
            json=given_feedback_request.model_dump(),
        )

        # THEN the service's upsert_user_feedback method was called with given request
        mocked_service.upsert_user_feedback.assert_called_once_with(mocked_user.user_id, given_session_id,
                                                                    given_feedback_request)

        # AND the response is a FeedbackResponse object
        actual_feedback_response = FeedbackResponse(**actual_response.json())

        # AND the it contains the data from the upserted feedback

        assert actual_feedback_response.id == given_upserted_feedback.id
        assert actual_feedback_response.version == given_upserted_feedback.version
        assert len(actual_feedback_response.feedback_items) == len(given_upserted_feedback.feedback_items)
        for actual_item, expected_item in zip(actual_feedback_response.feedback_items,
                                              given_upserted_feedback.feedback_items):
            assert actual_item.question_id == expected_item.question_id
            assert actual_item.question_text == expected_item.question_text
            assert actual_item.description == expected_item.description
            assert actual_item.simplified_answer == SimplifiedAnswer.from_answer(expected_item.answer)
        assert actual_feedback_response.created_at == given_upserted_feedback.created_at

        # AND the response is OK
        assert actual_response.status_code == HTTPStatus.OK

    @pytest.mark.asyncio
    async def test_upsert_feedback_forbidden(self, authenticated_client_with_mocks: TestClientWithMocks,
                                             mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_preferences, mocked_user = authenticated_client_with_mocks
        # GIVEN a valid feedback request
        given_session_id = 123
        given_feedback_request = _get_new_feedback_spec()

        # AND the user does not have access to the session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(
            return_value=_get_mock_user_preferences(given_session_id + 1))  # Different session ID
        preferences_spy = mocker.spy(mocked_preferences, "get_user_preference_by_user_id")

        # AND the service's upsert_user_feedback method is spied on
        _upsert_spy = mocker.spy(mocked_service, "upsert_user_feedback")

        # WHEN a PATCH request is made with the feedback
        response = client.patch(
            f"/conversations/{given_session_id}/feedback",
            json=given_feedback_request.model_dump(),
        )

        # THEN the response is FORBIDDEN
        assert response.status_code == HTTPStatus.FORBIDDEN
        # AND the user preferences repository was called with the correct user_id
        preferences_spy.assert_called_once_with(mocked_user.user_id)
        # AND the service's upsert_user_feedback method was not called
        _upsert_spy.assert_not_called()

    @pytest.mark.asyncio
    async def test_upsert_feedback_unauthorized(self, unauthenticated_client_with_mocks: TestClientWithMocks,
                                                mocker: pytest_mock.MockerFixture):
        client, mocked_service, _, _ = unauthenticated_client_with_mocks
        # GIVEN a valid feedback request
        given_session_id = 123
        given_feedback_request = _get_new_feedback_spec()

        # AND the service's upsert_user_feedback method is spied on
        _upsert_spy = mocker.spy(mocked_service, "upsert_user_feedback")

        # WHEN a PATCH request is made without authentication
        response = client.patch(
            f"/conversations/{given_session_id}/feedback",
            json=given_feedback_request.model_dump(),
        )

        # THEN the response is UNAUTHORIZED
        assert response.status_code == HTTPStatus.UNAUTHORIZED
        # AND the service's upsert_user_feedback method was not called
        _upsert_spy.assert_not_called()

    @pytest.mark.asyncio
    async def test_upsert_feedback_invalid_question(self, authenticated_client_with_mocks: TestClientWithMocks,
                                                    mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_preferences, mocked_user = authenticated_client_with_mocks
        # GIVEN a feedback request with an invalid question ID
        given_session_id = 123
        given_feedback_request = _get_new_feedback_spec()
        given_feedback_request.feedback_items_specs[0].question_id = "INVALID_QUESTION_ID"

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(
            return_value=_get_mock_user_preferences(given_session_id))
        preferences_spy = mocker.spy(mocked_preferences, "get_user_preference_by_user_id")

        # AND the service's upsert_user_feedback method raises InvalidQuestionError
        _upsert_spy = mocker.spy(mocked_service, "upsert_user_feedback")
        _upsert_spy.side_effect = InvalidQuestionError("invalid_question")

        # WHEN a PATCH request is made with the feedback
        response = client.patch(
            f"/conversations/{given_session_id}/feedback",
            json=given_feedback_request.model_dump(),
        )

        # THEN the response is BAD_REQUEST
        assert response.status_code == HTTPStatus.BAD_REQUEST
        # AND the error message contains the invalid question ID
        assert "invalid_question" in response.json()["detail"]
        # AND the user preferences repository was called with the correct user_id
        preferences_spy.assert_called_once_with(mocked_user.user_id)
        # AND the service's upsert_user_feedback method was called
        _upsert_spy.assert_called_once()

    @pytest.mark.asyncio
    async def test_upsert_feedback_invalid_option(self, authenticated_client_with_mocks: TestClientWithMocks,
                                                  mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_preferences, mocked_user = authenticated_client_with_mocks
        # GIVEN a feedback request with an invalid option
        given_session_id = 123
        given_feedback_request = _get_new_feedback_spec()

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(
            return_value=_get_mock_user_preferences(given_session_id))
        preferences_spy = mocker.spy(mocked_preferences, "get_user_preference_by_user_id")

        # AND the service's upsert_user_feedback method raises InvalidOptionError
        _upsert_spy = mocker.spy(mocked_service, "upsert_user_feedback")
        _upsert_spy.side_effect = InvalidOptionError("invalid_option", "work_experience_accuracy")

        # WHEN a PATCH request is made with the feedback
        response = client.patch(
            f"/conversations/{given_session_id}/feedback",
            json=given_feedback_request.model_dump(),
        )

        # THEN the response is BAD_REQUEST
        assert response.status_code == HTTPStatus.BAD_REQUEST
        # AND the error message contains both the invalid option and question ID
        error_detail = response.json()["detail"]
        assert "invalid_option" in error_detail
        assert "work_experience_accuracy" in error_detail
        # AND the user preferences repository was called with the correct user_id
        preferences_spy.assert_called_once_with(mocked_user.user_id)
        # AND the service's upsert_user_feedback method was called
        _upsert_spy.assert_called_once()

    @pytest.mark.asyncio
    async def test_upsert_feedback_payload_too_large(self, authenticated_client_with_mocks: TestClientWithMocks,
                                                     mocker: pytest_mock.MockerFixture):
        client, mocked_service, _, _ = authenticated_client_with_mocks
        # GIVEN a feedback request with a total payload size that exceeds the limit
        # Create a feedback with a large version
        given_session_id = 123
        given_feedback_request = NewFeedbackSpec(
            version=NewFeedbackVersionSpec(frontend=""),
            feedback_items_specs=[]
        )
        size_of_min_payload = len(json.dumps(given_feedback_request.model_dump()))
        over_limit = MAX_PAYLOAD_SIZE - size_of_min_payload + 1
        # Create a feedback with large version
        given_feedback_request.version.frontend = "x" * over_limit

        # AND the service's upsert_user_feedback method is spied on
        _upsert_spy = mocker.spy(mocked_service, "upsert_user_feedback")

        # WHEN a PATCH request is made with the feedback
        response = client.patch(
            f"/conversations/{given_session_id}/feedback",
            json=given_feedback_request.model_dump(),
        )

        # THEN the response is REQUEST_ENTITY_TOO_LARGE
        assert response.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
        # AND the error message indicates the payload is too large
        assert "payload" in response.json()["detail"].lower()
        # AND the service's upsert_user_feedback method was not called
        _upsert_spy.assert_not_called()
