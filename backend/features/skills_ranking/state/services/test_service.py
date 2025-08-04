from typing import cast
from unittest.mock import AsyncMock, patch

import pytest

from app.app_config import ApplicationConfig
from app.users.repositories import IUserPreferenceRepository
from app.users.types import UserPreferences, PossibleExperimentValues
from common_libs.test_utilities import get_random_user_id
from common_libs.time_utilities import get_now
from features.skills_ranking.errors import InvalidNewPhaseError
from features.skills_ranking.state.repositories.skills_ranking_state_repository import ISkillsRankingStateRepository
from features.skills_ranking.state.services.skills_ranking_state_service import SkillsRankingStateService, \
    CORRECT_ROTATIONS_THRESHOLD_FOR_GROUP_SWITCH
from features.skills_ranking.state.services.test_types import get_test_ranking_service_class, \
    get_test_application_state_manager, get_test_registration_data_repository
from features.skills_ranking.state.services.type import SkillsRankingState, SkillsRankingPhaseName, SkillRankingExperimentGroup, SkillsRankingScore, \
    SkillsRankingPhase, UpdateSkillsRankingRequest


@pytest.fixture(scope="function")
def _mock_skills_ranking_repository() -> ISkillsRankingStateRepository:
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

        async def set_experiment_by_user_id(self, user_id: str, experiment_id: str, experiment_config: dict[str, PossibleExperimentValues]) -> None:
            raise NotImplementedError()

        async def get_experiments_by_user_id(self, user_id: str) -> SkillRankingExperimentGroup | None:
            raise NotImplementedError()

        async def insert_user_preference(self, user_id: str, user_preference: UserPreferences) -> UserPreferences:
            raise NotImplementedError()

    return MockUserPreferenceRepository()


def get_skills_ranking_state(
        session_id: int = 1,
        phase: SkillsRankingPhaseName = "INITIAL",
        experiment_group: SkillRankingExperimentGroup = SkillRankingExperimentGroup.GROUP_1,
        correct_rotations: int | None = None,
) -> SkillsRankingState:
    # Use provided puzzles_solved if specified, otherwise use default logic
    if correct_rotations is None:
        correct_rotations = 2 if phase == "PROOF_OF_VALUE" and (experiment_group == SkillRankingExperimentGroup.GROUP_2 or experiment_group == SkillRankingExperimentGroup.GROUP_3) else None

    return SkillsRankingState(
        session_id=session_id,
        phase=[SkillsRankingPhase(
            name=phase,
            time=get_now()
        )],
        experiment_group=experiment_group,
        score=SkillsRankingScore(
            calculated_at=get_now(),
            jobs_matching_rank=0.0,
            comparison_rank=0.0,
            comparison_label="LOWEST"
        ),
        started_at=get_now(),
        completed_at=None,
        cancelled_after="Fooms",
        succeeded_after="Fooms",
        puzzles_solved=2 if phase == "PROOF_OF_VALUE" and (experiment_group == SkillRankingExperimentGroup.GROUP_2 or experiment_group == SkillRankingExperimentGroup.GROUP_3) else None,
        correct_rotations=correct_rotations,
        clicks_count=10 if phase == "PROOF_OF_VALUE" and (experiment_group == SkillRankingExperimentGroup.GROUP_2 or experiment_group == SkillRankingExperimentGroup.GROUP_3) else None,
        perceived_rank_percentile=0.1,
        retyped_rank_percentile=0.9
    )


class TestSkillsRankingService:
    @pytest.mark.asyncio
    async def test_upsert_state_create(
            self,
            _mock_skills_ranking_repository: ISkillsRankingStateRepository,
            _mock_user_preference_repository: IUserPreferenceRepository,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a state to create
        given_state = get_skills_ranking_state()

        # AND all repository methods are mocked
        _mock_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=None)
        _mock_skills_ranking_repository.create = AsyncMock(return_value=given_state)
        _mock_skills_ranking_repository.update = AsyncMock()

        # AND the set_experiment_by_user_id method will successfully set the experiment groups
        _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

        # WHEN upserting the state
        service = SkillsRankingStateService(_mock_skills_ranking_repository,
                                            _mock_user_preference_repository,
                                            get_test_registration_data_repository(),
                                            get_test_application_state_manager(),
                                            get_test_ranking_service_class(),
                                            0.5)
        result = await service.upsert_state(
            user_id=get_random_user_id(),
            session_id=given_state.session_id,
            update_request=UpdateSkillsRankingRequest(phase="INITIAL"),
        )

        # THEN the repository get_by_session_id method is called with the state
        _mock_skills_ranking_repository.get_by_session_id.assert_called_once_with(given_state.session_id)

        # AND then the repository create method is called with the state
        _mock_skills_ranking_repository.create.assert_called_once()

        # AND the repository update method is not called
        _mock_skills_ranking_repository.update.assert_not_called()

        # AND the result is the created state
        assert result == given_state

    @pytest.mark.asyncio
    async def test_upsert_state_update_valid_transition(
            self,
            _mock_skills_ranking_repository: ISkillsRankingStateRepository,
            _mock_user_preference_repository: IUserPreferenceRepository,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN an existing state
        existing_state = get_skills_ranking_state(phase="INITIAL")

        # AND a new phase to update to
        new_phase = "BRIEFING"

        # AND all repository methods are mocked
        _mock_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
        _mock_skills_ranking_repository.create = AsyncMock()
        new_state = existing_state.model_copy(deep=True)
        new_state.phase.append(SkillsRankingPhase(
            name=cast(SkillsRankingPhaseName, new_phase),
            time=get_now()
        ))
        _mock_skills_ranking_repository.update = AsyncMock(return_value=new_state)

        # AND the set_experiment_by_user_id method will successfully set the experiment groups
        _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

        # WHEN upserting the state
        service = SkillsRankingStateService(_mock_skills_ranking_repository,
                                            _mock_user_preference_repository,
                                            get_test_registration_data_repository(),
                                            get_test_application_state_manager(),
                                            get_test_ranking_service_class(),
                                            0.5)
        result = await service.upsert_state(
            user_id=get_random_user_id(),
            session_id=new_state.session_id,
            update_request=UpdateSkillsRankingRequest(phase=cast(SkillsRankingPhaseName, new_phase)),
        )

        # THEN the repository get_by_session_id method is called with the state
        _mock_skills_ranking_repository.get_by_session_id.assert_called_once_with(new_state.session_id)

        # AND then the repository update method is called with only the changed fields
        _mock_skills_ranking_repository.update.assert_called_once()
        call_args = _mock_skills_ranking_repository.update.call_args
        assert call_args.kwargs["session_id"] == new_state.session_id
        assert call_args.kwargs["update_request"].phase == new_phase

        # AND the repository create method is not called
        _mock_skills_ranking_repository.create.assert_not_called()

        # AND the result is the updated state
        assert result == new_state

    @pytest.mark.asyncio
    async def test_upsert_state_update_invalid_transition(
            self,
            _mock_skills_ranking_repository: ISkillsRankingStateRepository,
            _mock_user_preference_repository: IUserPreferenceRepository,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN an existing state
        existing_state = get_skills_ranking_state(phase="BRIEFING")

        # AND a new phase with an invalid transition
        new_phase = "COMPLETED"

        # AND all repository methods are mocked
        _mock_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
        _mock_skills_ranking_repository.create = AsyncMock()
        _mock_skills_ranking_repository.update = AsyncMock()

        # AND the set_experiment_by_user_id method will successfully set the experiment groups
        _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

        # WHEN upserting the state
        service = SkillsRankingStateService(_mock_skills_ranking_repository,
                                            _mock_user_preference_repository,
                                            get_test_registration_data_repository(),
                                            get_test_application_state_manager(),
                                            get_test_ranking_service_class(),
                                            0.5)

        # THEN an InvalidNewPhaseError is raised
        with pytest.raises(InvalidNewPhaseError):
            await service.upsert_state(
                user_id=get_random_user_id(),
                session_id=existing_state.session_id,
                update_request=UpdateSkillsRankingRequest(phase=cast(SkillsRankingPhaseName, new_phase)),
            )
        # AND the repository is not called to update
        _mock_skills_ranking_repository.update.assert_not_called()

        # AND the repository is not called to create
        _mock_skills_ranking_repository.create.assert_not_called()

    @pytest.mark.asyncio
    async def test_random_group_switch_during_proof_of_value_transition(
            self,
            _mock_skills_ranking_repository: ISkillsRankingStateRepository,
            _mock_user_preference_repository: IUserPreferenceRepository,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a user in GROUP_2 with puzzles_solved > PUZZLES_SOLVED_THRESHOLD transitioning from PROOF_OF_VALUE
        existing_state = get_skills_ranking_state(
            session_id=1,
            phase="PROOF_OF_VALUE",
            experiment_group=SkillRankingExperimentGroup.GROUP_2,
            correct_rotations=CORRECT_ROTATIONS_THRESHOLD_FOR_GROUP_SWITCH + 1  # More than threshold to trigger group switch
        )


        _mock_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
        _mock_skills_ranking_repository.update = AsyncMock(return_value=existing_state)
        _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

        service = SkillsRankingStateService(_mock_skills_ranking_repository,
                                            _mock_user_preference_repository,
                                            get_test_registration_data_repository(),
                                            get_test_application_state_manager(),
                                            get_test_ranking_service_class(),
                                            0.5)

        # WHEN the random check triggers (5% chance) and user transitions to MARKET_DISCLOSURE
        with patch('random.random', return_value=0.03):  # 3% < 5%, so should trigger
            result = await service.upsert_state(
                session_id=1,
                update_request=UpdateSkillsRankingRequest(phase="MARKET_DISCLOSURE"),
                user_id="test_user"
            )

        # THEN the experiment group should be updated to GROUP_3 (information)
        _mock_skills_ranking_repository.update.assert_called_once_with(
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
            _mock_skills_ranking_repository: ISkillsRankingStateRepository,
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

        _mock_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
        _mock_skills_ranking_repository.update = AsyncMock(return_value=existing_state)
        _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

        service = SkillsRankingStateService(_mock_skills_ranking_repository,
                                            _mock_user_preference_repository,
                                            get_test_registration_data_repository(),
                                            get_test_application_state_manager(),
                                            get_test_ranking_service_class(),
                                            0.5)

        # WHEN transitioning to PROOF_OF_VALUE
        with patch('random.random', return_value=0.03):  # Would trigger if it were PROOF_OF_VALUE
            result = await service.upsert_state(
                session_id=1,
                update_request=UpdateSkillsRankingRequest(phase="PROOF_OF_VALUE"),
                user_id="test_user"
            )

        # THEN the experiment group should NOT be updated
        _mock_user_preference_repository.set_experiment_by_user_id.assert_not_called()

    @pytest.mark.asyncio
    async def test_random_group_switch_not_applied_for_other_groups(
            self,
            _mock_skills_ranking_repository: ISkillsRankingStateRepository,
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

        _mock_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
        _mock_skills_ranking_repository.update = AsyncMock(return_value=existing_state)
        _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

        service = SkillsRankingStateService(_mock_skills_ranking_repository,
                                            _mock_user_preference_repository,
                                            get_test_registration_data_repository(),
                                            get_test_application_state_manager(),
                                            get_test_ranking_service_class(),
                                            0.5)

        # WHEN transitioning to MARKET_DISCLOSURE
        with patch('random.random', return_value=0.03):  # Would trigger if it were GROUP_2/3
            result = await service.upsert_state(
                session_id=1,
                update_request=UpdateSkillsRankingRequest(phase="MARKET_DISCLOSURE"),
                user_id="test_user"
            )

        # THEN the experiment group should NOT be updated
        _mock_user_preference_repository.set_experiment_by_user_id.assert_not_called()

    @pytest.mark.asyncio
    async def test_random_group_switch_to_group_2_when_puzzles_solved_low(
            self,
            _mock_skills_ranking_repository: ISkillsRankingStateRepository,
            _mock_user_preference_repository: IUserPreferenceRepository,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a user in GROUP_3 with puzzles_solved <= PUZZLES_SOLVED_THRESHOLD transitioning from PROOF_OF_VALUE
        existing_state = get_skills_ranking_state(
            session_id=1,
            phase="PROOF_OF_VALUE",
            experiment_group=SkillRankingExperimentGroup.GROUP_3,
            correct_rotations=CORRECT_ROTATIONS_THRESHOLD_FOR_GROUP_SWITCH - 1  # Below threshold, should switch to GROUP_2
        )

        _mock_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
        _mock_skills_ranking_repository.update = AsyncMock(return_value=existing_state)
        _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

        service = SkillsRankingStateService(_mock_skills_ranking_repository,
                                            _mock_user_preference_repository,
                                            get_test_registration_data_repository(),
                                            get_test_application_state_manager(),
                                            get_test_ranking_service_class(),
                                            0.5)

        # WHEN the random check triggers (5% chance) and user transitions to MARKET_DISCLOSURE
        with patch('random.random', return_value=0.03):  # 3% < 5%, so should trigger
            result = await service.upsert_state(
                session_id=1,
                update_request=UpdateSkillsRankingRequest(phase="MARKET_DISCLOSURE"),
                user_id="test_user"
            )

        # THEN the experiment group should be updated to GROUP_2 (no information)
        _mock_skills_ranking_repository.update.assert_called_once_with(
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
