import asyncio
from datetime import datetime, timedelta

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


class TestCachingMechanismForOpportunitiesDataService:
    @pytest.mark.asyncio
    async def test_sequential_access(self, mocker):
        # GIVEN an instance of OpportunitiesDataService
        test_opportunities_data_repository = get_test_opportunities_data_repository([])
        repository_get_opportunities_skills_uuids_spy = mocker.patch.object(
            test_opportunities_data_repository, "get_opportunities_skills_uuids",
            return_value=[{"skill1", "skill2"}, {"skill3", "skill4"}])

        opportunities_data_service = OpportunitiesDataService(
            test_opportunities_data_repository,
            OpportunitiesDataServiceConfig()
        )

        # WHEN get_opportunities_skills_uuids is called sequentially
        first_access = await opportunities_data_service.get_opportunities_skills_uuids()
        first_access_version = opportunities_data_service._cache_manager._last_fetch_time

        second_access = await opportunities_data_service.get_opportunities_skills_uuids()
        second_access_version = opportunities_data_service._cache_manager._last_fetch_time

        # THEN the results should be the same
        assert first_access == second_access
        assert first_access_version == second_access_version

        # AND repository.get_opportunities_skills_uuids should be called only once
        repository_get_opportunities_skills_uuids_spy.assert_called_once()

    @pytest.mark.asyncio
    async def test_concurrent_access(self, mocker):
        # GIVEN an instance of OpportunitiesDataService
        test_opportunities_data_repository = get_test_opportunities_data_repository([])
        repository_get_opportunities_skills_uuids_spy = mocker.patch.object(
            test_opportunities_data_repository, "get_opportunities_skills_uuids",
            return_value=[{"skill1", "skill2"}, {"skill3", "skill4"}])

        opportunities_data_service = OpportunitiesDataService(
            test_opportunities_data_repository,
            OpportunitiesDataServiceConfig()
        )

        # WHEN get_opportunities_skills_uuids is called concurrently
        tasks = [opportunities_data_service.get_opportunities_skills_uuids() for _ in range(10)]
        results = await asyncio.gather(*tasks)

        # THEN all results should be the same
        assert all(result == results[0] for result in results)

        # AND repository.get_opportunities_skills_uuids should be called only once
        repository_get_opportunities_skills_uuids_spy.assert_called_once()

    @pytest.mark.asyncio
    async def test_stale_data_access(self, mocker):
        # GIVEN an instance of OpportunitiesDataService
        test_opportunities_data_repository = get_test_opportunities_data_repository([])
        repository_get_opportunities_skills_uuids_spy = mocker.patch.object(
            test_opportunities_data_repository, "get_opportunities_skills_uuids")
        opportunities_data_service = OpportunitiesDataService(
            test_opportunities_data_repository,
            OpportunitiesDataServiceConfig(opportunities_data_stale_time=10)
        )

        # GUARD that the service is not fetching data initially
        assert opportunities_data_service._cache_manager._fetching_task is None

        # AND the _hot_cache is empty
        assert opportunities_data_service._cache_manager._cached_value is None

        # AND the _cold_cache is empty
        assert opportunities_data_service._cache_manager._cached_value is None

        # AND repository.get_opportunities_skills_uuids will return the first version of the data
        given_first_db_version = [{"skill1"}]
        repository_get_opportunities_skills_uuids_spy.return_value = given_first_db_version

        # WHEN get_opportunities_skills_uuids is called for the first time
        actual_first_access_data = await opportunities_data_service.get_opportunities_skills_uuids()
        first_last_fetch_time = opportunities_data_service._cache_manager._last_fetch_time

        # THEN there should be no pending background task
        assert opportunities_data_service._cache_manager._fetching_task is None

        # AND the first access should return the initial data
        assert actual_first_access_data == given_first_db_version

        # AND the _hot_cache should be set with the first access data
        assert opportunities_data_service._cache_manager._cached_value == given_first_db_version

        # GIVEN the data in memory is stale
        #   BY: Simulate stale data by setting last fetch time to a pastime
        opportunities_data_service._cache_manager._last_fetch_time = datetime.now() - timedelta(hours=1)

        # AND repository.get_opportunities_skills_uuids will return a different version of the data
        given_second_db_version = [{"skill2"}]
        repository_get_opportunities_skills_uuids_spy.return_value = given_second_db_version

        # WHEN get_opportunities_skills_uuids is called again for the second time
        actual_second_access_data = await opportunities_data_service.get_opportunities_skills_uuids()

        # THEN the results should be the same as the first db version (hot cache is used).
        # The data is stale, and we don't want to wait for the background task to complete.
        # We return the stale data and initiate a background task to fetch new data.
        assert actual_second_access_data == given_first_db_version

        # AND there would be a pending background task to fetch new data in the background
        assert opportunities_data_service._cache_manager._fetching_task is not None
        # GIVEN the background task is running and has completed fetching new data
        await opportunities_data_service._cache_manager._fetching_task
        second_last_fetch_time = opportunities_data_service._cache_manager._last_fetch_time

        # WHEN get_opportunities_skills_uuids is called again for the third time
        actual_second_third_data = await opportunities_data_service.get_opportunities_skills_uuids()

        # THEN the third access should return the second db version (new data fetched)
        assert actual_second_third_data == given_second_db_version

        # AND the third access should update the last fetch time
        assert second_last_fetch_time > first_last_fetch_time

        # AND the _hot_cache should be updated with the new data
        assert opportunities_data_service._cache_manager._cached_value == given_second_db_version
