import asyncio

import pytest
import pytest_mock

from features.skills_ranking.repository.repository import ISkillsRankingRepository
from features.skills_ranking.service.get_skills_ranking_service import get_skills_ranking_service


@pytest.mark.asyncio
class TestGetSkillsRankingService:
    def setup_method(self):
        import features.skills_ranking.service.get_skills_ranking_service
        features.skills_ranking.service.get_skills_ranking_service._skills_ranking_service_singleton = None

    async def test_get_skills_ranking_service_concurrent_calls(self, mocker: pytest_mock.MockFixture):
        # GIVEN a mocked repository
        mock_repository = mocker.MagicMock(spec=ISkillsRankingRepository)

        # WHEN get_skills_ranking_service is called concurrently
        service_instance_1, service_instance_2 = await asyncio.gather(
            get_skills_ranking_service(repository=mock_repository),
            get_skills_ranking_service(repository=mock_repository)
        )

        # THEN the service should not be None and they should refer to the same instance
        assert service_instance_1 is not None
        assert service_instance_2 is not None

        # AND they should refer to the same service
        assert service_instance_1 == service_instance_2

        # AND it should use the right repository
        assert service_instance_1._repository == mock_repository  # type: ignore

    async def test_get_skills_ranking_service_subsequent_calls(self, mocker: pytest_mock.MockFixture):
        # GIVEN a mocked repository
        mock_repository = mocker.MagicMock(spec=ISkillsRankingRepository)

        # WHEN get_skills_ranking_service is called subsequently
        service_instance_1 = await get_skills_ranking_service(repository=mock_repository)
        service_instance_2 = await get_skills_ranking_service(repository=mock_repository)

        # THEN the service should not be None and they should refer to the same instance
        assert service_instance_1 is not None
        assert service_instance_2 is not None

        # AND they should refer to the same service
        assert service_instance_1 == service_instance_2

        # AND it should use the right repository
        assert service_instance_1._repository == mock_repository  # type: ignore
