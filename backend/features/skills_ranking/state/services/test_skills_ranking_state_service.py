import datetime
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_mock

from app.app_config import ApplicationConfig
from app.store.database_application_state_store_test import get_test_application_state
from app.users.repositories import IUserPreferenceRepository
from app.users.types import PossibleExperimentValues, UserPreferences
from common_libs.test_utilities import get_random_printable_string, get_random_session_id, get_random_user_id
from common_libs.time_utilities import get_now
from features.skills_ranking.errors import InvalidNewPhaseError
from features.skills_ranking.services.errors import (
    SkillsRankingGenericError,
    SkillsRankingServiceHTTPError,
    SkillsRankingServiceTimeoutError,
)
from features.skills_ranking.state._test_utilities import get_skills_ranking_state
from features.skills_ranking.state.repositories.skills_ranking_state_repository import ISkillsRankingStateRepository
from features.skills_ranking.state.services.skills_ranking_state_service import SkillsRankingStateService
from features.skills_ranking.state.services.test_types import (
    get_test_application_state_manager,
    get_test_http_client,
    get_test_registration_data_repository,
)
from features.skills_ranking.state.services.type import (
    SkillsRankingPhase,
    SkillsRankingPhaseName,
    SkillRankingExperimentGroup,
    SkillsRankingState,
    UpdateSkillsRankingRequest,
    UserReassignmentMetadata,
)
from features.skills_ranking.types import PriorBeliefs, SkillsRankingScore


@pytest.fixture(scope="function")
def _mock_skills_ranking_state_repository() -> ISkillsRankingStateRepository:
    class MockSkillsRankingStateRepository(ISkillsRankingStateRepository):
        async def get_by_session_id(self, session_id: int) -> SkillsRankingState | None:
            raise NotImplementedError()

        async def create(self, state: SkillsRankingState) -> SkillsRankingState:
            raise NotImplementedError()

        async def update(self, *, session_id: int, update_request: UpdateSkillsRankingRequest) -> SkillsRankingState:
            raise NotImplementedError()

    return MockSkillsRankingStateRepository()


@pytest.fixture(scope="function")
def _mock_user_preference_repository() -> IUserPreferenceRepository:
    class MockUserPreferenceRepository(IUserPreferenceRepository):
        async def get_by_session_id(self, session_id: int) -> UserPreferences | None:
            raise NotImplementedError()

        async def update_user_preference(
                self,
                user_id: str | None = None,
                experiment_groups: SkillRankingExperimentGroup | None = None,
        ) -> UserPreferences:
            raise NotImplementedError()

        async def get_user_preference_by_user_id(self, user_id: str) -> UserPreferences | None:
            raise NotImplementedError()

        async def get_experiments_by_user_ids(self, user_ids: list[str]) -> list[UserPreferences]:
            raise NotImplementedError()

        async def set_experiment_by_user_id(
                self,
                user_id: str,
                experiment_id: str,
                experiment_config: dict[str, PossibleExperimentValues],
        ) -> None:
            raise NotImplementedError()

        async def get_experiments_by_user_id(self, user_id: str) -> SkillRankingExperimentGroup | None:
            raise NotImplementedError()

        async def insert_user_preference(self, user_id: str, user_preference: UserPreferences) -> UserPreferences:
            raise NotImplementedError()

    return MockUserPreferenceRepository()


def _build_service(
        repository: ISkillsRankingStateRepository,
        user_preferences_repository: IUserPreferenceRepository,
):
    return SkillsRankingStateService(
        repository,
        user_preferences_repository,
        get_test_registration_data_repository(),
        get_test_application_state_manager(),
        get_test_http_client(),
    )


class TestSkillsRankingService:
    class TestUpsertState:
        @pytest.mark.asyncio
        async def test_upsert_state_create(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository,
                setup_application_config: ApplicationConfig,
        ):
            given_state = get_skills_ranking_state()

            _mock_skills_ranking_state_repository.get_by_session_id = AsyncMock(return_value=None)
            _mock_skills_ranking_state_repository.create = AsyncMock(return_value=given_state)
            _mock_skills_ranking_state_repository.update = AsyncMock()
            _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

            service = _build_service(_mock_skills_ranking_state_repository, _mock_user_preference_repository)

            result = await service.upsert_state(
                user_id=get_random_user_id(),
                session_id=given_state.session_id,
                update_request=UpdateSkillsRankingRequest(phase="INITIAL"),
            )

            _mock_skills_ranking_state_repository.get_by_session_id.assert_called_once_with(given_state.session_id)
            _mock_skills_ranking_state_repository.create.assert_called_once()
            _mock_skills_ranking_state_repository.update.assert_not_called()
            assert result == given_state

        @pytest.mark.asyncio
        async def test_upsert_state_update_valid_transition(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository,
                setup_application_config: ApplicationConfig,
        ):
            existing_state = get_skills_ranking_state(phase="INITIAL")
            new_phase: SkillsRankingPhaseName = "BRIEFING"

            _mock_skills_ranking_state_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            _mock_skills_ranking_state_repository.create = AsyncMock()
            new_state = existing_state.model_copy(deep=True)
            new_state.phase.append(SkillsRankingPhase(name=new_phase, time=get_now()))
            _mock_skills_ranking_state_repository.update = AsyncMock(return_value=new_state)
            _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

            service = _build_service(_mock_skills_ranking_state_repository, _mock_user_preference_repository)

            result = await service.upsert_state(
                user_id=get_random_user_id(),
                session_id=new_state.session_id,
                update_request=UpdateSkillsRankingRequest(phase=new_phase),
            )

            _mock_skills_ranking_state_repository.get_by_session_id.assert_called_once_with(new_state.session_id)
            _mock_skills_ranking_state_repository.update.assert_called_once()
            _mock_skills_ranking_state_repository.create.assert_not_called()
            assert result == new_state

        @pytest.mark.asyncio
        async def test_upsert_state_update_invalid_transition(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository,
        ):
            existing_state = get_skills_ranking_state(phase="BRIEFING")
            new_phase: SkillsRankingPhaseName = "COMPLETED"

            _mock_skills_ranking_state_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            _mock_skills_ranking_state_repository.create = AsyncMock()
            _mock_skills_ranking_state_repository.update = AsyncMock()
            _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

            service = _build_service(_mock_skills_ranking_state_repository, _mock_user_preference_repository)

            with pytest.raises(InvalidNewPhaseError):
                await service.upsert_state(
                    user_id=get_random_user_id(),
                    session_id=existing_state.session_id,
                    update_request=UpdateSkillsRankingRequest(phase=new_phase),
                )

            _mock_skills_ranking_state_repository.update.assert_not_called()
            _mock_skills_ranking_state_repository.create.assert_not_called()

        @pytest.mark.asyncio
        async def test_upsert_state_records_group_switch_metadata(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository,
                mocker: pytest_mock.MockFixture,
        ):
            existing_state = get_skills_ranking_state(
                phase="PROOF_OF_VALUE",
                correct_rotations=50,
                experiment_group=SkillRankingExperimentGroup.GROUP_1,
            )

            new_phase: SkillsRankingPhaseName = "PRIOR_BELIEF"
            reassigned_group = SkillRankingExperimentGroup.GROUP_2

            _mock_skills_ranking_state_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            expected_state = existing_state.model_copy(deep=True)
            expected_state.phase.append(SkillsRankingPhase(name=new_phase, time=get_now()))
            expected_state.metadata.experiment_group = reassigned_group
            expected_state.metadata.user_reassigned = UserReassignmentMetadata(
                original_group=SkillRankingExperimentGroup.GROUP_1,
                reassigned_group=reassigned_group,
            )
            _mock_skills_ranking_state_repository.update = AsyncMock(return_value=expected_state)
            _mock_skills_ranking_state_repository.create = AsyncMock()
            _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

            service = _build_service(_mock_skills_ranking_state_repository, _mock_user_preference_repository)

            mocker.patch(
                "features.skills_ranking.state.services.skills_ranking_state_service.random.random",
                return_value=0.0,
            )
            mocker.patch(
                "features.skills_ranking.state.services.skills_ranking_state_service.random.choice",
                return_value=reassigned_group,
            )
            mocker.patch.object(service, "_get_correct_rotations_threshold", return_value=10)

            result = await service.upsert_state(
                user_id=get_random_user_id(),
                session_id=existing_state.session_id,
                update_request=UpdateSkillsRankingRequest(phase=new_phase),
            )

            update_request_used: UpdateSkillsRankingRequest = \
                _mock_skills_ranking_state_repository.update.call_args.kwargs["update_request"]

            assert update_request_used.metadata is not None
            assert update_request_used.metadata["experiment_group"] == reassigned_group.name
            assert update_request_used.metadata["user_reassigned"] == {
                "original_group": SkillRankingExperimentGroup.GROUP_1.name,
                "reassigned_group": reassigned_group.name,
            }
            assert result.metadata.user_reassigned == UserReassignmentMetadata(
                original_group=SkillRankingExperimentGroup.GROUP_1,
                reassigned_group=reassigned_group,
            )
            _mock_user_preference_repository.set_experiment_by_user_id.assert_called_once()

    class TestCalculateRankingAndGroups:
        @pytest.mark.asyncio
        async def test_success(
                self,
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                mocker: pytest_mock.MockFixture,
                setup_application_config: ApplicationConfig,
        ):
            given_user_id = get_random_user_id()
            given_session_id = get_random_session_id()

            given_prior_beliefs = PriorBeliefs(
                external_user_id=get_random_user_id(),
                compare_to_others_prior_belief=0.5,
                opportunity_rank_prior_belief=0.4,
            )

            registration_data_repository = get_test_registration_data_repository()
            registration_data_repository_get_prior_beliefs_spy = mocker.patch.object(
                registration_data_repository,
                "get_prior_beliefs",
                AsyncMock(return_value=given_prior_beliefs),
            )

            application_state_manager = get_test_application_state_manager()
            given_application_state = get_test_application_state(given_session_id)
            application_state_manager_get_state_spy = mocker.patch.object(
                application_state_manager,
                "get_state",
                AsyncMock(return_value=given_application_state),
            )

            expected_skills_uuids: set[str] = {
                skill.UUID
                for experience in given_application_state.explore_experiences_director_state.experiences_state.values()
                for skill in experience.experience.top_skills + experience.experience.remaining_skills
            }

            ranking_service = get_test_http_client()
            given_participant_ranks = SkillsRankingScore(
                calculated_at=datetime.datetime.now(),
                above_average_labels=[get_random_printable_string(8)],
                below_average_labels=[get_random_printable_string(8)],
                most_demanded_label=get_random_printable_string(8),
                most_demanded_percent=65.0,
                least_demanded_label=get_random_printable_string(8),
                least_demanded_percent=10.0,
                average_percent_for_jobseeker_skill_groups=45.0,
                average_count_for_jobseeker_skill_groups=418.0,
                province_used=get_random_printable_string(8),
                matched_skill_groups=5,
            )

            http_client_get_participant_ranking_spy = mocker.patch.object(
                ranking_service,
                "get_participant_ranking",
                AsyncMock(return_value=given_participant_ranks),
            )

            service = SkillsRankingStateService(
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                registration_data_repository,
                application_state_manager,
                ranking_service,
            )

            get_group_spy = mocker.patch.object(service, "_get_group",
                                                Mock(return_value=SkillRankingExperimentGroup.GROUP_1))

            actual_ranks, actual_group = await service.calculate_ranking_and_groups(given_user_id, given_session_id)

            expected_taxonomy_model_id = \
            list(given_application_state.explore_experiences_director_state.experiences_state.values())[
                0].experience.top_skills[0].modelId

            assert actual_group == SkillRankingExperimentGroup.GROUP_1
            assert actual_ranks == given_participant_ranks
            assert registration_data_repository_get_prior_beliefs_spy.call_args.kwargs.get("user_id") == given_user_id
            assert application_state_manager_get_state_spy.call_args.kwargs.get("session_id") == given_session_id
            assert http_client_get_participant_ranking_spy.call_count == 1
            assert http_client_get_participant_ranking_spy.call_args.kwargs.get(
                "participants_skills_uuids") == expected_skills_uuids

            assert http_client_get_participant_ranking_spy.call_args.kwargs.get(
                "taxonomy_model_id") == expected_taxonomy_model_id
            get_group_spy.assert_called_once()

    class TestErrorHandling:
        @pytest.mark.asyncio
        async def test_calculate_ranking_and_groups_http_error(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository,
                setup_application_config: ApplicationConfig,
                mocker: pytest_mock.MockFixture,
        ):
            given_user_id = get_random_user_id()
            given_session_id = get_random_session_id()

            registration_data_repository = get_test_registration_data_repository()
            application_state_manager = get_test_application_state_manager()
            given_application_state = get_test_application_state(given_session_id)

            mocker.patch.object(
                registration_data_repository,
                "get_prior_beliefs",
                AsyncMock(
                    return_value=PriorBeliefs(
                        external_user_id=get_random_user_id(),
                        compare_to_others_prior_belief=0.5,
                        opportunity_rank_prior_belief=0.6,
                    )
                ),
            )
            mocker.patch.object(application_state_manager, "get_state", AsyncMock(return_value=given_application_state))

            ranking_service = get_test_http_client()
            mocker.patch.object(
                ranking_service,
                "get_participant_ranking",
                AsyncMock(side_effect=SkillsRankingServiceHTTPError(500, "Internal server error")),
            )

            service = SkillsRankingStateService(
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                registration_data_repository,
                application_state_manager,
                ranking_service,
            )

            with pytest.raises(SkillsRankingGenericError):
                await service.calculate_ranking_and_groups(given_user_id, given_session_id)

        @pytest.mark.asyncio
        async def test_calculate_ranking_and_groups_timeout_error(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository,
                setup_application_config: ApplicationConfig,
                mocker: pytest_mock.MockFixture,
        ):
            given_user_id = get_random_user_id()
            given_session_id = get_random_session_id()

            registration_data_repository = get_test_registration_data_repository()
            application_state_manager = get_test_application_state_manager()
            given_application_state = get_test_application_state(given_session_id)

            mocker.patch.object(
                registration_data_repository,
                "get_prior_beliefs",
                AsyncMock(
                    return_value=PriorBeliefs(
                        external_user_id=get_random_user_id(),
                        compare_to_others_prior_belief=0.5,
                        opportunity_rank_prior_belief=0.6,
                    )
                ),
            )
            mocker.patch.object(application_state_manager, "get_state", AsyncMock(return_value=given_application_state))

            ranking_service = get_test_http_client()
            mocker.patch.object(
                ranking_service,
                "get_participant_ranking",
                AsyncMock(side_effect=SkillsRankingServiceTimeoutError("Request timed out")),
            )

            service = SkillsRankingStateService(
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                registration_data_repository,
                application_state_manager,
                ranking_service,
            )

            with pytest.raises(SkillsRankingGenericError):
                await service.calculate_ranking_and_groups(given_user_id, given_session_id)
