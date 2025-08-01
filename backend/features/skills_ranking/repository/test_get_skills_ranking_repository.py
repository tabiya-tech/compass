import asyncio
import pytest

from features.skills_ranking.db_provider import configure_skills_ranking_db, clear_skills_ranking_db_cache, SkillsRankingDbSettings
from features.skills_ranking.repository.get_skills_ranking_repository import get_skills_ranking_repository


@pytest.fixture(autouse=True)
def setup_and_teardown():
    # Setup: Clear the cache before each test
    clear_skills_ranking_db_cache()
    yield
    # Teardown: Clear the cache after each test
    clear_skills_ranking_db_cache()


class TestGetSkillsRankingRepository:
    @pytest.mark.asyncio
    async def test_get_skills_ranking_repository_concurrent_calls(self):
        # GIVEN the database is configured
        db_settings = SkillsRankingDbSettings(
            mongodb_uri="mongodb://localhost:27017",
            database_name="test_db"
        )
        configure_skills_ranking_db(db_settings)

        # WHEN multiple concurrent calls are made to get the repository
        tasks = [get_skills_ranking_repository() for _ in range(5)]
        repositories = await asyncio.gather(*tasks)

        # THEN all calls return the same repository instance (singleton)
        first_repository = repositories[0]
        for repository in repositories[1:]:
            assert repository is first_repository

    @pytest.mark.asyncio
    async def test_get_skills_ranking_repository_subsequent_calls(self):
        # GIVEN the database is configured
        db_settings = SkillsRankingDbSettings(
            mongodb_uri="mongodb://localhost:27017",
            database_name="test_db"
        )
        configure_skills_ranking_db(db_settings)

        # WHEN multiple subsequent calls are made to get the repository
        repository1 = await get_skills_ranking_repository()
        repository2 = await get_skills_ranking_repository()
        repository3 = await get_skills_ranking_repository()

        # THEN all calls return the same repository instance (singleton)
        assert repository1 is repository2
        assert repository2 is repository3
