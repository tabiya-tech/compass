"""
Tests for the career readiness routes.
"""
from datetime import datetime, timezone
from http import HTTPStatus
from typing import Optional

import pytest
import pytest_mock
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.career_readiness.errors import (
    ConversationAccessDeniedError,
    ConversationAlreadyExistsError,
    ConversationNotFoundError,
    CareerReadinessModuleNotFoundError,
    QuizAlreadyPassedError,
    QuizNotAvailableError,
)
from app.career_readiness.routes import add_career_readiness_routes, get_career_readiness_service
from app.career_readiness.service import ICareerReadinessService
from app.users.plain_personal_data.routes import get_plain_personal_data_service
from app.users.plain_personal_data.service import IPlainPersonalDataService
from app.users.plain_personal_data.types import PlainPersonalData
from app.career_readiness.types import (
    CareerReadinessConversationResponse,
    CareerReadinessMessage,
    CareerReadinessMessageSender,
    ConversationMode,
    ModuleDetail,
    ModuleListResponse,
    ModuleStatus,
    ModuleSummary,
    QuizQuestionResponse,
    QuizQuestionResult,
    QuizResponse,
    QuizSubmissionResponse,
)
from app.conversations.constants import MAX_MESSAGE_LENGTH
from app.users.auth import UserInfo
from common_libs.test_utilities.mock_auth import MockAuth

TestClientWithMocks = tuple[TestClient, ICareerReadinessService, UserInfo]


def _make_message(
    sender: CareerReadinessMessageSender = CareerReadinessMessageSender.AGENT,
    message: str = "Hello",
) -> CareerReadinessMessage:
    return CareerReadinessMessage(
        message_id=str(ObjectId()),
        message=message,
        sender=sender,
        sent_at=datetime.now(timezone.utc),
    )


def _make_module_summary(module_id: str = "cv-development") -> ModuleSummary:
    return ModuleSummary(
        id=module_id,
        title="CV Development",
        description="Learn to write a CV.",
        icon="cv",
        status=ModuleStatus.NOT_STARTED,
        sort_order=1,
        input_placeholder="Ask about CVs...",
    )


def _make_conversation_response(
    conversation_id: str | None = None,
    module_id: str = "cv-development",
) -> CareerReadinessConversationResponse:
    return CareerReadinessConversationResponse(
        conversation_id=conversation_id or str(ObjectId()),
        module_id=module_id,
        messages=[_make_message()],
    )


@pytest.fixture(scope="function")
def client_with_mocks() -> TestClientWithMocks:
    """Create a FastAPI test client with mocked service and auth."""

    class MockPlainPersonalDataService(IPlainPersonalDataService):
        async def upsert(self, user_id: str, data: dict) -> None:
            return None

        async def get(self, user_id: str) -> Optional[PlainPersonalData]:
            return None

    class MockService(ICareerReadinessService):
        async def list_modules(self, user_id: str) -> ModuleListResponse:
            return ModuleListResponse(modules=[_make_module_summary()])

        async def get_module(self, user_id: str, module_id: str) -> ModuleDetail:
            return ModuleDetail(
                id=module_id,
                title="CV Development",
                description="Learn to write a CV.",
                icon="cv",
                status=ModuleStatus.NOT_STARTED,
                sort_order=1,
                input_placeholder="Ask about CVs...",
                scope="# CV Content",
            )

        async def create_conversation(self, user_id: str, module_id: str) -> CareerReadinessConversationResponse:
            return _make_conversation_response(module_id=module_id)

        async def send_message(self, user_id: str, module_id: str,
                               conversation_id: str, user_input: str) -> CareerReadinessConversationResponse:
            return _make_conversation_response(conversation_id=conversation_id, module_id=module_id)

        async def get_conversation_history(self, user_id: str, module_id: str,
                                           conversation_id: str) -> CareerReadinessConversationResponse:
            return _make_conversation_response(conversation_id=conversation_id, module_id=module_id)

        async def get_quiz(self, user_id: str, module_id: str,
                           conversation_id: str) -> QuizResponse:
            return QuizResponse(questions=[
                QuizQuestionResponse(question="Q1?", options=["A. Opt1", "B. Opt2"]),
            ])

        async def submit_quiz(self, user_id: str, module_id: str,
                              conversation_id: str, answers: dict[int, str]) -> QuizSubmissionResponse:
            return QuizSubmissionResponse(
                score=1, total=1, passed=True,
                question_results=[QuizQuestionResult(question_index=1, is_correct=True)],
                module_completed=True,
                conversation_mode=ConversationMode.SUPPORT,
            )

        async def delete_conversation(self, user_id: str, module_id: str, conversation_id: str) -> None:
            return None

    mock_service = MockService()
    mock_plain_personal_data_service = MockPlainPersonalDataService()
    mock_auth = MockAuth()

    app = FastAPI()
    app.dependency_overrides[get_career_readiness_service] = lambda: mock_service
    app.dependency_overrides[get_plain_personal_data_service] = lambda: mock_plain_personal_data_service

    add_career_readiness_routes(app, authentication=mock_auth)

    yield TestClient(app), mock_service, mock_auth.mocked_user
    app.dependency_overrides = {}


class TestListModules:
    """Tests for GET /career-readiness/modules."""

    def test_returns_200_with_modules(self, client_with_mocks: TestClientWithMocks):
        client, _, _ = client_with_mocks

        # WHEN modules are listed
        response = client.get("/career-readiness/modules")

        # THEN 200 OK is returned with modules
        assert response.status_code == HTTPStatus.OK
        body = response.json()
        assert len(body["modules"]) == 1
        assert body["modules"][0]["id"] == "cv-development"


class TestGetModule:
    """Tests for GET /career-readiness/modules/{module_id}."""

    def test_returns_200_with_module_detail(self, client_with_mocks: TestClientWithMocks):
        client, _, _ = client_with_mocks

        # WHEN a module is requested
        response = client.get("/career-readiness/modules/cv-development")

        # THEN 200 OK is returned
        assert response.status_code == HTTPStatus.OK
        body = response.json()
        assert body["id"] == "cv-development"

    def test_returns_404_when_not_found(self, client_with_mocks: TestClientWithMocks,
                                         mocker: pytest_mock.MockerFixture):
        client, mock_service, _ = client_with_mocks

        # GIVEN the service raises CareerReadinessModuleNotFoundError
        mocker.patch.object(mock_service, "get_module", side_effect=CareerReadinessModuleNotFoundError("nonexistent"))

        # WHEN the module is requested
        response = client.get("/career-readiness/modules/nonexistent")

        # THEN 404 is returned
        assert response.status_code == HTTPStatus.NOT_FOUND


class TestCreateConversation:
    """Tests for POST /career-readiness/modules/{module_id}/conversations."""

    def test_returns_201_on_success(self, client_with_mocks: TestClientWithMocks):
        client, _, _ = client_with_mocks

        # WHEN a conversation is created
        response = client.post("/career-readiness/modules/cv-development/conversations")

        # THEN 201 CREATED is returned
        assert response.status_code == HTTPStatus.CREATED
        body = response.json()
        assert body["module_id"] == "cv-development"
        assert len(body["messages"]) == 1

    def test_returns_404_when_module_not_found(self, client_with_mocks: TestClientWithMocks,
                                                mocker: pytest_mock.MockerFixture):
        client, mock_service, _ = client_with_mocks

        # GIVEN the service raises CareerReadinessModuleNotFoundError
        mocker.patch.object(mock_service, "create_conversation", side_effect=CareerReadinessModuleNotFoundError("nonexistent"))

        # WHEN a conversation is created
        response = client.post("/career-readiness/modules/nonexistent/conversations")

        # THEN 404 is returned
        assert response.status_code == HTTPStatus.NOT_FOUND

    def test_returns_409_when_already_exists(self, client_with_mocks: TestClientWithMocks,
                                              mocker: pytest_mock.MockerFixture):
        client, mock_service, mocked_user = client_with_mocks

        # GIVEN the service raises ConversationAlreadyExistsError
        mocker.patch.object(mock_service, "create_conversation",
                            side_effect=ConversationAlreadyExistsError("cv-development", mocked_user.user_id))

        # WHEN a conversation is created
        response = client.post("/career-readiness/modules/cv-development/conversations")

        # THEN 409 CONFLICT is returned
        assert response.status_code == HTTPStatus.CONFLICT


class TestSendMessage:
    """Tests for POST /career-readiness/modules/{module_id}/conversations/{conversation_id}/messages."""

    def test_returns_201_on_success(self, client_with_mocks: TestClientWithMocks):
        client, _, _ = client_with_mocks

        # WHEN a message is sent
        response = client.post(
            "/career-readiness/modules/cv-development/conversations/conv123/messages",
            json={"user_input": "How do I write a CV?"},
        )

        # THEN 201 CREATED is returned
        assert response.status_code == HTTPStatus.CREATED

    def test_returns_404_when_conversation_not_found(self, client_with_mocks: TestClientWithMocks,
                                                       mocker: pytest_mock.MockerFixture):
        client, mock_service, _ = client_with_mocks

        # GIVEN the service raises ConversationNotFoundError
        mocker.patch.object(mock_service, "send_message", side_effect=ConversationNotFoundError("conv123"))

        # WHEN a message is sent
        response = client.post(
            "/career-readiness/modules/cv-development/conversations/conv123/messages",
            json={"user_input": "Hello"},
        )

        # THEN 404 is returned
        assert response.status_code == HTTPStatus.NOT_FOUND

    def test_returns_413_when_message_too_long(self, client_with_mocks: TestClientWithMocks):
        client, _, _ = client_with_mocks

        # GIVEN a message exceeding the maximum length
        given_long_message = "a" * (MAX_MESSAGE_LENGTH + 1)

        # WHEN the long message is sent
        response = client.post(
            "/career-readiness/modules/cv-development/conversations/conv123/messages",
            json={"user_input": given_long_message},
        )

        # THEN 413 REQUEST_ENTITY_TOO_LARGE is returned
        assert response.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE


class TestGetConversationHistory:
    """Tests for GET /career-readiness/modules/{module_id}/conversations/{conversation_id}/messages."""

    def test_returns_200_on_success(self, client_with_mocks: TestClientWithMocks):
        client, _, _ = client_with_mocks

        # WHEN the conversation history is requested
        response = client.get(
            "/career-readiness/modules/cv-development/conversations/conv123/messages",
        )

        # THEN 200 OK is returned
        assert response.status_code == HTTPStatus.OK

    def test_returns_404_when_not_found(self, client_with_mocks: TestClientWithMocks,
                                          mocker: pytest_mock.MockerFixture):
        client, mock_service, _ = client_with_mocks

        # GIVEN the service raises ConversationNotFoundError
        mocker.patch.object(mock_service, "get_conversation_history",
                            side_effect=ConversationNotFoundError("conv123"))

        # WHEN the conversation history is requested
        response = client.get(
            "/career-readiness/modules/cv-development/conversations/conv123/messages",
        )

        # THEN 404 is returned
        assert response.status_code == HTTPStatus.NOT_FOUND


class TestDeleteConversation:
    """Tests for DELETE /career-readiness/modules/{module_id}/conversations/{conversation_id}."""

    def test_returns_204_on_success(self, client_with_mocks: TestClientWithMocks):
        client, _, _ = client_with_mocks

        # WHEN a conversation is deleted
        response = client.delete(
            "/career-readiness/modules/cv-development/conversations/conv123",
        )

        # THEN 204 NO_CONTENT is returned
        assert response.status_code == HTTPStatus.NO_CONTENT

    def test_returns_404_when_not_found(self, client_with_mocks: TestClientWithMocks,
                                          mocker: pytest_mock.MockerFixture):
        client, mock_service, _ = client_with_mocks

        # GIVEN the service raises ConversationNotFoundError
        mocker.patch.object(mock_service, "delete_conversation",
                            side_effect=ConversationNotFoundError("conv123"))

        # WHEN the conversation is deleted
        response = client.delete(
            "/career-readiness/modules/cv-development/conversations/conv123",
        )

        # THEN 404 is returned
        assert response.status_code == HTTPStatus.NOT_FOUND

    def test_returns_403_when_access_denied(self, client_with_mocks: TestClientWithMocks,
                                              mocker: pytest_mock.MockerFixture):
        client, mock_service, _ = client_with_mocks

        # GIVEN the service raises ConversationAccessDeniedError
        mocker.patch.object(mock_service, "delete_conversation",
                            side_effect=ConversationAccessDeniedError("conv123", "other_user"))

        # WHEN the conversation is deleted
        response = client.delete(
            "/career-readiness/modules/cv-development/conversations/conv123",
        )

        # THEN 403 FORBIDDEN is returned
        assert response.status_code == HTTPStatus.FORBIDDEN


class TestGetQuiz:
    """Tests for GET /career-readiness/modules/{module_id}/conversations/{conversation_id}/quiz."""

    def test_returns_200_with_questions_and_no_correct_answer(self, client_with_mocks: TestClientWithMocks):
        client, _, _ = client_with_mocks

        # WHEN the quiz is requested
        response = client.get(
            "/career-readiness/modules/cv-development/conversations/conv123/quiz",
        )

        # THEN 200 OK is returned with quiz questions
        assert response.status_code == HTTPStatus.OK
        body = response.json()
        assert len(body["questions"]) == 1
        assert body["questions"][0]["question"] == "Q1?"
        # AND correct_answer is not present in the response
        assert "correct_answer" not in body["questions"][0]

    def test_returns_403_when_access_denied(self, client_with_mocks: TestClientWithMocks,
                                             mocker: pytest_mock.MockerFixture):
        client, mock_service, _ = client_with_mocks

        # GIVEN the service raises ConversationAccessDeniedError
        mocker.patch.object(mock_service, "get_quiz",
                            side_effect=ConversationAccessDeniedError("conv123", "other_user"))

        # WHEN the quiz is requested
        response = client.get(
            "/career-readiness/modules/cv-development/conversations/conv123/quiz",
        )

        # THEN 403 FORBIDDEN is returned
        assert response.status_code == HTTPStatus.FORBIDDEN

    def test_returns_409_when_not_available(self, client_with_mocks: TestClientWithMocks,
                                            mocker: pytest_mock.MockerFixture):
        client, mock_service, _ = client_with_mocks

        # GIVEN the service raises QuizNotAvailableError
        mocker.patch.object(mock_service, "get_quiz",
                            side_effect=QuizNotAvailableError("conv123"))

        # WHEN the quiz is requested
        response = client.get(
            "/career-readiness/modules/cv-development/conversations/conv123/quiz",
        )

        # THEN 409 CONFLICT is returned
        assert response.status_code == HTTPStatus.CONFLICT


class TestSubmitQuiz:
    """Tests for POST /career-readiness/modules/{module_id}/conversations/{conversation_id}/quiz."""

    def test_returns_200_on_success(self, client_with_mocks: TestClientWithMocks):
        client, _, _ = client_with_mocks

        # WHEN quiz answers are submitted
        response = client.post(
            "/career-readiness/modules/cv-development/conversations/conv123/quiz",
            json={"answers": {"1": "A"}},
        )

        # THEN 200 OK is returned with results
        assert response.status_code == HTTPStatus.OK
        body = response.json()
        assert body["passed"] is True
        assert body["score"] == 1

    def test_returns_403_when_access_denied(self, client_with_mocks: TestClientWithMocks,
                                             mocker: pytest_mock.MockerFixture):
        client, mock_service, _ = client_with_mocks

        # GIVEN the service raises ConversationAccessDeniedError
        mocker.patch.object(mock_service, "submit_quiz",
                            side_effect=ConversationAccessDeniedError("conv123", "other_user"))

        # WHEN quiz answers are submitted
        response = client.post(
            "/career-readiness/modules/cv-development/conversations/conv123/quiz",
            json={"answers": {"1": "A"}},
        )

        # THEN 403 FORBIDDEN is returned
        assert response.status_code == HTTPStatus.FORBIDDEN

    def test_returns_409_when_not_available(self, client_with_mocks: TestClientWithMocks,
                                            mocker: pytest_mock.MockerFixture):
        client, mock_service, _ = client_with_mocks

        # GIVEN the service raises QuizNotAvailableError
        mocker.patch.object(mock_service, "submit_quiz",
                            side_effect=QuizNotAvailableError("conv123"))

        # WHEN quiz answers are submitted
        response = client.post(
            "/career-readiness/modules/cv-development/conversations/conv123/quiz",
            json={"answers": {"1": "A"}},
        )

        # THEN 409 CONFLICT is returned
        assert response.status_code == HTTPStatus.CONFLICT

    def test_returns_409_when_already_passed(self, client_with_mocks: TestClientWithMocks,
                                              mocker: pytest_mock.MockerFixture):
        client, mock_service, _ = client_with_mocks

        # GIVEN the service raises QuizAlreadyPassedError
        mocker.patch.object(mock_service, "submit_quiz",
                            side_effect=QuizAlreadyPassedError("conv123"))

        # WHEN quiz answers are submitted
        response = client.post(
            "/career-readiness/modules/cv-development/conversations/conv123/quiz",
            json={"answers": {"1": "A"}},
        )

        # THEN 409 CONFLICT is returned
        assert response.status_code == HTTPStatus.CONFLICT
