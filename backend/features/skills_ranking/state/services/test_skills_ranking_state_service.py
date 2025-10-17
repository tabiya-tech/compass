import datetime
import random
from typing import cast
from unittest.mock import AsyncMock, patch, Mock

import pytest
import pytest_mock

from app.app_config import ApplicationConfig
from app.store.database_application_state_store_test import get_test_application_state
from app.users.repositories import IUserPreferenceRepository
from app.users.types import UserPreferences, PossibleExperimentValues
from common_libs.test_utilities import get_random_user_id, get_random_session_id
from common_libs.time_utilities import get_now
from features.skills_ranking.errors import InvalidNewPhaseError
from features.skills_ranking.state._test_utilities import get_skills_ranking_state
from features.skills_ranking.state.repositories.skills_ranking_state_repository import ISkillsRankingStateRepository
from features.skills_ranking.state.services.skills_ranking_state_service import SkillsRankingStateService, \
    CORRECT_ROTATIONS_THRESHOLD_FOR_GROUP_SWITCH
from features.skills_ranking.state.services.test_types import get_test_http_client, \
    get_test_application_state_manager, get_test_registration_data_repository
from features.skills_ranking.state.services.type import SkillsRankingState, SkillsRankingPhaseName, \
    SkillRankingExperimentGroup, \
    SkillsRankingPhase, UpdateSkillsRankingRequest
from features.skills_ranking.types import PriorBeliefs, SkillsRankingScore
from features.skills_ranking.services.errors import (
    SkillsRankingServiceHTTPError,
    SkillsRankingServiceTimeoutError,
    SkillsRankingGenericError,
)


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

        async def update_user_preference(self, user_id: str | None = None,
                                         experiment_groups: SkillRankingExperimentGroup | None = None) -> UserPreferences:
            raise NotImplementedError()

        async def get_user_preference_by_user_id(self, user_id: str) -> UserPreferences | None:
            raise NotImplementedError()

        async def get_experiments_by_user_ids(self, user_ids: list[str]) -> list[UserPreferences]:
            raise NotImplementedError()

        async def set_experiment_by_user_id(self, user_id: str, experiment_id: str,
                                            experiment_config: dict[str, PossibleExperimentValues]) -> None:
            raise NotImplementedError()

        async def get_experiments_by_user_id(self, user_id: str) -> SkillRankingExperimentGroup | None:
            raise NotImplementedError()

        async def insert_user_preference(self, user_id: str, user_preference: UserPreferences) -> UserPreferences:
            raise NotImplementedError()

    return MockUserPreferenceRepository()


class TestSkillsRankingService:
    class TestUpsertState:
        @pytest.mark.asyncio
        async def test_upsert_state_create(self,
                                           _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                                           _mock_user_preference_repository: IUserPreferenceRepository,
                                           setup_application_config: ApplicationConfig):
            # GIVEN a state to create
            given_state = get_skills_ranking_state()

            # AND all repository methods are mocked
            _mock_skills_ranking_state_repository.get_by_session_id = AsyncMock(return_value=None)
            _mock_skills_ranking_state_repository.create = AsyncMock(return_value=given_state)
            _mock_skills_ranking_state_repository.update = AsyncMock()

            # AND the set_experiment_by_user_id method will successfully set the experiment groups
            _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

            # WHEN upserting the state
            given_high_difference_threshold = 0.5
            given_correct_rotations_threshold_for_group_switch = 30
            service = SkillsRankingStateService(
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                get_test_registration_data_repository(),
                get_test_application_state_manager(),
                get_test_http_client(),
                given_high_difference_threshold,
                given_correct_rotations_threshold_for_group_switch
            )

            result = await service.upsert_state(
                user_id=get_random_user_id(),
                session_id=given_state.session_id,
                update_request=UpdateSkillsRankingRequest(phase="INITIAL"),
            )

            # THEN the repository get_by_session_id method is called with the state
            _mock_skills_ranking_state_repository.get_by_session_id.assert_called_once_with(given_state.session_id)

            # AND then the repository create method is called with the state
            _mock_skills_ranking_state_repository.create.assert_called_once()

            # AND the repository update method is not called
            _mock_skills_ranking_state_repository.update.assert_not_called()

            # AND the result is the created state
            assert result == given_state

        @pytest.mark.asyncio
        async def test_upsert_state_update_valid_transition(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository, setup_application_config: ApplicationConfig):
            # GIVEN an existing state
            existing_state = get_skills_ranking_state(phase="INITIAL")

            # AND a new phase to update to
            new_phase = "BRIEFING"

            # AND all repository methods are mocked
            _mock_skills_ranking_state_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            _mock_skills_ranking_state_repository.create = AsyncMock()
            new_state = existing_state.model_copy(deep=True)
            new_state.phase.append(SkillsRankingPhase(
                name=cast(SkillsRankingPhaseName, new_phase),
                time=get_now()
            ))
            _mock_skills_ranking_state_repository.update = AsyncMock(return_value=new_state)

            # AND the set_experiment_by_user_id method will successfully set the experiment groups
            _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

            given_high_difference_threshold = 0.5
            given_correct_rotations_threshold_for_group_switch = 30
            service = SkillsRankingStateService(
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                get_test_registration_data_repository(),
                get_test_application_state_manager(),
                get_test_http_client(),
                given_high_difference_threshold,
                given_correct_rotations_threshold_for_group_switch
            )

            result = await service.upsert_state(
                user_id=get_random_user_id(),
                session_id=new_state.session_id,
                update_request=UpdateSkillsRankingRequest(phase=cast(SkillsRankingPhaseName, new_phase)),
            )

            # THEN the repository get_by_session_id method is called with the state
            _mock_skills_ranking_state_repository.get_by_session_id.assert_called_once_with(new_state.session_id)

            # AND then the repository update method is called with only the changed fields
            _mock_skills_ranking_state_repository.update.assert_called_once()
            call_args = _mock_skills_ranking_state_repository.update.call_args
            assert call_args.kwargs["session_id"] == new_state.session_id
            assert call_args.kwargs["update_request"].phase == new_phase

            # AND the repository create method is not called
            _mock_skills_ranking_state_repository.create.assert_not_called()

            # AND the result is the updated state
            assert result == new_state

        @pytest.mark.asyncio
        async def test_upsert_state_update_invalid_transition(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository):
            # GIVEN an existing state
            existing_state = get_skills_ranking_state(phase="BRIEFING")

            # AND a new phase with an invalid transition
            new_phase = "COMPLETED"

            # AND all repository methods are mocked
            _mock_skills_ranking_state_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            _mock_skills_ranking_state_repository.create = AsyncMock()
            _mock_skills_ranking_state_repository.update = AsyncMock()

            # AND the set_experiment_by_user_id method will successfully set the experiment groups
            _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

            given_high_difference_threshold = 0.5
            given_correct_rotations_threshold_for_group_switch = 30
            service = SkillsRankingStateService(
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                get_test_registration_data_repository(),
                get_test_application_state_manager(),
                get_test_http_client(),
                given_high_difference_threshold,
                given_correct_rotations_threshold_for_group_switch
            )

            # WHEN upserting the state (app config ensures taxonomy_model_id is available)
            # THEN an InvalidNewPhaseError is raised because we can't go from 'BRIEFING' to 'COMPLETED'
            with pytest.raises(InvalidNewPhaseError) as throw_exception:
                await service.upsert_state(
                    user_id=get_random_user_id(),
                    session_id=existing_state.session_id,
                    update_request=UpdateSkillsRankingRequest(phase=cast(SkillsRankingPhaseName, new_phase)),
                )

            # AND expected phases should be the valid next phases
            assert throw_exception.value.expected_phases == ['BRIEFING', 'PROOF_OF_VALUE']

            # AND the repository is not called to update
            _mock_skills_ranking_state_repository.update.assert_not_called()

            # AND the repository is not called to create
            _mock_skills_ranking_state_repository.create.assert_not_called()

        @pytest.mark.asyncio
        async def test_random_group_switch_during_proof_of_value_transition(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository,
                setup_application_config: ApplicationConfig
        ):
            # GIVEN a user in GROUP_2 with puzzles_solved > PUZZLES_SOLVED_THRESHOLD transitioning from PROOF_OF_VALUE
            existing_state = get_skills_ranking_state(
                session_id=1,
                phase="PROOF_OF_VALUE",
                experiment_group=SkillRankingExperimentGroup.GROUP_2,
                correct_rotations=CORRECT_ROTATIONS_THRESHOLD_FOR_GROUP_SWITCH + 1
                # More than threshold to trigger group switch
            )

            _mock_skills_ranking_state_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            _mock_skills_ranking_state_repository.update = AsyncMock(return_value=existing_state)
            _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

            given_high_difference_threshold = 0.5
            given_correct_rotations_threshold_for_group_switch = 30
            service = SkillsRankingStateService(
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                get_test_registration_data_repository(),
                get_test_application_state_manager(),
                get_test_http_client(),
                given_high_difference_threshold,
                given_correct_rotations_threshold_for_group_switch
            )

            # WHEN the random check triggers (5% chance) and user transitions to MARKET_DISCLOSURE
            with patch('random.random', return_value=0.03):  # 3% < 5%, so should trigger
                await service.upsert_state(
                    session_id=1,
                    update_request=UpdateSkillsRankingRequest(phase="MARKET_DISCLOSURE"),
                    user_id="test_user"
                )

            # THEN the experiment group should be updated to GROUP_3 (information)
            _mock_skills_ranking_state_repository.update.assert_called_once_with(
                session_id=1,
                update_request=UpdateSkillsRankingRequest(
                    phase="MARKET_DISCLOSURE",
                    experiment_group=SkillRankingExperimentGroup.GROUP_3
                )
            )

            # AND user preferences should be updated
            _mock_user_preference_repository.set_experiment_by_user_id.assert_called_once_with(
                user_id="test_user",
                experiment_id="skills_ranking",
                experiment_config="GROUP_3"
            )

        @pytest.mark.asyncio
        async def test_random_group_switch_not_applied_for_other_phases(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository,
                setup_application_config: ApplicationConfig
        ):
            # GIVEN a user in GROUP_2 transitioning from BRIEFING (not PROOF_OF_VALUE)
            existing_state = get_skills_ranking_state(
                session_id=1,
                phase="BRIEFING",
                experiment_group=SkillRankingExperimentGroup.GROUP_2,
                correct_rotations=35
            )

            _mock_skills_ranking_state_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            _mock_skills_ranking_state_repository.update = AsyncMock(return_value=existing_state)
            _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

            given_high_difference_threshold = 0.5
            given_correct_rotations_threshold_for_group_switch = 30
            service = SkillsRankingStateService(
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                get_test_registration_data_repository(),
                get_test_application_state_manager(),
                get_test_http_client(),
                given_high_difference_threshold,
                given_correct_rotations_threshold_for_group_switch
            )

            # WHEN transitioning to PROOF_OF_VALUE
            with patch('random.random', return_value=0.03):  # Would trigger if it were PROOF_OF_VALUE
                await service.upsert_state(
                    session_id=1,
                    update_request=UpdateSkillsRankingRequest(phase="PROOF_OF_VALUE"),
                    user_id="test_user"
                )

            # THEN the experiment group should NOT be updated
            _mock_user_preference_repository.set_experiment_by_user_id.assert_not_called()

        @pytest.mark.asyncio
        async def test_random_group_switch_not_applied_for_other_groups(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository,
                setup_application_config: ApplicationConfig
        ):
            # GIVEN a user in GROUP_1 (not GROUP_2 or GROUP_3) transitioning from PROOF_OF_VALUE
            existing_state = get_skills_ranking_state(
                session_id=1,
                phase="PROOF_OF_VALUE",
                experiment_group=SkillRankingExperimentGroup.GROUP_1,
                correct_rotations=35
            )

            _mock_skills_ranking_state_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            _mock_skills_ranking_state_repository.update = AsyncMock(return_value=existing_state)
            _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

            given_high_difference_threshold = 0.5
            given_correct_rotations_threshold_for_group_switch = 30
            service = SkillsRankingStateService(
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                get_test_registration_data_repository(),
                get_test_application_state_manager(),
                get_test_http_client(),
                given_high_difference_threshold,
                given_correct_rotations_threshold_for_group_switch
            )

            # WHEN transitioning to MARKET_DISCLOSURE
            with patch('random.random', return_value=0.03):  # Would trigger if it were GROUP_2/3
                await service.upsert_state(
                    session_id=1,
                    update_request=UpdateSkillsRankingRequest(phase="MARKET_DISCLOSURE"),
                    user_id="test_user"
                )

            # THEN the experiment group should NOT be updated
            _mock_user_preference_repository.set_experiment_by_user_id.assert_not_called()

        @pytest.mark.asyncio
        async def test_random_group_switch_to_group_2_when_puzzles_solved_low(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository,
                setup_application_config: ApplicationConfig
        ):
            # GIVEN a user in GROUP_3 with puzzles_solved <= PUZZLES_SOLVED_THRESHOLD transitioning from PROOF_OF_VALUE
            existing_state = get_skills_ranking_state(
                session_id=1,
                phase="PROOF_OF_VALUE",
                experiment_group=SkillRankingExperimentGroup.GROUP_3,
                correct_rotations=CORRECT_ROTATIONS_THRESHOLD_FOR_GROUP_SWITCH - 1
                # Below threshold, should switch to GROUP_2
            )

            _mock_skills_ranking_state_repository.get_by_session_id = AsyncMock(return_value=existing_state)
            _mock_skills_ranking_state_repository.update = AsyncMock(return_value=existing_state)
            _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

            given_high_difference_threshold = 0.5
            given_correct_rotations_threshold_for_group_switch = 30
            service = SkillsRankingStateService(
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                get_test_registration_data_repository(),
                get_test_application_state_manager(),
                get_test_http_client(),
                given_high_difference_threshold,
                given_correct_rotations_threshold_for_group_switch
            )

            # WHEN the random check triggers (5% chance) and user transitions to MARKET_DISCLOSURE
            with patch('random.random', return_value=0.03):  # 3% < 5%, so should trigger
                await service.upsert_state(
                    session_id=1,
                    update_request=UpdateSkillsRankingRequest(phase="MARKET_DISCLOSURE"),
                    user_id="test_user"
                )

            # THEN the experiment group should be updated to GROUP_2 (no information)
            _mock_skills_ranking_state_repository.update.assert_called_once_with(
                session_id=1,
                update_request=UpdateSkillsRankingRequest(
                    phase="JOB_SEEKER_DISCLOSURE",
                    experiment_group=SkillRankingExperimentGroup.GROUP_2
                )
            )

            # AND user preferences should be updated
            _mock_user_preference_repository.set_experiment_by_user_id.assert_called_once_with(
                user_id="test_user",
                experiment_id="skills_ranking",
                experiment_config="GROUP_2"
            )

    class TestCalculateRankingAndGroups:

        @pytest.mark.asyncio
        async def test_success(self, _mock_skills_ranking_state_repository, _mock_user_preference_repository,
                               mocker: pytest_mock.MockFixture, setup_application_config: ApplicationConfig):
            # GIVEN a random user id
            given_user_id = get_random_user_id()

            # AND a random session id
            given_session_id = get_random_session_id()

            # AND the prior beliefs will be returned
            given_prior_beliefs = PriorBeliefs(
                external_user_id=get_random_user_id(),
                compare_to_others_prior_belief=random.random(),  # nosec used for testing purposes
                opportunity_rank_prior_belief=random.random(),  # nosec used for testing purposes
            )

            #
            #       Registration Data Repository
            #
            registration_data_repository = get_test_registration_data_repository()
            registration_data_repository_get_prior_beliefs_spy = mocker.patch.object(
                registration_data_repository,
                "get_prior_beliefs",
                AsyncMock(return_value=given_prior_beliefs)
            )

            #
            #       Application State Manager
            #
            application_state_manager = get_test_application_state_manager()
            given_application_state = get_test_application_state(given_session_id)
            application_state_manager_get_state_spy = mocker.patch.object(
                application_state_manager,
                "get_state",
                AsyncMock(return_value=given_application_state)
            )

            # get the origin UUIDs of the top skills from all experiences
            expected_skills_uuids: set[str] = {
                skill.originUUID for experience in
                (given_application_state.explore_experiences_director_state.experiences_state.values()) for skill in
                # we expect both top skills and remaining skills to be included when calculating the ranks
                experience.experience.top_skills + experience.experience.remaining_skills
            }

            #
            #       Ranking Service
            #
            ranking_service = get_test_http_client()
            given_participant_ranks = SkillsRankingScore(
                comparison_rank=random.random(),  # nosec used for testing purposes
                jobs_matching_rank=random.random(),  # nosec used for testing purposes
                comparison_label="given_label",
                calculated_at=datetime.datetime.now()
            )

            http_client_get_participant_ranking_spy = mocker.patch.object(
                ranking_service,
                "get_participant_ranking",
                AsyncMock(return_value=given_participant_ranks)  # Mocking the return value for simplicity
            )

            # AND given random group name
            given_group = random.choice(list(SkillRankingExperimentGroup)) #nosec used for testing purposes

            # AND the skill ranking state service is constructed.
            given_high_difference_threshold = 0.5
            given_correct_rotations_threshold_for_group_switch = 30
            skills_ranking_state_service = SkillsRankingStateService(
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                registration_data_repository,
                application_state_manager,
                ranking_service,
                given_high_difference_threshold,
                given_correct_rotations_threshold_for_group_switch
            )

            get_group_spy = mocker.patch.object(skills_ranking_state_service, "_get_group",
                                                Mock(return_value=given_group))

            # WHEN the calculate_ranking_and_groups method is called
            actual_ranks, actual_group = await skills_ranking_state_service.calculate_ranking_and_groups(given_user_id,
                                                                                                         given_session_id)

            # THEN the group returned should match the given group
            assert actual_group == given_group

            # AND the actual_ranks should be the ones returned by get_participant_ranking normized to percentage
            assert actual_ranks.jobs_matching_rank == round(given_participant_ranks.jobs_matching_rank * 100, 2)
            assert actual_ranks.comparison_rank == round(given_participant_ranks.comparison_rank * 100, 2)

            # AND `_registration_data_repository.get_prior_beliefs` should be called with the given user id
            assert registration_data_repository_get_prior_beliefs_spy.call_count == 1
            assert registration_data_repository_get_prior_beliefs_spy.call_args.kwargs.get("user_id") == given_user_id

            # AND get_application state manager should be called with the given session id
            assert application_state_manager_get_state_spy.call_count == 1
            assert application_state_manager_get_state_spy.call_args.kwargs.get("session_id") == given_session_id

            # AND the http client.get_participant_ranking should be called with the correct parameters
            assert http_client_get_participant_ranking_spy.call_count == 1
            call_args = http_client_get_participant_ranking_spy.call_args
            assert call_args.kwargs.get("user_id") == given_user_id
            assert call_args.kwargs.get("prior_beliefs") == given_prior_beliefs
            assert call_args.kwargs.get("participants_skills_uuids") == expected_skills_uuids

            # AND get_group should be called with the correct parameters
            assert get_group_spy.call_count == 1
            call_args = get_group_spy.call_args
            assert call_args.kwargs.get("self_estimated_rank") == given_prior_beliefs.opportunity_rank_prior_belief
            # AND the actual rank should match the jobs_matching_rank from the actual_ranks but normalized to 100
            assert round(call_args.kwargs.get("actual_rank") * 100, 2) == actual_ranks.jobs_matching_rank

    class TestErrorHandling:
        """Test error handling in the state service."""

        @pytest.mark.asyncio
        async def test_calculate_ranking_and_groups_http_error(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository,
                setup_application_config: ApplicationConfig,
                mocker: pytest_mock.MockFixture
        ):
            # GIVEN a user and session
            given_user_id = get_random_user_id()
            given_session_id = get_random_session_id()

            # AND mocked dependencies
            registration_data_repository = get_test_registration_data_repository()
            application_state_manager = get_test_application_state_manager()
            given_application_state = get_test_application_state(given_session_id)
            
            mocker.patch.object(registration_data_repository, "get_prior_beliefs", AsyncMock(return_value=PriorBeliefs(
                external_user_id=get_random_user_id(),
                compare_to_others_prior_belief=0.5,
                opportunity_rank_prior_belief=0.6,
            )))
            mocker.patch.object(application_state_manager, "get_state", AsyncMock(return_value=given_application_state))

            # AND the HTTP client raises an HTTP error
            ranking_service = get_test_http_client()
            mocker.patch.object(ranking_service, "get_participant_ranking", 
                              AsyncMock(side_effect=SkillsRankingServiceHTTPError(500, "Internal server error")))

            service = SkillsRankingStateService(
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                registration_data_repository,
                application_state_manager,
                ranking_service,
                0.5,
                30
            )

            # WHEN calling calculate_ranking_and_groups
            # THEN a generic error is raised
            with pytest.raises(SkillsRankingGenericError) as exc_info:
                await service.calculate_ranking_and_groups(given_user_id, given_session_id)

            # AND the error message is generic
            assert "Skills ranking service HTTP error" in str(exc_info.value)

        @pytest.mark.asyncio
        async def test_calculate_ranking_and_groups_timeout_error(
                self,
                _mock_skills_ranking_state_repository: ISkillsRankingStateRepository,
                _mock_user_preference_repository: IUserPreferenceRepository,
                setup_application_config: ApplicationConfig,
                mocker: pytest_mock.MockFixture
        ):
            # GIVEN a user and session
            given_user_id = get_random_user_id()
            given_session_id = get_random_session_id()

            # AND mocked dependencies
            registration_data_repository = get_test_registration_data_repository()
            application_state_manager = get_test_application_state_manager()
            given_application_state = get_test_application_state(given_session_id)
            
            mocker.patch.object(registration_data_repository, "get_prior_beliefs", AsyncMock(return_value=PriorBeliefs(
                external_user_id=get_random_user_id(),
                compare_to_others_prior_belief=0.5,
                opportunity_rank_prior_belief=0.6,
            )))
            mocker.patch.object(application_state_manager, "get_state", AsyncMock(return_value=given_application_state))

            # AND the HTTP client raises a timeout error
            ranking_service = get_test_http_client()
            mocker.patch.object(ranking_service, "get_participant_ranking", 
                              AsyncMock(side_effect=SkillsRankingServiceTimeoutError("Request timed out")))

            service = SkillsRankingStateService(
                _mock_skills_ranking_state_repository,
                _mock_user_preference_repository,
                registration_data_repository,
                application_state_manager,
                ranking_service,
                0.5,
                30
            )

            # WHEN calling calculate_ranking_and_groups
            # THEN a generic error is raised
            with pytest.raises(SkillsRankingGenericError) as exc_info:
                await service.calculate_ranking_and_groups(given_user_id, given_session_id)

            # AND the error message is generic
            assert "Skills ranking service timeout" in str(exc_info.value)
