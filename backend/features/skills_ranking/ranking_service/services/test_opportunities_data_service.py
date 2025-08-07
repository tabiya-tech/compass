import pytest

from features.skills_ranking.ranking_service.repositories.get_test_classes import get_test_opportunities_data_repository
from features.skills_ranking.ranking_service.services.config import OpportunitiesDataServiceConfig
from features.skills_ranking.ranking_service.services.opportunities_data_service import OpportunitiesDataService


class TestOpportunitiesDataService:

    @pytest.mark.asyncio
    async def test_get_opportunities_skills_uuids_success(self, mocker):
        # GIVEN a list of given_opportunities_skills_uuids
        given_opportunities_skills_uuids = []
        test_opportunities_data_repository = get_test_opportunities_data_repository(given_opportunities_skills_uuids)

        # AND opportunities_data_service is created
        given_config = OpportunitiesDataServiceConfig()
        opportunities_data_service = OpportunitiesDataService(
            test_opportunities_data_repository,
            given_config
        )

        repository_get_opportunities_skills_uuids_spy = mocker.spy(
            test_opportunities_data_repository, "get_opportunities_skills_uuids")

        # WHEN get_opportunities_skills_uuids is called
        actual_result = await opportunities_data_service.get_opportunities_skills_uuids()

        # THEN the result should be equal to the given_opportunities_skills_uuids
        assert actual_result == given_opportunities_skills_uuids

        # AND repository.get_opportunities_skills_uuids should be called with the correct parameters
        repository_get_opportunities_skills_uuids_spy.assert_called_once_with(
            given_config.fetch_opportunities_limit, given_config.fetch_opportunities_batch_size)

    @pytest.mark.asyncio
    async def test_get_opportunities_skills_uuids_throws_an_error(self, mocker):
        # GIVEN an instance of OpportunitiesDataService
        test_opportunities_data_repository = get_test_opportunities_data_repository([])

        opportunities_data_service = OpportunitiesDataService(
            test_opportunities_data_repository,
            OpportunitiesDataServiceConfig()
        )

        class _GivenException(Exception):
            pass

        given_exception = _GivenException("Repository error")
        mocker.patch.object(test_opportunities_data_repository, "get_opportunities_skills_uuids",
                            side_effect=given_exception)

        # WHEN get_opportunities_skills_uuids is called
        with pytest.raises(_GivenException):
            await opportunities_data_service.get_opportunities_skills_uuids()
