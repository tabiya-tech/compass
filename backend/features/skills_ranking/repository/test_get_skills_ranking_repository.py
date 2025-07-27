import asyncio

import pytest
import pytest_mock

from features.skills_ranking.repository.get_skills_ranking_repository import get_skills_ranking_repository
from features.skills_ranking.db_provider import SkillsRankingDBProvider, SkillsRankingDbSettings


@pytest.mark.asyncio
class TestGetSkillsRankingRepository:
    def teardown_method(self):
        import features.skills_ranking.repository.get_skills_ranking_repository
        features.skills_ranking.repository.get_skills_ranking_repository._skills_ranking_repository_singleton = None
        SkillsRankingDBProvider.clear_cache()

    async def test_get_skills_ranking_repository_concurrent_calls(self, mocker: pytest_mock.MockFixture):
        # GIVEN skills ranking database provider is configured
        db_settings = SkillsRankingDbSettings(
            mongodb_uri="mongodb://localhost:27017",
            database_name="test_db"
        )
        SkillsRankingDBProvider.configure(db_settings)

        # WHEN get_skills_ranking_repository is called concurrently
        repository_instance_1, repository_instance_2 = await asyncio.gather(
            get_skills_ranking_repository(),
            get_skills_ranking_repository()
        )

        # THEN the repository should not be None
        assert repository_instance_1 is not None
        assert repository_instance_2 is not None

        # AND they should refer to the same repository
        assert repository_instance_1 == repository_instance_2

    async def test_get_skills_ranking_repository_subsequent_calls(self, mocker: pytest_mock.MockFixture):
        # GIVEN skills ranking database provider is configured
        db_settings = SkillsRankingDbSettings(
            mongodb_uri="mongodb://localhost:27017",
            database_name="test_db"
        )
        SkillsRankingDBProvider.configure(db_settings)

        # WHEN get_skills_ranking_repository is called subsequently
        repository_instance_1 = await get_skills_ranking_repository()
        repository_instance_2 = await get_skills_ranking_repository()

        # THEN the repository should not be None
        assert repository_instance_1 is not None
        assert repository_instance_2 is not None

        # AND they should refer to the same repository
        assert repository_instance_1 == repository_instance_2
