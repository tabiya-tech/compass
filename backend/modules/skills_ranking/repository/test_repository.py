from typing import Awaitable

import pytest

from app.app_config import ApplicationConfig
from modules.skills_ranking.repository.repository import SkillsRankingRepository
from modules.skills_ranking.service.types import SkillsRankingState, SkillsRankingCurrentState


@pytest.fixture(scope="function")
async def get_skills_ranking_repository(in_memory_application_database) -> SkillsRankingRepository:
    application_db = await in_memory_application_database
    return SkillsRankingRepository(db=application_db)


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
        experiment_group=experiment_group,
        ranking=ranking,
        self_ranking=self_ranking
    )


def _assert_skills_ranking_state_fields_match(given_state: SkillsRankingState, actual_stored_state: dict) -> None:
    # Remove MongoDB _id if present
    actual_stored_state.pop("_id", None)

    for field, value in given_state.model_dump().items():
        if field == "current_state":
            # Special case for current_state which is an Enum
            assert actual_stored_state[field] == value.value
        else:
            assert actual_stored_state[field] == value


class TestSkillsRankingRepository:
    @pytest.mark.asyncio
    async def test_get_by_session_id_not_found(
            self,
            get_skills_ranking_repository: Awaitable[SkillsRankingRepository],
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a repository
        repository = await get_skills_ranking_repository

        # WHEN getting a non-existent state
        state = await repository.get_by_session_id(1)

        # THEN the state is None
        assert state is None

    @pytest.mark.asyncio
    async def test_get_by_session_id_found(
            self,
            get_skills_ranking_repository: Awaitable[SkillsRankingRepository],
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a repository
        repository = await get_skills_ranking_repository

        # AND a state in the database
        given_state = get_skills_ranking_state()
        await repository.create(given_state)

        # WHEN getting the state
        state = await repository.get_by_session_id(1)

        # THEN the state is returned
        assert state is not None
        assert state.session_id == given_state.session_id
        assert state.current_state == given_state.current_state

    @pytest.mark.asyncio
    async def test_create_success(
            self,
            get_skills_ranking_repository: Awaitable[SkillsRankingRepository],
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a repository
        repository = await get_skills_ranking_repository

        # AND a state to create
        given_state = get_skills_ranking_state()

        # WHEN creating the state
        await repository.create(given_state)

        # THEN the state is created in the database
        assert await repository._collection.count_documents({}) == 1

        # AND the state data matches what we expect
        actual_stored_state = await repository._collection.find_one({})
        _assert_skills_ranking_state_fields_match(given_state, actual_stored_state)

    @pytest.mark.asyncio
    async def test_update_success(
            self,
            get_skills_ranking_repository: Awaitable[SkillsRankingRepository],
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a repository
        repository = await get_skills_ranking_repository

        # AND an existing state
        given_state = get_skills_ranking_state()
        await repository.create(given_state)

        # AND a new state to update with
        new_state = get_skills_ranking_state(
            current_state=SkillsRankingCurrentState.SELF_EVALUATING,
            ranking="new ranking"
        )

        # WHEN updating the state
        await repository.update(new_state)

        # THEN the state is updated in the database
        assert await repository._collection.count_documents({}) == 1

        # AND the state data matches what we expect
        actual_stored_state = await repository._collection.find_one({})
        _assert_skills_ranking_state_fields_match(new_state, actual_stored_state)
