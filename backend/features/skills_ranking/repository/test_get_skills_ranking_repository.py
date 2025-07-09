import asyncio

import pytest
import pytest_mock

from features.skills_ranking.repository.get_skills_ranking_repository import get_skills_ranking_repository


@pytest.mark.asyncio
class TestGetSkillsRankingRepository:
    def teardown_method(self):
        import features.skills_ranking.repository.get_skills_ranking_repository
        features.skills_ranking.repository.get_skills_ranking_repository._skills_ranking_repository_singleton = None

    async def test_get_skills_ranking_repository_concurrent_calls(self, mocker: pytest_mock.MockFixture):
        # GIVEN random in-memory application database
        _in_memory_application_database = mocker.MagicMock()
        _in_memory_collection = mocker.MagicMock()
        _in_memory_application_database.get_collection.return_value = _in_memory_collection

        # WHEN get_skills_ranking_repository is called concurrently
        repository_instance_1, repository_instance_2 = await asyncio.gather(
            get_skills_ranking_repository(application_db=_in_memory_application_database),
            get_skills_ranking_repository(application_db=_in_memory_application_database)
        )

        # THEN the repository should not be None
        assert repository_instance_1 is not None
        assert repository_instance_2 is not None

        # AND they should refer to the same repository
        assert repository_instance_1 == repository_instance_2

        # AND it should connect to the right database collection
        assert repository_instance_1._collection == _in_memory_collection  # type: ignore

    async def test_get_skills_ranking_repository_subsequent_calls(self, mocker: pytest_mock.MockFixture):
        # GIVEN random in-memory application database
        _in_memory_application_database = mocker.MagicMock()
        _in_memory_collection = mocker.MagicMock()
        _in_memory_application_database.get_collection.return_value = _in_memory_collection

        # WHEN get_skills_ranking_repository is called subsequently
        repository_instance_1 = await get_skills_ranking_repository(
            application_db=_in_memory_application_database)

        repository_instance_2 = await get_skills_ranking_repository(
            application_db=_in_memory_application_database)

        # THEN the repository should not be None
        assert repository_instance_1 is not None
        assert repository_instance_2 is not None

        # AND they should refer to the same repository
        assert repository_instance_1 == repository_instance_2

        # AND it should connect to the right database collection
        assert repository_instance_1._collection == _in_memory_collection  # type: ignore
