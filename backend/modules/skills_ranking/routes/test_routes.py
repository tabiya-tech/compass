from datetime import datetime
from http import HTTPStatus
from typing import Generator
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.app_config import ApplicationConfig
from app.users.auth import UserInfo
from app.users.get_user_preferences_repository import get_user_preferences_repository
from app.users.repositories import IUserPreferenceRepository
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement
from app.users.types import UserPreferences, UserPreferencesRepositoryUpdateRequest
from common_libs.test_utilities.mock_auth import MockAuth
from modules.skills_ranking.constants import FEATURE_ID
from modules.skills_ranking.errors import SkillsRankingStateNotFound
from modules.skills_ranking.repository.get_skills_ranking_repository import get_skills_ranking_repository
from modules.skills_ranking.repository.repository import ISkillsRankingRepository
from modules.skills_ranking.routes.routes import get_skills_ranking_router
from modules.skills_ranking.routes.types import GetRankingResponse
from modules.skills_ranking.service.get_skills_ranking_service import get_skills_ranking_service
from modules.skills_ranking.service.service import ISkillsRankingService
from modules.skills_ranking.service.types import SkillsRankingState, SkillsRankingPhase, SkillRankingExperimentGroups


def get_mock_user_preferences(session_id: int, experiments: dict[str, str] = None):
    if experiments is None:
        experiments = {}
    return UserPreferences(
        language="en",
        invitation_code="foo",
        accepted_tc=datetime.now(),
        sessions=[session_id],  # mock a user that owns the given session
        sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_REQUIRED,
        experiments=experiments
    )


def get_skills_ranking_state(
        session_id: int = 1,
        phase: SkillsRankingPhase = SkillsRankingPhase.INITIAL,
        experiment_groups: SkillRankingExperimentGroups = SkillRankingExperimentGroups(
            compare_against="against_other_job_seekers",
            button_order="skip_button_first",
            delayed_results=False
        ),
        ranking: str | None = None,
        self_ranking: str | None = None
) -> SkillsRankingState:
    return SkillsRankingState(
        session_id=session_id,
        phase=phase,
        experiment_groups=experiment_groups,
        ranking=ranking,
        self_ranking=self_ranking
    )

TestClientWithMocks = tuple[
    TestClient, ISkillsRankingService, ISkillsRankingRepository, IUserPreferenceRepository, UserInfo | None]


def _create_test_client_with_mocks() -> TestClientWithMocks:
    """
    Factory function to create a test client with mocked dependencies
    """

    # Mock the skills ranking service
    class MockedSkillsRankingService(ISkillsRankingService):
        async def upsert_state(self, state: SkillsRankingState) -> SkillsRankingState:
            raise NotImplementedError()

        async def get_by_session_id(self, session_id: int) -> SkillsRankingState | None:
            raise NotImplementedError()

        async def get_ranking(self, session_id: int) -> str:
            raise NotImplementedError()

    mocked_service = MockedSkillsRankingService()

    # Mock the user preferences repository
    class MockedUserPreferencesRepository(IUserPreferenceRepository):
        async def get_experiments_by_user_id(self, user_id: str) -> dict[str, str]:
            raise NotImplementedError()

        async def get_experiments_by_user_ids(self, user_ids: list[str]) -> dict[str, dict[str, str]]:
            raise NotImplementedError()

        async def set_experiment_by_user_id(self, user_id: str, experiment_id: str, experiment_config: dict) -> None:
            raise NotImplementedError()

        async def get_user_preference_by_user_id(self, user_id: str) -> UserPreferences:
            raise NotImplementedError()

        async def update_user_preference(self, user_id: str,
                                         request: UserPreferencesRepositoryUpdateRequest) -> UserPreferences:
            raise NotImplementedError()

        async def insert_user_preference(self, user_id: str, user_preference: UserPreferences) -> UserPreferences:
            raise NotImplementedError()

    mocked_user_preferences_repository = MockedUserPreferencesRepository()

    # Mock the skills ranking repository
    class MockedSkillsRankingRepository(ISkillsRankingRepository):
        async def get_by_session_id(self, session_id: int) -> SkillsRankingState | None:
            raise NotImplementedError()

        async def create(self, state: SkillsRankingState) -> SkillsRankingState:
            raise NotImplementedError()

        async def update(self, *, session_id: int, experiment_groups: SkillRankingExperimentGroups | None = None, phase: SkillsRankingPhase | None = None, ranking: str | None = None,
                         self_ranking: str | None = None) -> SkillsRankingState:
            raise NotImplementedError()

    mocked_skills_ranking_repository = MockedSkillsRankingRepository()

    # Set up the FastAPI app with the mocked dependencies
    app = FastAPI()
    auth = MockAuth()

    # Add the skills ranking routes to the app
    skills_ranking_router = get_skills_ranking_router(auth)
    app.include_router(skills_ranking_router)

    # Create a test client
    client = TestClient(app)
    # Set up the app dependency override
    app.dependency_overrides = {}

    app.dependency_overrides[get_user_preferences_repository] = lambda: mocked_user_preferences_repository
    app.dependency_overrides[get_skills_ranking_repository] = lambda: mocked_skills_ranking_repository
    app.dependency_overrides[get_skills_ranking_service] = lambda: mocked_service

    return client, mocked_service, mocked_skills_ranking_repository, mocked_user_preferences_repository, auth.mocked_user


@pytest.fixture(scope='function')
def client_with_mocks() -> Generator[TestClientWithMocks, None, None]:
    """
    Returns a test client with authenticated mock auth
    """
    client, service, repository, preferences, user = _create_test_client_with_mocks()
    yield client, service, repository, preferences, user
    client.app.dependency_overrides = {}


class TestSkillsRankingRoutes:
    class TestGetSkillsRankingState:
        @pytest.mark.asyncio
        async def test_get_skills_ranking_state_success(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, _, mocked_skills_ranking_repository, mocked_preferences, _ = client_with_mocks
            # GIVEN a skills ranking state
            given_state = get_skills_ranking_state()

            # AND the user has a valid session with the correct experiment groups
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(given_state.session_id, {FEATURE_ID: given_state.experiment_groups.model_dump()}))

            # AND the repository's get_by_session_id method will return the state
            mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=given_state)

            # WHEN a GET request is made
            response = client.get(f"/conversations/{given_state.session_id}/skills-ranking/state")

            # THEN the response is OK
            assert response.status_code == HTTPStatus.OK
            # AND the response contains the state
            assert response.json() == {
                "session_id": given_state.session_id,
                "phase": given_state.phase.value,
                "experiment_groups": given_state.experiment_groups.model_dump(),
                "ranking": given_state.ranking,
                "self_ranking": given_state.self_ranking
            }

        @pytest.mark.asyncio
        async def test_get_skills_ranking_state_not_found(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, _, mocked_skills_ranking_repository, mocked_preferences, _ = client_with_mocks
            # GIVEN a session id
            session_id = 1
            # AND the user has a valid session
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(session_id, {}))
            # AND the repository's get_by_session_id method will return None (no state)
            mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=None)

            # WHEN a GET request is made
            response = client.get(f"/conversations/{session_id}/skills-ranking/state")

            # THEN the response is OK with null
            assert response.status_code == HTTPStatus.OK
            assert response.json() is None

    class TestUpsertSkillsRankingState:
        @pytest.mark.asyncio
        async def test_upsert_skills_ranking_state_create_success_initial(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, mocked_service, mocked_skills_ranking_repository, mocked_preferences, mocked_user = client_with_mocks
            session_id = 1
            # GIVEN no existing state
            mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=None)
            # AND the user has a valid session with no experiments
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(session_id, {}))
            # AND preferences set_experiment_by_user_id will succeed
            mocked_preferences.set_experiment_by_user_id = AsyncMock(return_value=None)
            # AND the service upsert_state will succeed
            created_state = get_skills_ranking_state(session_id=session_id)
            mocked_service.upsert_state = AsyncMock(return_value=created_state)

            # WHEN a POST request is made with INITIAL phase
            response = client.post(f"/conversations/{session_id}/skills-ranking/state", json={
                "phase": "INITIAL",
                "self_ranking": None
            })

            # THEN the response is ACCEPTED
            assert response.status_code == HTTPStatus.ACCEPTED
            # AND the service upsert_state is called with the correct arguments
            mocked_service.upsert_state.assert_called_once_with(
                session_id=session_id,
                user_id=mocked_user.user_id,
                phase=SkillsRankingPhase.INITIAL,
            )
            # AND the response contains the created state
            assert response.json()["session_id"] == session_id
            assert response.json()["phase"] == "INITIAL"

        @pytest.mark.asyncio
        async def test_upsert_skills_ranking_state_create_error_non_initial(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, mocked_service, mocked_skills_ranking_repository, mocked_preferences, _ = client_with_mocks
            session_id = 1
            # GIVEN no existing state
            mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=None)
            # AND the user has a valid session
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(session_id, {}))
            # AND preferences set_experiment_by_user_id should not be called
            mocked_preferences.set_experiment_by_user_id = AsyncMock()
            # AND the service upsert_state should not be called
            mocked_service.upsert_state = AsyncMock()

            # WHEN a POST request is made with non-INITIAL phase
            response = client.post(f"/conversations/{session_id}/skills-ranking/state", json={
                "phase": "SELF_EVALUATING",
                "self_ranking": None
            })

            # THEN the response is BAD_REQUEST
            assert response.status_code == HTTPStatus.BAD_REQUEST
            assert response.json()["detail"] == "Skills ranking state not found"
            # AND preferences set_experiment_by_user_id is not called
            mocked_preferences.set_experiment_by_user_id.assert_not_called()
            # AND the service upsert_state is not called
            mocked_service.upsert_state.assert_not_called()

        @pytest.mark.asyncio
        async def test_upsert_skills_ranking_state_upsert_existing(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, mocked_service, mocked_skills_ranking_repository, mocked_preferences, _ = client_with_mocks
            session_id = 1
            # GIVEN an existing state
            existing_state = get_skills_ranking_state(session_id=session_id, phase=SkillsRankingPhase.INITIAL)
            mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            # AND the user has a valid session
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(session_id, {FEATURE_ID: existing_state.experiment_groups.model_dump()}))
            # AND preferences set_experiment_by_user_id should not be called
            mocked_preferences.set_experiment_by_user_id = AsyncMock()
            # AND the service upsert_state will succeed
            updated_state = get_skills_ranking_state(session_id=session_id, phase=SkillsRankingPhase.SELF_EVALUATING)
            mocked_service.upsert_state = AsyncMock(return_value=updated_state)

            # WHEN a POST request is made to update
            response = client.post(f"/conversations/{session_id}/skills-ranking/state", json={
                "phase": "SELF_EVALUATING",
                "self_ranking": "foo"
            })

            # THEN the response is ACCEPTED
            assert response.status_code == HTTPStatus.ACCEPTED
            # AND the service upsert_state is called with the correct arguments
            mocked_service.upsert_state.assert_called_once_with(
                session_id=session_id,
                phase=SkillsRankingPhase.SELF_EVALUATING,
                experiment_groups=existing_state.experiment_groups,
                self_ranking="foo",
                ranking=existing_state.ranking
            )
            # AND preferences set_experiment_by_user_id is not called
            mocked_preferences.set_experiment_by_user_id.assert_not_called()
            # AND the response contains the updated state
            assert response.json()["session_id"] == session_id
            assert response.json()["phase"] == "SELF_EVALUATING"

        @pytest.mark.todo
        async def test_upsert_initial_state_with_experiment_groups(self):
            pass

    class TestGetRanking:
        @pytest.mark.asyncio
        async def test_get_ranking_success(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, mocked_service, _, mocked_preferences, _ = client_with_mocks

            # GIVEN a session id
            session_id = 1

            # AND the user has a valid session
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(session_id))

            # AND the service returns a ranking
            expected_ranking = "foo"
            mocked_service.get_ranking = AsyncMock(return_value=expected_ranking)

            # WHEN a GET request is made
            response = client.get(f"/conversations/{session_id}/skills-ranking/ranking")

            # THEN the response is OK
            assert response.status_code == HTTPStatus.OK
            # AND the response contains the ranking from the service
            assert response.json() == GetRankingResponse(ranking=expected_ranking).model_dump()

            # AND the service was called with the correct session id
            mocked_service.get_ranking.assert_called_once_with(session_id)

        @pytest.mark.asyncio
        async def test_get_ranking_unauthorized(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, _, _, mocked_preferences, _ = client_with_mocks

            # GIVEN a session id
            session_id = 1

            # AND the user does not have access to the session
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(999))  # different session id

            # WHEN a GET request is made
            response = client.get(f"/conversations/{session_id}/skills-ranking/ranking")

            # THEN the response is forbidden
            assert response.status_code == HTTPStatus.FORBIDDEN
            assert response.json() == {"detail": "Unauthorized access to session."}

        @pytest.mark.asyncio
        async def test_get_ranking_state_not_found(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, mocked_service, _, mocked_preferences, _ = client_with_mocks

            # GIVEN a session id
            session_id = 1

            # AND the user has a valid session
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(session_id))

            # AND the service raises a SkillsRankingStateNotFound error
            mocked_service.get_ranking = AsyncMock(side_effect=SkillsRankingStateNotFound(session_id))

            # WHEN a GET request is made
            response = client.get(f"/conversations/{session_id}/skills-ranking/ranking")

            # THEN the response is not found
            assert response.status_code == HTTPStatus.NOT_FOUND
            assert response.json() == {"detail": "Skills ranking state not found."}

        @pytest.mark.asyncio
        async def test_get_ranking_user_preferences_repository_error(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, _, _, mocked_preferences, _ = client_with_mocks

            # GIVEN a session id
            session_id = 1

            # AND the user preferences repository raises an error
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(side_effect=Exception("test error"))

            # WHEN a GET request is made
            response = client.get(f"/conversations/{session_id}/skills-ranking/ranking")

            # THEN the response is internal server error
            assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
            assert response.json() == {"detail": "Opps! Something went wrong."}

        @pytest.mark.asyncio
        async def test_get_ranking_skills_ranking_service_error(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, mocked_service, _, mocked_preferences, _ = client_with_mocks

            # GIVEN a session id
            session_id = 1

            # AND the user has a valid session
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(session_id))

            # AND the service raises an error
            mocked_service.get_ranking = AsyncMock(side_effect=Exception("test error"))

            # WHEN a GET request is made
            response = client.get(f"/conversations/{session_id}/skills-ranking/ranking")

            # THEN the response is internal server error
            assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
            assert response.json() == {"detail": "Opps! Something went wrong."}
