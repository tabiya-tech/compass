from features.skills_ranking.services.errors import (
    SkillsRankingGenericError,
)

from datetime import datetime
from http import HTTPStatus
from typing import Generator, Tuple
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
from features.skills_ranking.constants import SKILLS_RANKING_FEATURE_ID
from features.skills_ranking.errors import InvalidNewPhaseError, InvalidFieldsForPhaseError
from features.skills_ranking.state._test_utilities import get_skills_ranking_state
from features.skills_ranking.state.repositories.get_skills_ranking_state_repository import \
    get_skills_ranking_state_mongo_repository
from features.skills_ranking.state.repositories.skills_ranking_state_repository import ISkillsRankingStateRepository
from features.skills_ranking.state.routes.routes import get_skills_ranking_router
from features.skills_ranking.state.services.get_skills_ranking_state_service import get_skills_ranking_state_service
from features.skills_ranking.state.services.skills_ranking_state_service import ISkillsRankingStateService
from features.skills_ranking.state.services.type import (SkillsRankingState, SkillRankingExperimentGroup,
                                                         SkillsRankingScore, UpdateSkillsRankingRequest)


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


TestClientWithMocks = tuple[
    TestClient, ISkillsRankingStateService, ISkillsRankingStateRepository, IUserPreferenceRepository, UserInfo | None]


def _create_test_client_with_mocks() -> TestClientWithMocks:
    """
    Factory function to create a test client with mocked dependencies
    """

    # Mock the skills ranking service
    class MockedSkillsRankingService(ISkillsRankingStateService):
        async def upsert_state(self, session_id: int,
                               update_request: UpdateSkillsRankingRequest,
                               user_id: str) -> SkillsRankingState:
            raise NotImplementedError()

        async def calculate_ranking_and_groups(self, user_id: str, session_id: int) -> Tuple[
            SkillsRankingScore, SkillRankingExperimentGroup]:
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
    class MockedSkillsRankingStateRepository(ISkillsRankingStateRepository):
        async def get_by_session_id(self, session_id: int) -> SkillsRankingState | None:
            raise NotImplementedError()

        async def create(self, state: SkillsRankingState) -> SkillsRankingState:
            raise NotImplementedError()

        async def update(self, *, session_id: int, update_request: UpdateSkillsRankingRequest) -> SkillsRankingState:
            raise NotImplementedError()

        async def update_experiment_group(self, session_id: int, experiment_group: SkillRankingExperimentGroup) -> SkillsRankingState:
            raise NotImplementedError()

    mocked_skills_ranking_repository = MockedSkillsRankingStateRepository()

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
    app.dependency_overrides[get_skills_ranking_state_mongo_repository] = lambda: mocked_skills_ranking_repository
    app.dependency_overrides[get_skills_ranking_state_service] = lambda: mocked_service

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
                return_value=get_mock_user_preferences(given_state.session_id,
                                                       {SKILLS_RANKING_FEATURE_ID: given_state.experiment_group.name}))

            # AND the repository's get_by_session_id method will return the state
            mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=given_state)

            # WHEN a GET request is made
            response = client.get(f"/conversations/{given_state.session_id}/skills-ranking/state")

            # THEN the response is OK
            assert response.status_code == HTTPStatus.OK
            # AND the response contains the state
            assert response.json() == {
                "session_id": given_state.session_id,
                "phase": [
                    {
                        "name": p.name,
                        "time": p.time.isoformat().replace("+00:00", "Z")
                    }
                    for p in given_state.phase
                ],
                "experiment_group": given_state.experiment_group.name,
                "score": {
                    "calculated_at": given_state.score.calculated_at.isoformat().replace("+00:00", "Z"),
                    "jobs_matching_rank": given_state.score.jobs_matching_rank,
                    "comparison_rank": given_state.score.comparison_rank,
                    "comparison_label": given_state.score.comparison_label,
                },
                "cancelled_after": given_state.cancelled_after,
                "succeeded_after": given_state.succeeded_after,
                "puzzles_solved": given_state.puzzles_solved,
                "correct_rotations": given_state.correct_rotations,
                "clicks_count": given_state.clicks_count,
                "perceived_rank_percentile": given_state.perceived_rank_percentile,
                "retyped_rank_percentile": given_state.retyped_rank_percentile,
                "started_at": given_state.started_at.isoformat().replace("+00:00", "Z"),
                "completed_at": (
                    given_state.completed_at.isoformat().replace("+00:00", "Z")
                    if given_state.completed_at else None
                )
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
            client, mocked_service, mocked_skills_ranking_repository, mocked_preferences, _ = client_with_mocks
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

            # WHEN a PATCH request is made with INITIAL phase
            response = client.patch(f"/conversations/{session_id}/skills-ranking/state", json={
                "phase": "INITIAL",
                "self_ranking": None
            })

            # THEN the response is ACCEPTED
            assert response.status_code == HTTPStatus.ACCEPTED
            # AND the service upsert_state is called with the correct arguments
            mocked_service.upsert_state.assert_called_once()
            call_args = mocked_service.upsert_state.call_args
            assert call_args[1]["session_id"] == session_id
            assert call_args[1]["update_request"].phase == "INITIAL"
            # AND the response contains the created state
            assert response.json()["session_id"] == session_id
            assert response.json()["phase"][-1]["name"] == "INITIAL"

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

            # WHEN a PATCH request is made with non-INITIAL phase
            response = client.patch(f"/conversations/{session_id}/skills-ranking/state", json={
                "phase": "COMPLETED"
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
            existing_state = get_skills_ranking_state(session_id=session_id, phase="INITIAL")
            mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            # AND the user has a valid session
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(session_id, {
                    SKILLS_RANKING_FEATURE_ID: existing_state.experiment_group.name}))
            # AND preferences set_experiment_by_user_id should not be called
            mocked_preferences.set_experiment_by_user_id = AsyncMock()
            # AND the service upsert_state will succeed
            updated_state = get_skills_ranking_state(session_id=session_id, phase="COMPLETED")
            mocked_service.upsert_state = AsyncMock(return_value=updated_state)

            # WHEN a PATCH request is made to update
            given_new_cancelled_after = "40.0ms"
            given_new_perceived_rank = 75.0
            given_retyped_rank = 80.0
            response = client.patch(f"/conversations/{session_id}/skills-ranking/state", json={
                "phase": "COMPLETED",
                "cancelled_after": given_new_cancelled_after,
                "perceived_rank_percentile": given_new_perceived_rank,
                "retyped_rank_percentile": given_retyped_rank
            })

            # THEN the response is ACCEPTED
            assert response.status_code == HTTPStatus.ACCEPTED
            # AND the service upsert_state is called with the correct arguments
            mocked_service.upsert_state.assert_called_once()
            call_args = mocked_service.upsert_state.call_args
            assert call_args[1]["session_id"] == session_id
            assert call_args[1]["update_request"].phase == "COMPLETED"
            assert call_args[1]["update_request"].cancelled_after == given_new_cancelled_after
            assert call_args[1]["update_request"].perceived_rank_percentile == pytest.approx(given_new_perceived_rank)
            assert call_args[1]["update_request"].retyped_rank_percentile == pytest.approx(given_retyped_rank)
            # AND preferences set_experiment_by_user_id is not called
            mocked_preferences.set_experiment_by_user_id.assert_not_called()
            # AND the response contains the updated state
            assert response.json()["session_id"] == session_id
            assert response.json()["phase"][-1]["name"] == "COMPLETED"

        @pytest.mark.asyncio
        async def test_upsert_skills_ranking_state_invalid_phase(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, mocked_service, mocked_skills_ranking_repository, mocked_preferences, _ = client_with_mocks
            session_id = 1
            # GIVEN an existing state
            existing_state = get_skills_ranking_state(session_id=session_id, phase="INITIAL")
            mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            # AND the user has a valid session
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(session_id, {
                    SKILLS_RANKING_FEATURE_ID: existing_state.experiment_group.name}))
            # AND preferences set_experiment_by_user_id returns
            mocked_preferences.set_experiment_by_user_id = AsyncMock()
            # AND the service upsert_state should raises InvalidNewPhaseError
            mocked_service.upsert_state = AsyncMock(side_effect=InvalidNewPhaseError(
                current_phase=existing_state.phase[-1].name,
                expected_phases=["BRIEFING", "COMPLETED"]
            ))

            # WHEN a PATCH request is made with an invalid phase transition
            response = client.patch(f"/conversations/{session_id}/skills-ranking/state", json={
                "phase": "BRIEFING"  # Invalid transition from INITIAL to BRIEFING
            })

            # THEN the response is BAD_REQUEST
            assert response.status_code == HTTPStatus.BAD_REQUEST
            assert response.json()["detail"] == "Invalid new phase provided."

            # AND preferences set_experiment_by_user_id is not called
            mocked_preferences.set_experiment_by_user_id.assert_not_called()

        @pytest.mark.asyncio
        async def test_upsert_skills_ranking_state_invalid_fields_for_phase(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, mocked_service, mocked_skills_ranking_repository, mocked_preferences, _ = client_with_mocks
            session_id = 1
            # GIVEN an existing state
            existing_state = get_skills_ranking_state(session_id=session_id, phase="INITIAL")
            mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            # AND the user has a valid session
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(session_id, {
                    SKILLS_RANKING_FEATURE_ID: existing_state.experiment_group.name}))
            # AND preferences set_experiment_by_user_id returns
            mocked_preferences.set_experiment_by_user_id = AsyncMock()
            # AND the service upsert_state should raises InvalidFieldsForPhaseError
            mocked_service.upsert_state = AsyncMock(side_effect=InvalidFieldsForPhaseError(
                current_phase=existing_state.phase[-1].name,
                invalid_fields=["cancelled_after"],
                valid_fields=["phase", "perceived_rank_percentile", "retyped_rank_percentile"]
            ))

            # WHEN a PATCH request is made with invalid fields for the phase
            response = client.patch(f"/conversations/{session_id}/skills-ranking/state", json={
                "phase": "INITIAL",
                "cancelled_after": "1000ms"  # Invalid field for INITIAL phase
            })

            # THEN the response is BAD_REQUEST
            assert response.status_code == HTTPStatus.BAD_REQUEST
            assert response.json()["detail"] == "Invalid fields for the current phase."

            # AND preferences set_experiment_by_user_id is not called
            mocked_preferences.set_experiment_by_user_id.assert_not_called()

        @pytest.mark.asyncio
        async def test_upsert_skills_ranking_state_unauthorized_access(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, mocked_service, _, mocked_preferences, _ = client_with_mocks
            session_id = 1
            # GIVEN the user has no valid session
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(return_value=None)
            # AND the service upsert_state should not be called
            mocked_service.upsert_state = AsyncMock()

            # WHEN a PATCH request is made
            response = client.patch(f"/conversations/{session_id}/skills-ranking/state", json={
                "phase": "INITIAL"
            })

            # THEN the response is FORBIDDEN
            assert response.status_code == HTTPStatus.FORBIDDEN
            assert response.json()["detail"] == "Unauthorized access to session."
            # AND the service upsert_state is not called
            mocked_service.upsert_state.assert_not_called()

        @pytest.mark.asyncio
        async def test_upsert_skills_ranking_state_internal_error(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, mocked_service, mocked_skills_ranking_repository, mocked_preferences, _ = client_with_mocks
            session_id = 1
            # GIVEN an existing state
            existing_state = get_skills_ranking_state(session_id=session_id, phase="INITIAL")
            mocked_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            # AND the user has a valid session
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(session_id, {
                    SKILLS_RANKING_FEATURE_ID: existing_state.experiment_group.name}))
            # AND preferences set_experiment_by_user_id returns
            mocked_preferences.set_experiment_by_user_id = AsyncMock()
            # AND the service upsert_state will raise an exception
            mocked_service.upsert_state = AsyncMock(side_effect=Exception("Internal error"))

            # WHEN a PATCH request is made
            response = client.patch(f"/conversations/{session_id}/skills-ranking/state", json={
                "phase": "COMPLETED"
            })

            # THEN the response is INTERNAL_SERVER_ERROR
            assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
            assert response.json()["detail"] == "Oops! Something went wrong."
            # AND the service upsert_state is called
            mocked_service.upsert_state.assert_called_once()

        @pytest.mark.asyncio
        async def test_upsert_maps_generic_error_to_500(
                self,
                client_with_mocks: TestClientWithMocks,
                setup_application_config: ApplicationConfig
        ):
            client, mocked_service, mocked_repository, mocked_preferences, _ = client_with_mocks

            # GIVEN no existing state and a valid session
            mocked_repository.get_by_session_id = AsyncMock(return_value=None)
            mocked_preferences.get_user_preference_by_user_id = AsyncMock(
                return_value=get_mock_user_preferences(1, {}))
            # AND the service raises a generic error
            mocked_service.upsert_state = AsyncMock(side_effect=SkillsRankingGenericError("Skills ranking service error"))

            # WHEN upserting INITIAL phase
            response = client.patch("/conversations/1/skills-ranking/state", json={"phase": "INITIAL"})

            # THEN a 500 is returned
            assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
            assert response.json()["detail"] == "Skills ranking service error"
