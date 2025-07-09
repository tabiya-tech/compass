from datetime import datetime
from typing import cast
from unittest.mock import AsyncMock

import pytest

from app.app_config import ApplicationConfig
from app.users.repositories import IUserPreferenceRepository
from app.users.types import UserPreferences, PossibleExperimentValues
from common_libs.time_utilities import get_now
from features.skills_ranking.errors import InvalidNewPhaseError
from features.skills_ranking.repository.repository import ISkillsRankingRepository
from features.skills_ranking.service.service import SkillsRankingService
from features.skills_ranking.service.types import SkillsRankingState, SkillsRankingPhase, SkillRankingExperimentGroup, SkillsRankingScore


@pytest.fixture(scope="function")
def _mock_skills_ranking_repository() -> ISkillsRankingRepository:
    class MockSkillsRankingRepository(ISkillsRankingRepository):
        async def get_by_session_id(self, session_id: int) -> SkillsRankingState | None:
            raise NotImplementedError()

        async def create(self, state: SkillsRankingState) -> SkillsRankingState:
            raise NotImplementedError()

        async def update(self, *,
                         session_id: int,
                         phase: SkillsRankingPhase | None = None,
                         cancelled_after: float | None = None,
                         perceived_rank_percentile: float | None = None,
                         retyped_rank_percentile: float | None = None,
                         completed_at: datetime | None = None) -> SkillsRankingState:
            raise NotImplementedError()

    return MockSkillsRankingRepository()


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
        phase: SkillsRankingPhase = "INITIAL",
        experiment_group: SkillRankingExperimentGroup = SkillRankingExperimentGroup.GROUP_1
) -> SkillsRankingState:
    return SkillsRankingState(
        session_id=session_id,
        phase=phase,
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
        correct_rotations=1 if phase == "PROOF_OF_VALUE" and (experiment_group == SkillRankingExperimentGroup.GROUP_2 or experiment_group == SkillRankingExperimentGroup.GROUP_3) else None,
        clicks_count=10 if phase == "PROOF_OF_VALUE" and (experiment_group == SkillRankingExperimentGroup.GROUP_2 or experiment_group == SkillRankingExperimentGroup.GROUP_3) else None,
        perceived_rank_percentile=0.1,
        retyped_rank_percentile=0.9
    )


class TestSkillsRankingService:
    @pytest.mark.asyncio
    async def test_upsert_state_create(
            self,
            _mock_skills_ranking_repository: ISkillsRankingRepository,
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
        service = SkillsRankingService(_mock_skills_ranking_repository, _mock_user_preference_repository)
        result = await service.upsert_state(
            session_id=given_state.session_id,
            phase=given_state.phase,
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
            _mock_skills_ranking_repository: ISkillsRankingRepository,
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
        new_state.phase = cast(SkillsRankingPhase, new_phase)
        _mock_skills_ranking_repository.update = AsyncMock(return_value=new_state)

        # AND the set_experiment_by_user_id method will successfully set the experiment groups
        _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

        # WHEN upserting the state
        service = SkillsRankingService(_mock_skills_ranking_repository, _mock_user_preference_repository)
        result = await service.upsert_state(
            session_id=new_state.session_id,
            phase=new_state.phase,
        )

        # THEN the repository get_by_session_id method is called with the state
        _mock_skills_ranking_repository.get_by_session_id.assert_called_once_with(new_state.session_id)

        # AND then the repository update method is called with only the changed fields
        _mock_skills_ranking_repository.update.assert_called_once_with(
            session_id=new_state.session_id,
            phase=new_state.phase,
            cancelled_after=None,
            perceived_rank_percentile=None,
            retyped_rank_percentile=None,
            completed_at=None
        )

        # AND the repository create method is not called
        _mock_skills_ranking_repository.create.assert_not_called()

        # AND the result is the updated state
        assert result == new_state

    @pytest.mark.asyncio
    async def test_upsert_state_update_invalid_transition(
            self,
            _mock_skills_ranking_repository: ISkillsRankingRepository,
            _mock_user_preference_repository: IUserPreferenceRepository,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN an existing state
        existing_state = get_skills_ranking_state(phase="BRIEFING")

        # AND a new state with an invalid transition
        new_state = get_skills_ranking_state(
            phase="COMPLETED"
        )

        # AND all repository methods are mocked
        _mock_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
        _mock_skills_ranking_repository.create = AsyncMock()
        _mock_skills_ranking_repository.update = AsyncMock()

        # AND the set_experiment_by_user_id method will successfully set the experiment groups
        _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

        # WHEN upserting the state
        service = SkillsRankingService(_mock_skills_ranking_repository, _mock_user_preference_repository)

        # THEN an InvalidNewPhaseError is raised
        with pytest.raises(InvalidNewPhaseError):
            await service.upsert_state(
                session_id=new_state.session_id,
                phase=new_state.phase,
            )
        # AND the repository is not called to update
        _mock_skills_ranking_repository.update.assert_not_called()

        # AND the repository is not called to create
        _mock_skills_ranking_repository.create.assert_not_called()
