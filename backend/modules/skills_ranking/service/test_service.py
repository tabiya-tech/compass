from unittest.mock import AsyncMock

import pytest

from app.app_config import ApplicationConfig
from app.users.repositories import IUserPreferenceRepository
from app.users.types import UserPreferences, PossibleExperimentValues
from modules.skills_ranking.errors import InvalidNewPhaseError
from modules.skills_ranking.repository.repository import ISkillsRankingRepository
from modules.skills_ranking.service.service import SkillsRankingService
from modules.skills_ranking.service.types import SkillsRankingState, SkillsRankingPhase, SkillRankingExperimentGroups


@pytest.fixture(scope="function")
def _mock_skills_ranking_repository() -> ISkillsRankingRepository:
    class MockSkillsRankingRepository(ISkillsRankingRepository):
        async def get_by_session_id(self, session_id: int) -> SkillsRankingState | None:
            raise NotImplementedError()

        async def create(self, state: SkillsRankingState) -> SkillsRankingState:
            raise NotImplementedError()

        async def update(self, *, session_id: int, experiment_groups: SkillRankingExperimentGroups | None = None, phase: SkillsRankingPhase | None = None,
                         ranking: str | None = None,
                         self_ranking: str | None = None) -> SkillsRankingState:
            raise NotImplementedError()

    return MockSkillsRankingRepository()


@pytest.fixture(scope="function")
def _mock_user_preference_repository() -> IUserPreferenceRepository:
    class MockUserPreferenceRepository(IUserPreferenceRepository):
        async def get_by_session_id(self, session_id: int) -> UserPreferences | None:
            raise NotImplementedError()

        async def update_user_preference(self, *, session_id: int, user_id: str | None = None,
                                         experiment_groups: SkillRankingExperimentGroups | None = None) -> UserPreferences:
            raise NotImplementedError()

        async def get_user_preference_by_user_id(self, user_id: str) -> UserPreferences | None:
            raise NotImplementedError()

        async def get_experiments_by_user_ids(self, user_ids: list[str]) -> list[UserPreferences]:
            raise NotImplementedError()

        async def set_experiment_by_user_id(self, user_id: str, experiment_id: str, experiment_config: dict[str, PossibleExperimentValues]) -> None:
            raise NotImplementedError()

        async def get_experiments_by_user_id(self, user_id: str) -> SkillRankingExperimentGroups | None:
            raise NotImplementedError()

        async def insert_user_preference(self, user_id: str, user_preference: UserPreferences) -> UserPreferences:
            raise NotImplementedError()

    return MockUserPreferenceRepository()


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
        existing_state = get_skills_ranking_state()

        # AND a new state to update with
        new_state = get_skills_ranking_state(
            phase=SkillsRankingPhase.SELF_EVALUATING,
            ranking="new ranking"
        )

        # AND all repository methods are mocked
        _mock_skills_ranking_repository.get_by_session_id = AsyncMock(return_value=existing_state)
        _mock_skills_ranking_repository.create = AsyncMock()
        _mock_skills_ranking_repository.update = AsyncMock(return_value=new_state)

        # AND the set_experiment_by_user_id method will successfully set the experiment groups
        _mock_user_preference_repository.set_experiment_by_user_id = AsyncMock()

        # WHEN upserting the state
        service = SkillsRankingService(_mock_skills_ranking_repository, _mock_user_preference_repository)
        result = await service.upsert_state(
            session_id=new_state.session_id,
            phase=new_state.phase,
            experiment_groups=new_state.experiment_groups,
            ranking=new_state.ranking,
            self_ranking=new_state.self_ranking
        )

        # THEN the repository get_by_session_id method is called with the state
        _mock_skills_ranking_repository.get_by_session_id.assert_called_once_with(new_state.session_id)

        # AND then the repository update method is called with only the changed fields
        _mock_skills_ranking_repository.update.assert_called_once_with(
            session_id=new_state.session_id,
            phase=new_state.phase,
            experiment_groups=new_state.experiment_groups,
            ranking=new_state.ranking,
            self_ranking=new_state.self_ranking
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
        existing_state = get_skills_ranking_state(phase=SkillsRankingPhase.INITIAL)

        # AND a new state with an invalid transition
        new_state = get_skills_ranking_state(
            phase=SkillsRankingPhase.EVALUATED,
            ranking="new ranking"
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
                experiment_groups=new_state.experiment_groups,
                ranking=new_state.ranking,
                self_ranking=new_state.self_ranking
            )

        # AND the repository is not called to update
        _mock_skills_ranking_repository.update.assert_not_called()

        # AND the repository is not called to create
        _mock_skills_ranking_repository.create.assert_not_called()

    @pytest.mark.todo
    @pytest.mark.asyncio
    async def test_get_ranking_when_state_exists(
            self,
            _mock_skills_ranking_repository: ISkillsRankingRepository,
            setup_application_config: ApplicationConfig
    ):
        # TODO: Implement test once external ranking service is available
        pass

    @pytest.mark.todo
    @pytest.mark.asyncio
    async def test_get_ranking_when_state_does_not_exist(
            self,
            _mock_skills_ranking_repository: ISkillsRankingRepository,
            setup_application_config: ApplicationConfig
    ):
        # TODO: Implement test once external ranking service is available
        pass

    @pytest.mark.todo
    @pytest.mark.asyncio
    async def test_get_ranking_when_ranking_is_none(
            self,
            _mock_skills_ranking_repository: ISkillsRankingRepository,
            setup_application_config: ApplicationConfig
    ):
        # TODO: Implement test once external ranking service is available
        pass
