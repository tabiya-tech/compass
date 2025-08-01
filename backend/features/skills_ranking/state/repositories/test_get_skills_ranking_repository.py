import asyncio
import pytest

from conftest import random_db_name
from features.skills_ranking.state.repositories.get_skills_ranking_state_db import clear_skills_ranking_db_cache
from features.skills_ranking.state.repositories.get_skills_ranking_state_repository import \
    get_skills_ranking_state_mongo_repository


@pytest.fixture(autouse=True)
def setup_and_teardown():
    # Setup: Clear the cache before each test
    clear_skills_ranking_db_cache()
    yield
    # Teardown: Clear the cache after each test
    clear_skills_ranking_db_cache()


class TestGetSkillsRankingRepository:
    @pytest.mark.asyncio
    async def test_get_skills_ranking_repository_concurrent_calls(self, in_memory_skills_ranking_state_db, setup_skills_ranking_feature_config):
        # GIVEN the database is configured
        # WHEN multiple concurrent calls are made to get the repository
        tasks = [get_skills_ranking_state_mongo_repository(in_memory_skills_ranking_state_db, random_db_name()) for _ in range(5)]
        repositories = await asyncio.gather(*tasks)

        # THEN all calls return the same repository instance (singleton)
        first_repository = repositories[0]
        for repository in repositories[1:]:
            assert repository is first_repository

    @pytest.mark.asyncio
    async def test_get_skills_ranking_repository_subsequent_calls(self, setup_skills_ranking_feature_config):
        # GIVEN the database is configured
        # WHEN multiple subsequent calls are made to get the repository
        repository1 = await get_skills_ranking_state_mongo_repository()
        repository2 = await get_skills_ranking_state_mongo_repository()
        repository3 = await get_skills_ranking_state_mongo_repository()

        # THEN all calls return the same repository instance (singleton)
        assert repository1 is repository2
        assert repository2 is repository3
