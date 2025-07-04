from datetime import datetime
from http import HTTPStatus
from typing import Generator
from unittest.mock import AsyncMock

import pytest
import pytest_mock

from app.agent.experience import WorkType, Timeline
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.conversations.experience.routes import get_experience_service
from app.conversations.experience.service import IExperienceService
from app.conversations.experience.types import Skill, ExperienceResponse, EXPERIENCE_TITLE_MAX_LENGTH, COMPANY_MAX_LENGTH, LOCATION_MAX_LENGTH, \
    SUMMARY_MAX_LENGTH, SKILL_LABEL_MAX_LENGTH
from app.conversations.routes import add_experience_routes
from app.users.auth import UserInfo

from fastapi.testclient import TestClient
from fastapi import FastAPI, APIRouter

from app.users.get_user_preferences_repository import get_user_preferences_repository
from app.users.repositories import IUserPreferenceRepository
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement
from app.users.types import UserPreferencesRepositoryUpdateRequest, UserPreferences
from common_libs.test_utilities import get_random_session_id
from common_libs.test_utilities.mock_auth import MockAuth, UnauthenticatedMockAuth

TestClientWithMocks = tuple[TestClient, IExperienceService, IUserPreferenceRepository, UserInfo | None]


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

    # mock the conversation service
    class MockExperienceService(IExperienceService):
        async def send(self, user_id: str, session_id: int, user_input: str, clear_memory: bool, filter_pii: bool):
            raise NotImplementedError

        async def get_history_by_session_id(self, user_id: str, session_id: int):
            raise NotImplementedError

        async def get_experiences_by_session_id(self, session_id: int):
            raise NotImplementedError

        async def update_experience(self, user_id: str, session_id: int, experience_uuid: str, update_payload):
            raise NotImplementedError

        async def delete_experience(self, user_id: str, session_id: int, experience_uuid: str):
            raise NotImplementedError

        async def get_unedited_experience_by_uuid(self, session_id: int, experience_uuid: str):
            raise NotImplementedError

        async def get_unedited_experiences(self, session_id: int):
            raise NotImplementedError

        async def restore_deleted_experience(self, user_id: str, session_id: int, experience_uuid: str) -> ExperienceResponse:
            raise NotImplementedError

    _instance_experience_service = MockExperienceService()

    def _mocked_experience_service() -> IExperienceService:
        return _instance_experience_service

    class MockUserPreferencesRepository(IUserPreferenceRepository):
        async def get_user_preference_by_user_id(self, user_id):
            raise NotImplementedError

        async def insert_user_preference(self, user_id: str, user_preference: UserPreferences):
            raise NotImplementedError

        async def update_user_preference(self, user_id: str, update: UserPreferencesRepositoryUpdateRequest):
            raise NotImplementedError

        async def get_experiments_by_user_id(self, user_id: str) -> dict[str, str]:
            raise NotImplementedError

        async def get_experiments_by_user_ids(self, user_ids: list[str]) -> dict[str, dict[str, str]]:
            raise NotImplementedError()

        async def set_experiment_by_user_id(self, user_id: str, experiment_id: str, experiment_class: str) -> None:
            raise NotImplementedError()

    _instance_user_preferences_repository = MockUserPreferencesRepository()

    def get_mock_user_preferences_repository():
        return _instance_user_preferences_repository

    # Set up the FastAPI app with the mocked dependencies
    app = FastAPI()

    # Set up the app dependency overrides
    app.dependency_overrides[get_experience_service] = _mocked_experience_service
    app.dependency_overrides[get_user_preferences_repository] = get_mock_user_preferences_repository

    conversation_router = APIRouter(
        prefix="/conversations/{session_id}",
        tags=["conversations"]
    )

    # Add the reaction routes to the conversations router
    add_experience_routes(conversation_router, auth)
    app.include_router(conversation_router)

    # Create a test client
    client = TestClient(app)

    return client, _instance_experience_service, _instance_user_preferences_repository, auth.mocked_user


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


class TestExperienceRoutes:
    class TestGetExperienceRoutes:
        """
        Tests for the Experience Routes
        """

        @pytest.mark.asyncio
        @pytest.mark.parametrize("unedited",
                                 [True, False],
                                 ids=["unedited", "processed"])
        async def test_get_experiences_successful(self, authenticated_client_with_mocks: TestClientWithMocks,
                                                  mocker: pytest_mock.MockerFixture, unedited: bool):
            client, mocked_service, mocked_preferences_repository, mocked_user = authenticated_client_with_mocks
            # GIVEN a valid session id
            given_session_id = get_random_session_id()

            # AND mock the repository and service responses
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(given_session_id))
            preferences_spy = mocker.spy(mocked_preferences_repository, "get_user_preference_by_user_id")

            # AND an ExperienceService that will return a list of experiences
            expected_response = [
                ExperienceResponse(
                    uuid="foo_uuid",
                    experience_title="Foo Bar",
                    company="Foo Company",
                    location="Foo Location",
                    timeline=Timeline(start="2020-01-01", end="2021-01-01"),
                    work_type=WorkType.SELF_EMPLOYMENT,
                    top_skills=[
                        Skill(
                            UUID="bar_uuid",
                            preferredLabel="Baz",
                            description="Foo bar baz",
                            altLabels=["foo_label_1", "bar_label_2"]
                        )
                    ],
                    exploration_phase=DiveInPhase.PROCESSED.name,
                    summary="Foo summary"
                )
            ]

            if unedited:
                mocked_service.get_unedited_experiences = AsyncMock(return_value=expected_response)
                service_spy = mocker.spy(mocked_service, "get_unedited_experiences")
            else:
                mocked_service.get_experiences_by_session_id = AsyncMock(return_value=expected_response)
                service_spy = mocker.spy(mocked_service, "get_experiences_by_session_id")

            # WHEN a GET request where the session_id is in the Path
            response = client.get(f"/conversations/{given_session_id}/experiences?unedited={unedited}")

            # THEN the response is OK
            assert response.status_code == HTTPStatus.OK

            # AND the response matches the expected response
            assert response.json() == [exp.model_dump(by_alias=True, mode="json") for exp in expected_response]

            # AND the user preferences repository was called with the correct user_id
            preferences_spy.assert_called_once_with(mocked_user.user_id)

            # AND the experience service was called with the correct arguments
            service_spy.assert_called_once_with(
                given_session_id
            )

        @pytest.mark.asyncio
        @pytest.mark.parametrize("unedited",
                                 [True, False],
                                 ids=["unedited", "processed"])
        async def test_get_experiences_unauthorized(self, unauthenticated_client_with_mocks: TestClientWithMocks, unedited: bool):
            client, _, _, _ = unauthenticated_client_with_mocks
            # GIVEN a session id
            given_session_id = get_random_session_id()

            # WHEN a GET request is made without authentication
            response = client.get(f"/conversations/{given_session_id}/experiences?unedited={unedited}")

            # THEN the response is UNAUTHORIZED
            assert response.status_code == HTTPStatus.UNAUTHORIZED

        @pytest.mark.asyncio
        @pytest.mark.parametrize("unedited",
                                 [True, False],
                                 ids=["unedited", "processed"])
        async def test_get_experiences_forbidden(self, authenticated_client_with_mocks: TestClientWithMocks, unedited: bool):
            client, _, mocked_preferences_repository, mocked_user = authenticated_client_with_mocks
            # GIVEN a valid session id
            given_session_id = get_random_session_id()

            # AND the user doesn't have the given session_id in their sessions array
            mock_user_preferences = get_mock_user_preferences(given_session_id)
            mock_user_preferences.sessions = [given_session_id - 1]  # sessions doesnt include the given session id
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(
                return_value=mock_user_preferences)

            # WHEN a GET request where the session_id is in the Path
            response = client.get(f"/conversations/{given_session_id}/experiences?unedited={unedited}")

            # THEN the response is FORBIDDEN
            assert response.status_code == HTTPStatus.FORBIDDEN

            # AND the user preferences repository was called with the correct user_id
            mocked_preferences_repository.get_user_preference_by_user_id.assert_called_once_with(mocked_user.user_id)

        @pytest.mark.asyncio
        async def test_get_experiences_service_internal_server_error(self,
                                                                     authenticated_client_with_mocks: TestClientWithMocks,
                                                                     mocker: pytest_mock.MockerFixture):
            client, mocked_service, mocked_preferences_repository, _ = authenticated_client_with_mocks
            # GIVEN a valid session id
            given_session_id = get_random_session_id()

            # AND an ExperienceService that will raise an unexpected error
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(given_session_id))
            get_experiences_spy = mocker.spy(mocked_service, "get_experiences_by_session_id")
            get_experiences_spy.side_effect = Exception("Unexpected error")

            # WHEN a GET request where the session_id is in the Path
            response = client.get(f"/conversations/{given_session_id}/experiences/?unedited=False")

            # THEN the response is INTERNAL_SERVER_ERROR
            assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

            # AND the experiences service was called with the correct arguments
            get_experiences_spy.assert_called_once_with(
                given_session_id
            )

        @pytest.mark.asyncio
        async def test_get_unedited_experiences_service_internal_server_error(self,
                                                                              authenticated_client_with_mocks: TestClientWithMocks,
                                                                              mocker: pytest_mock.MockerFixture):
            client, mocked_service, mocked_preferences_repository, _ = authenticated_client_with_mocks
            # GIVEN a valid session id
            given_session_id = get_random_session_id()

            # AND an ExperienceService that will raise an unexpected error
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(given_session_id))
            get_unedited_experiences_spy = mocker.spy(mocked_service, "get_unedited_experiences")
            get_unedited_experiences_spy.side_effect = Exception("Unexpected error")

            # WHEN a GET request where the session_id is in the Path
            response = client.get(f"/conversations/{given_session_id}/experiences/?unedited=True")

            # THEN the response is INTERNAL_SERVER_ERROR
            assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

            # AND the experiences service was called with the correct arguments
            get_unedited_experiences_spy.assert_called_once_with(
                given_session_id
            )

        @pytest.mark.asyncio
        @pytest.mark.parametrize("unedited",
                                 [True, False],
                                 ids=["unedited", "processed"])
        async def test_get_experiences_user_preferences_internal_server_error(self,
                                                                              authenticated_client_with_mocks: TestClientWithMocks,
                                                                              mocker: pytest_mock.MockerFixture, unedited: bool):
            client, _, mocked_preferences_repository, mocked_user = authenticated_client_with_mocks
            # GIVEN a valid session id
            given_session_id = get_random_session_id()

            # AND a UserPreferencesRepository that will raise an unexpected error
            get_user_preferences_spy = mocker.spy(mocked_preferences_repository, "get_user_preference_by_user_id")
            get_user_preferences_spy.side_effect = Exception("Unexpected error")

            # WHEN a GET request where the session_id is in the Path
            response = client.get(f"/conversations/{given_session_id}/experiences?unedited={unedited}")

            # THEN the response is INTERNAL_SERVER_ERROR
            assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

            # AND the user preferences repository was called with the correct user_id
            get_user_preferences_spy.assert_called_once_with(mocked_user.user_id)

    class TestUpdateExperienceRoutes:
        """
        Tests for the Experience Update Routes
        """

        @pytest.mark.asyncio
        async def test_update_experience_successful(self, authenticated_client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
            client, mocked_service, mocked_preferences_repository, mocked_user = authenticated_client_with_mocks
            # GIVEN a payload to update an experience
            given_update_payload = {"experience_title": "new title"}
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND the user owns the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))
            preferences_spy = mocker.spy(mocked_preferences_repository, "get_user_preference_by_user_id")
            # AND the service returns the updated experience
            expected_response = ExperienceResponse(
                uuid=given_experience_uuid,
                experience_title="new title",
                company="company",
                location="location",
                timeline=Timeline(start="2020", end="2021"),
                work_type=WorkType.SELF_EMPLOYMENT,
                top_skills=[],
                summary="summary",
                exploration_phase="PROCESSED"
            )
            mocked_service.update_experience = AsyncMock(return_value=expected_response)
            service_spy = mocker.spy(mocked_service, "update_experience")
            # WHEN the PATCH request is made
            response = client.patch(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}", json=given_update_payload)
            # THEN the response is OK
            assert response.status_code == HTTPStatus.OK
            # AND the response matches the expected experience
            assert response.json() == expected_response.model_dump(by_alias=True)
            # AND the user preferences repository was called with the correct user_id
            preferences_spy.assert_called_once_with(mocked_user.user_id)
            # AND the experience service was called with the correct arguments
            service_spy.assert_called_once()
            assert service_spy.call_args.args[1] == given_session_id
            assert service_spy.call_args.args[2] == given_experience_uuid
            assert service_spy.call_args.args[3].model_dump(exclude_unset=True) == given_update_payload

        @pytest.mark.asyncio
        async def test_update_experience_forbidden(self, authenticated_client_with_mocks: TestClientWithMocks):
            client, _, mocked_preferences_repository, _ = authenticated_client_with_mocks
            # GIVEN a payload to update an experience
            given_update_payload = {"experience_title": "new title"}
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND the user does NOT own the session
            mock_user_preferences = get_mock_user_preferences(given_session_id)
            mock_user_preferences.sessions = [given_session_id - 1]  # not the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=mock_user_preferences)
            # WHEN the PATCH request is made
            response = client.patch(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}", json=given_update_payload)
            # THEN the response is FORBIDDEN
            assert response.status_code == HTTPStatus.FORBIDDEN

        @pytest.mark.asyncio
        async def test_update_experience_not_found(self, authenticated_client_with_mocks: TestClientWithMocks):
            client, mocked_service, mocked_preferences_repository, _ = authenticated_client_with_mocks
            # GIVEN a payload to update an experience
            given_update_payload = {"experience_title": "new title"}
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND the user owns the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))
            # AND the service raises ExperienceNotFoundError
            from app.conversations.experience.service import ExperienceNotFoundError
            mocked_service.update_experience = AsyncMock(side_effect=ExperienceNotFoundError(given_experience_uuid))
            # WHEN the PATCH request is made
            response = client.patch(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}", json=given_update_payload)
            # THEN the response is NOT_FOUND
            assert response.status_code == HTTPStatus.NOT_FOUND

        @pytest.mark.asyncio
        async def test_update_experience_unauthorized(self, unauthenticated_client_with_mocks: TestClientWithMocks):
            client, _, _, _ = unauthenticated_client_with_mocks
            # GIVEN a payload to update an experience
            given_update_payload = {"experience_title": "new title"}
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # WHEN the PATCH request is made without authentication
            response = client.patch(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}", json=given_update_payload)
            # THEN the response is UNAUTHORIZED
            assert response.status_code == HTTPStatus.UNAUTHORIZED

        @pytest.mark.asyncio
        async def test_update_experience_invalid_payload(self, authenticated_client_with_mocks: TestClientWithMocks):
            client, _, _, _ = authenticated_client_with_mocks
            # GIVEN an invalid payload
            given_update_payload = {"foo": "bar"}  # not a valid field
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # WHEN the PATCH request is made
            response = client.patch(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}", json=given_update_payload)
            # THEN the response is UNPROCESSABLE_ENTITY
            assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

        @pytest.mark.asyncio
        async def test_update_experience_internal_server_error(self, authenticated_client_with_mocks: TestClientWithMocks):
            client, mocked_service, mocked_preferences_repository, _ = authenticated_client_with_mocks
            # GIVEN a payload to update an experience
            given_update_payload = {"experience_title": "new title"}
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND the user owns the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))
            # AND the service raises a generic error
            mocked_service.update_experience = AsyncMock(side_effect=Exception("Unexpected error"))
            # WHEN the PATCH request is made
            response = client.patch(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}", json=given_update_payload)
            # THEN the response is INTERNAL_SERVER_ERROR
            assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

        @pytest.mark.asyncio
        async def test_update_experience_field_too_long(self, authenticated_client_with_mocks: TestClientWithMocks):
            client, _, mocked_preferences_repository, _ = authenticated_client_with_mocks
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND the user owns the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))
            # GIVEN a payload with fields that exceed max length
            too_long_title = "x" * (EXPERIENCE_TITLE_MAX_LENGTH + 1)
            too_long_company = "y" * (COMPANY_MAX_LENGTH + 1)
            too_long_location = "z" * (LOCATION_MAX_LENGTH + 1)
            too_long_summary = "s" * (SUMMARY_MAX_LENGTH + 1)
            too_long_skill_label = "l" * (SKILL_LABEL_MAX_LENGTH + 1)
            given_update_payload = {
                "experience_title": too_long_title,
                "company": too_long_company,
                "location": too_long_location,
                "summary": too_long_summary,
                "top_skills": [{"UUID": "skill-uuid-1", "preferredLabel": too_long_skill_label}]
            }
            # WHEN the PATCH request is made
            response = client.patch(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}", json=given_update_payload)
            # THEN the response is 422 Unprocessable Entity
            assert response.status_code == 422
            # AND the error message mentions the correct fields
            error_json = response.json()
            error_fields = [err["loc"][-1] for err in error_json.get("detail", [])]
            assert "experience_title" in error_fields
            assert "company" in error_fields
            assert "location" in error_fields
            assert "summary" in error_fields
            assert "preferredLabel" in error_fields

    class TestDeleteExperience:
        @pytest.mark.asyncio
        async def test_delete_experience_successful(self, authenticated_client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
            client, mocked_service, mocked_preferences_repository, mocked_user = authenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = 123
            given_experience_uuid = "exp-uuid"
            # AND the user owns the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))
            preferences_spy = mocker.spy(mocked_preferences_repository, "get_user_preference_by_user_id")
            # AND the service confirms deletion
            mocked_service.delete_experience = AsyncMock(return_value=None)
            service_spy = mocker.spy(mocked_service, "delete_experience")

            # WHEN the DELETE request is made
            response = client.delete(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}")

            # THEN the response is NO CONTENT
            assert response.status_code == HTTPStatus.NO_CONTENT
            # AND the user preferences repository was called with the correct user_id
            preferences_spy.assert_called_once_with(mocked_user.user_id)
            # AND the conversation service was called with the correct arguments
            service_spy.assert_called_once_with(
                mocked_user.user_id,
                given_session_id,
                given_experience_uuid
            )

        @pytest.mark.asyncio
        async def test_delete_experience_forbidden(self, authenticated_client_with_mocks: TestClientWithMocks):
            client, _, mocked_preferences_repository, _ = authenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = 123
            given_experience_uuid = "exp-uuid"
            # AND the user does NOT own the session
            mock_user_preferences = get_mock_user_preferences(given_session_id)
            mock_user_preferences.sessions = [999]  # not the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=mock_user_preferences)

            # WHEN the DELETE request is made
            response = client.delete(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}")

            # THEN the response is FORBIDDEN
            assert response.status_code == HTTPStatus.FORBIDDEN

        @pytest.mark.asyncio
        async def test_delete_experience_not_found(self, authenticated_client_with_mocks: TestClientWithMocks):
            client, mocked_service, mocked_preferences_repository, _ = authenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = 123
            given_experience_uuid = "exp-uuid"
            # AND the user owns the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))
            # AND the service raises ExperienceNotFoundError
            from app.conversations.experience.service import ExperienceNotFoundError
            mocked_service.delete_experience = AsyncMock(side_effect=ExperienceNotFoundError(given_experience_uuid))

            # WHEN the DELETE request is made
            response = client.delete(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}")

            # THEN the response is NOT_FOUND
            assert response.status_code == HTTPStatus.NOT_FOUND
            # AND the error message contains the experience uuid
            assert response.json() == {"detail": f"Experience with uuid {given_experience_uuid} not found"}

        @pytest.mark.asyncio
        async def test_delete_experience_internal_server_error(self, authenticated_client_with_mocks: TestClientWithMocks):
            client, mocked_service, mocked_preferences_repository, _ = authenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = 123
            given_experience_uuid = "exp-uuid"
            # AND the user owns the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))
            # AND the service raises a generic error
            mocked_service.delete_experience = AsyncMock(side_effect=Exception("Unexpected error"))

            # WHEN the DELETE request is made
            response = client.delete(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}")

            # THEN the response is INTERNAL_SERVER_ERROR
            assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

    class TestGetUneditedExperience:
        """
        Tests for the Get Unedited Experience by uuid Route
        """

        @pytest.mark.asyncio
        async def test_get_unedited_experience_successful(self, authenticated_client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
            client, mocked_service, mocked_preferences_repository, mocked_user = authenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND the user owns the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))
            preferences_spy = mocker.spy(mocked_preferences_repository, "get_user_preference_by_user_id")
            # AND the service returns the unedited experience
            expected_response = ExperienceResponse(
                uuid=given_experience_uuid,
                experience_title="Unedited Title",
                company="Unedited Company",
                location="Unedited Location",
                timeline=Timeline(start="2020", end="2021"),
                work_type=WorkType.SELF_EMPLOYMENT,
                top_skills=[],
                summary="Unedited summary",
                exploration_phase=DiveInPhase.PROCESSED.name
            )
            mocked_service.get_unedited_experience_by_uuid = AsyncMock(return_value=expected_response)
            service_spy = mocker.spy(mocked_service, "get_unedited_experience_by_uuid")
            # WHEN the GET request is made
            response = client.get(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}/unedited")
            # THEN the response is OK
            assert response.status_code == HTTPStatus.OK
            # AND the response matches the expected experience
            assert response.json() == expected_response.model_dump(by_alias=True)
            # AND the user preferences repository was called with the correct user_id
            preferences_spy.assert_called_once_with(mocked_user.user_id)
            # AND the experience service was called with the correct arguments
            service_spy.assert_called_once_with(
                given_session_id,
                given_experience_uuid
            )

        @pytest.mark.asyncio
        async def test_get_unedited_experience_forbidden(self, authenticated_client_with_mocks: TestClientWithMocks):
            client, _, mocked_preferences_repository, mocked_user = authenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND the user does NOT own the session
            mock_user_preferences = get_mock_user_preferences(given_session_id)
            mock_user_preferences.sessions = [given_session_id - 1]
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=mock_user_preferences)
            # WHEN the GET request is made
            response = client.get(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}/unedited")
            # THEN the response is FORBIDDEN
            assert response.status_code == HTTPStatus.FORBIDDEN
            # AND the user preferences repository was called with the correct user_id
            mocked_preferences_repository.get_user_preference_by_user_id.assert_called_once_with(mocked_user.user_id)

        @pytest.mark.asyncio
        async def test_get_unedited_experience_not_found(self, authenticated_client_with_mocks: TestClientWithMocks):
            client, mocked_service, mocked_preferences_repository, _ = authenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND the user owns the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))
            # AND the service raises ExperienceNotFoundError
            from app.conversations.experience.service import ExperienceNotFoundError
            mocked_service.get_unedited_experience_by_uuid = AsyncMock(side_effect=ExperienceNotFoundError(given_experience_uuid))
            # WHEN the GET request is made
            response = client.get(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}/unedited")
            # THEN the response is NOT_FOUND
            assert response.status_code == HTTPStatus.NOT_FOUND
            # AND the service was called with the correct arguments
            mocked_service.get_unedited_experience_by_uuid.assert_called_once_with(
                given_session_id,
                given_experience_uuid
            )

        @pytest.mark.asyncio
        async def test_get_unedited_experience_unauthorized(self, unauthenticated_client_with_mocks: TestClientWithMocks):
            client, _, _, _ = unauthenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # WHEN the GET request is made without authentication
            response = client.get(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}/unedited")
            # THEN the response is UNAUTHORIZED
            assert response.status_code == HTTPStatus.UNAUTHORIZED

        @pytest.mark.asyncio
        async def test_get_unedited_experience_service_internal_server_error(self, authenticated_client_with_mocks: TestClientWithMocks,
                                                                             mocker: pytest_mock.MockerFixture):
            client, mocked_service, mocked_preferences_repository, _ = authenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND the user owns the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))
            # AND the service raises an unexpected error
            mocked_service.get_unedited_experience_by_uuid = AsyncMock(side_effect=Exception("Unexpected error"))
            # WHEN the GET request is made
            response = client.get(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}/unedited")
            # THEN the response is INTERNAL_SERVER_ERROR
            assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
            # AND the service was called with the correct arguments
            mocked_service.get_unedited_experience_by_uuid.assert_called_once_with(
                given_session_id,
                given_experience_uuid
            )

        @pytest.mark.asyncio
        async def test_get_unedited_experience_user_preferences_internal_server_error(self, authenticated_client_with_mocks: TestClientWithMocks,
                                                                                      mocker: pytest_mock.MockerFixture):
            client, _, mocked_preferences_repository, mocked_user = authenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND a UserPreferencesRepository that will raise an unexpected error
            get_user_preferences_spy = mocker.spy(mocked_preferences_repository, "get_user_preference_by_user_id")
            get_user_preferences_spy.side_effect = Exception("Unexpected error")
            # WHEN the GET request is made
            response = client.get(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}/unedited")
            # THEN the response is INTERNAL_SERVER_ERROR
            assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
            # AND the user preferences repository was called with the correct user_id
            get_user_preferences_spy.assert_called_once_with(mocked_user.user_id)

    class RestoreDeletedExperience:
        """
        Tests for the Restore Deleted Experience Route
        """

        @pytest.mark.asyncio
        async def test_restore_deleted_experience_successful(self, authenticated_client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
            client, mocked_service, mocked_preferences_repository, mocked_user = authenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND the user owns the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))
            preferences_spy = mocker.spy(mocked_preferences_repository, "get_user_preference_by_user_id")
            # AND the service confirms restoration
            mocked_service.restore_deleted_experience = AsyncMock(return_value=None)
            service_spy = mocker.spy(mocked_service, "restore_deleted_experience")
            # WHEN the POST request is made to restore the deleted experience
            response = client.post(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}/restore")
            # THEN the response is NO CONTENT
            assert response.status_code == HTTPStatus.NO_CONTENT
            # AND the user preferences repository was called with the correct user_id
            preferences_spy.assert_called_once_with(mocked_user.user_id)
            # AND the experience service was called with the correct arguments
            service_spy.assert_called_once_with(
                mocked_user.user_id,
                given_session_id,
                given_experience_uuid
            )

        @pytest.mark.asyncio
        async def test_restore_deleted_experience_forbidden(self, authenticated_client_with_mocks: TestClientWithMocks):
            client, _, mocked_preferences_repository, mocked_user = authenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND the user does NOT own the session
            mock_user_preferences = get_mock_user_preferences(given_session_id)
            mock_user_preferences.sessions = [given_session_id - 1]  # not the session"""
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=mock_user_preferences)
            # WHEN the POST request is made to restore the deleted experience
            response = client.post(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}/restore")
            # THEN the response is FORBIDDEN
            assert response.status_code == HTTPStatus.FORBIDDEN
            # AND the user preferences repository was called with the correct user_id
            mocked_preferences_repository.get_user_preference_by_user_id.assert_called_once_with(mocked_user.user_id)

        @pytest.mark.asyncio
        async def test_restore_deleted_experience_not_found(self, authenticated_client_with_mocks: TestClientWithMocks):
            client, mocked_service, mocked_preferences_repository, _ = authenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND the user owns the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))
            # AND the service raises ExperienceNotFoundError
            from app.conversations.experience.service import ExperienceNotFoundError
            mocked_service.restore_deleted_experience = AsyncMock(side_effect=ExperienceNotFoundError(given_experience_uuid))
            # WHEN the POST request is made to restore the deleted experience
            response = client.post(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}/restore")
            # THEN the response is NOT_FOUND
            assert response.status_code == HTTPStatus.NOT_FOUND
            # AND the error message contains the experience uuid
            assert response.json() == {"detail": f"Experience with uuid {given_experience_uuid} not found"}

        @pytest.mark.asyncio
        async def test_restore_deleted_experience_internal_server_error(self, authenticated_client_with_mocks: TestClientWithMocks):
            client, mocked_service, mocked_preferences_repository, _ = authenticated_client_with_mocks
            # GIVEN a valid session id and experience uuid
            given_session_id = get_random_session_id()
            given_experience_uuid = "exp-uuid"
            # AND the user owns the session
            mocked_preferences_repository.get_user_preference_by_user_id = AsyncMock(return_value=get_mock_user_preferences(given_session_id))
            # AND the service raises a generic error
            mocked_service.restore_deleted_experience = AsyncMock(side_effect=Exception("Unexpected error"))
            # WHEN the POST request is made to restore the deleted experience
            response = client.post(f"/conversations/{given_session_id}/experiences/{given_experience_uuid}/restore")
            # THEN the response is INTERNAL_SERVER_ERROR
            assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

