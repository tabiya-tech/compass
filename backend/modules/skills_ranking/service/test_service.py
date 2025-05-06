from typing import cast
from unittest.mock import AsyncMock

import pytest

from app.app_config import ApplicationConfig
from modules.skills_ranking.errors import InvalidNewPhaseError
from modules.skills_ranking.repository.repository import ISkillsRankingRepository
from modules.skills_ranking.service.service import SkillsRankingService
from modules.skills_ranking.service.types import SkillsRankingState, SkillsRankingCurrentState, ExperimentGroup


@pytest.fixture(scope="function")
def _mock_skills_ranking_repository() -> ISkillsRankingRepository:
    class MockSkillsRankingRepository(ISkillsRankingRepository):
        async def get_by_session_id(self, session_id: int) -> SkillsRankingState | None:
            raise NotImplementedError()

        async def create(self, state: SkillsRankingState) -> SkillsRankingState:
            raise NotImplementedError()

        async def update(self, state: SkillsRankingState) -> SkillsRankingState:
            raise NotImplementedError()

    return MockSkillsRankingRepository()


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


class TestSkillsRankingService:
    @pytest.mark.asyncio
    async def test_upsert_state_create(
            self,
            _mock_skills_ranking_repository: ISkillsRankingRepository,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a state to create
        given_state = get_skills_ranking_state()

        # AND all repository methods are mocked
        _mock_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=None)
        _mock_skills_ranking_repository.create = AsyncMock(return_value=given_state)
        _mock_skills_ranking_repository.update = AsyncMock()

        # WHEN upserting the state
        service = SkillsRankingService(_mock_skills_ranking_repository)
        result = await service.upsert_state(given_state)

        # THEN the repository get_by_session_id method is called with the state
        _mock_skills_ranking_repository.get_by_session_id.assert_called_once_with(given_state.session_id)

        # AND then the repository create method is called with the state
        _mock_skills_ranking_repository.create.assert_called_once_with(given_state)

        # AND the repository update method is not called
        _mock_skills_ranking_repository.update.assert_not_called()

        # AND the result is the created state
        assert result == given_state

    @pytest.mark.asyncio
    async def test_upsert_state_update_valid_transition(
            self,
            _mock_skills_ranking_repository: ISkillsRankingRepository,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN an existing state
        existing_state = get_skills_ranking_state(current_state=SkillsRankingCurrentState.INITIAL)

        # AND a new state to update with
        new_state = get_skills_ranking_state(
            current_state=SkillsRankingCurrentState.SELF_EVALUATING,
            ranking="new ranking"
        )

        # AND all repository methods are mocked
        _mock_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
        _mock_skills_ranking_repository.create = AsyncMock()
        _mock_skills_ranking_repository.update = AsyncMock(return_value=new_state)

        # WHEN upserting the state
        service = SkillsRankingService(_mock_skills_ranking_repository)
        result = await service.upsert_state(new_state)

        # THEN the repository get_by_session_id method is called with the state
        _mock_skills_ranking_repository.get_by_session_id.assert_called_once_with(new_state.session_id)

        # AND then the repository update method is called with the state
        _mock_skills_ranking_repository.update.assert_called_once_with(new_state)

        # AND the repository create method is not called
        _mock_skills_ranking_repository.create.assert_not_called()

        # AND the result is the updated state
        assert result == new_state

    @pytest.mark.asyncio
    async def test_upsert_state_update_invalid_transition(
            self,
            _mock_skills_ranking_repository: ISkillsRankingRepository,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN an existing state
        existing_state = get_skills_ranking_state(current_state=SkillsRankingCurrentState.INITIAL)

        # AND a new state with an invalid transition
        new_state = get_skills_ranking_state(
            current_state=SkillsRankingCurrentState.EVALUATED,
            ranking="new ranking"
        )

        # AND all repository methods are mocked
        _mock_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
        _mock_skills_ranking_repository.create = AsyncMock()
        _mock_skills_ranking_repository.update = AsyncMock()

        # WHEN upserting the state
        service = SkillsRankingService(_mock_skills_ranking_repository)

        # THEN an InvalidNewPhaseError is raised
        with pytest.raises(InvalidNewPhaseError):
            await service.upsert_state(new_state)

        # AND the repository is not called to update
        _mock_skills_ranking_repository.update.assert_not_called()

        # AND the repository is not called to create
        _mock_skills_ranking_repository.create.assert_not_called()
