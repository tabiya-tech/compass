from datetime import datetime
from http import HTTPStatus
from typing import Generator, cast
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
from modules.skills_ranking.errors import InvalidNewPhaseError
from modules.skills_ranking.repository.get_skills_ranking_repository import get_skills_ranking_repository
from modules.skills_ranking.repository.repository import ISkillsRankingRepository
from modules.skills_ranking.routes.routes import get_skills_ranking_router
from modules.skills_ranking.service.get_skills_ranking_service import get_skills_ranking_service
from modules.skills_ranking.service.service import ISkillsRankingService
from modules.skills_ranking.service.types import SkillsRankingState, SkillsRankingCurrentState, ExperimentGroup


def get_mock_user_preferences(session_id: int):
    return UserPreferences(
        language="en",
        invitation_code="foo",
        accepted_tc=datetime.now(),
        sessions=[session_id],  # mock a user that owns the given session
        sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_REQUIRED
    )


def get_skills_ranking_state(
        session_id: int = 1,
        current_state: SkillsRankingCurrentState = SkillsRankingCurrentState.INITIAL,
        experiment_group: str = "GROUP_A",
        ranking: str | None = None,
        self_ranking: str | None = None
) -> SkillsRankingState:
    return SkillsRankingState(
        session_id=session_id,
        current_state=current_state,
        experiment_group=cast(ExperimentGroup, experiment_group),
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

    mocked_service = MockedSkillsRankingService()

    # Mock the user preferences repository
    class MockedUserPreferencesRepository(IUserPreferenceRepository):
        async def get_experiments_by_user_id(self, user_id: str) -> dict[str, str]:
            raise NotImplementedError()

        async def get_experiments_by_user_ids(self, user_ids: list[str]) -> dict[str, dict[str, str]]:
            raise NotImplementedError()

        async def set_experiment_by_user_id(self, user_id: str, experiment_id: str, experiment_class: str) -> None:
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

        async def update(self, state: SkillsRankingState) -> SkillsRankingState:
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
    @pytest.mark.asyncio
    async def test_get_skills_ranking_state_success(
            self,
            client_with_mocks: TestClientWithMocks,
            setup_application_config: ApplicationConfig
    ):
        client, _, mocked_skills_ranking_repository, mocked_preferences, _ = client_with_mocks
        # GIVEN a skills ranking state
        given_state = get_skills_ranking_state()

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(
            return_value=get_mock_user_preferences(given_state.session_id))

        # AND the repository's get_by_session_id method is mocked to return the state
        mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=given_state)

        # WHEN a GET request is made
        response = client.get(f"/conversations/{given_state.session_id}/skills-ranking")

        # THEN the response is OK
        assert response.status_code == HTTPStatus.OK
        # AND the response contains the state
        assert response.json() == {
            "session_id": given_state.session_id,
            "current_state": given_state.current_state.value,
            "experiment_group": given_state.experiment_group,
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
            return_value=get_mock_user_preferences(session_id))

        # AND the repository's get_by_session_id method is mocked to return None
        mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=None)

        # WHEN a GET request is made
        response = client.get(f"/conversations/{session_id}/skills-ranking")

        # THEN the response is NOT_FOUND
        assert response.status_code == HTTPStatus.NOT_FOUND

    @pytest.mark.asyncio
    async def test_upsert_skills_ranking_state_create_success(
            self,
            client_with_mocks: TestClientWithMocks,
            setup_application_config: ApplicationConfig
    ):
        client, mocked_service, _, mocked_preferences, _ = client_with_mocks
        # GIVEN a skills ranking state to create
        given_state = get_skills_ranking_state()

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(
            return_value=get_mock_user_preferences(given_state.session_id))

        # AND the service's upsert_state method is mocked to succeed
        mocked_service.upsert_state = AsyncMock(return_value=given_state)

        # WHEN a PATCH request is made
        response = client.patch(
            f"/conversations/{given_state.session_id}/skills-ranking",
            json={
                "current_state": given_state.current_state.value,
                "experiment_group": given_state.experiment_group,
                "ranking": given_state.ranking,
                "self_ranking": given_state.self_ranking
            }
        )

        # THEN the response is ACCEPTED
        assert response.status_code == HTTPStatus.ACCEPTED

    @pytest.mark.asyncio
    async def test_upsert_skills_ranking_state_update_success(
            self,
            client_with_mocks: TestClientWithMocks,
            setup_application_config: ApplicationConfig
    ):
        client, mocked_service, mocked_skills_ranking_repository, mocked_preferences, _ = client_with_mocks
        # GIVEN a skills ranking state to update
        given_state = get_skills_ranking_state(
            current_state=SkillsRankingCurrentState.SELF_EVALUATING,
            ranking="new ranking"
        )

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(
            return_value=get_mock_user_preferences(given_state.session_id))

        mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=given_state)

        # AND the service's upsert_state method is mocked to succeed
        mocked_service.upsert_state = AsyncMock(return_value=given_state)

        # WHEN a PATCH request is made
        response = client.patch(
            f"/conversations/{given_state.session_id}/skills-ranking",
            json={
                "current_state": given_state.current_state.value,
                "experiment_group": given_state.experiment_group,
                "ranking": given_state.ranking,
                "self_ranking": given_state.self_ranking
            }
        )

        # THEN the response is ACCEPTED
        assert response.status_code == HTTPStatus.ACCEPTED

    @pytest.mark.asyncio
    async def test_upsert_skills_ranking_state_invalid_transition(
            self,
            client_with_mocks: TestClientWithMocks,
            setup_application_config: ApplicationConfig
    ):
        client, mocked_service, mocked_skills_ranking_repository, mocked_preferences, _ = client_with_mocks
        # GIVEN a skills ranking state with an invalid transition
        given_state = get_skills_ranking_state(
            current_state=SkillsRankingCurrentState.EVALUATED
        )

        # AND the user has a valid session
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(
            return_value=get_mock_user_preferences(given_state.session_id))

        # AND the repository's get_by_session_id method is mocked to return the existing state
        mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=given_state)

        # AND the service's upsert_state method is mocked to raise InvalidNewPhaseError
        mocked_service.upsert_state = AsyncMock(side_effect=InvalidNewPhaseError(
            current_phase=SkillsRankingCurrentState.INITIAL,
            expected_phases=[SkillsRankingCurrentState.SELF_EVALUATING, SkillsRankingCurrentState.SKIPPED]
        ))

        # WHEN a PATCH request is made
        response = client.patch(
            f"/conversations/{given_state.session_id}/skills-ranking",
            json={
                "current_state": given_state.current_state.value,
                "experiment_group": given_state.experiment_group,
                "ranking": given_state.ranking,
                "self_ranking": given_state.self_ranking
            }
        )

        # THEN the response is BAD_REQUEST
        assert response.status_code == HTTPStatus.BAD_REQUEST

    @pytest.mark.asyncio
    async def test_upsert_skills_ranking_state_unauthorized(
            self,
            client_with_mocks: TestClientWithMocks,
            setup_application_config: ApplicationConfig
    ):
        client, _, _, mocked_preferences, _ = client_with_mocks
        # GIVEN a skills ranking state
        given_state = get_skills_ranking_state()

        # AND the user doesn't have access to the session
        mock_user_preferences = get_mock_user_preferences(456)  # Different session ID
        mocked_preferences.get_user_preference_by_user_id = AsyncMock(return_value=mock_user_preferences)

        # WHEN a PATCH request is made
        response = client.patch(
            f"/conversations/{given_state.session_id}/skills-ranking",
            json={
                "current_state": given_state.current_state.value,
                "experiment_group": given_state.experiment_group,
                "ranking": given_state.ranking,
                "self_ranking": given_state.self_ranking
            }
        )

        # THEN the response is FORBIDDEN
        assert response.status_code == HTTPStatus.FORBIDDEN
