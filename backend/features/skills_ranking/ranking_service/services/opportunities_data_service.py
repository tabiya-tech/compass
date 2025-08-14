import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Optional

from features.skills_ranking.ranking_service.repositories.types import IOpportunitiesDataRepository
from features.skills_ranking.ranking_service.services.config import OpportunitiesDataServiceConfig


class FailedToFetchOpportunitiesDataException(Exception):
    def __init__(self):
        self.message = "Failed to fetch opportunities data. Please try again later."


class IOpportunitiesDataService(ABC):
    """
    Interface for opportunity data service to manage skill data from opportunities.
    """

    @abstractmethod
    async def get_opportunities_skills_uuids(self) -> list[set[str]]:
        """
        Get skills from opportunity data.
        :return: The list of sets of skills UUIDs from opportunities.
        :raises Exception: If an error fetching skills from opportunities.
        """
        raise NotImplementedError


class OpportunitiesDataService(IOpportunitiesDataService):
    def __init__(self, opportunities_data_repository: IOpportunitiesDataRepository,
                 config: OpportunitiesDataServiceConfig):
        self._opportunities_data_repository = opportunities_data_repository

        # service options and utilities
        self._logger = logging.getLogger(self.__class__.__name__)
        self._config = config

        # caching system variables
        self._hot_cache: Optional[list[set[str]]] = None
        """
        the hot cache is the one that is used to serve requests in real time.
        """

        self._cold_cache: Optional[list[set[str]]] = None
        """
        The cold cache is used to fetch new data in the background, and it is later swapped with the hot cache.
        """

        self._last_fetch_time: Optional[datetime] = None
        """
        last fetch time is used to determine if the data is fresh or stale.
        """

        self._fetch_lock = asyncio.Lock()
        """
        lock to ensure that only one fetch operation happens at a time
        """

        self._fetching_task: Optional[asyncio.Task] = None
        """
        The fetching task is used to track if a fetch operation is currently in progress.
        """

        self._logger.info("Opportunities data service initialized")

    def _is_data_fresh(self) -> bool:
        """
        Check if cached data is fresh (within the last allowed stale time).
        ie: if data_stale_time is 6 hours, then data is fresh if it was fetched within the last 6 hours.
        :return: True if data is fresh, False if stale or not fetched yet.
        """

        # if it hasn't been fetched yet, consider it stale (data not fresh)
        if self._last_fetch_time is None:
            return False

        # check if the last fetch time is within the stale threshold
        stale_threshold = datetime.now() - timedelta(seconds=self._config.opportunities_data_stale_time)

        # if the last fetch time is greater than the stale threshold, data is fresh, else it's stale
        is_data_fresh = self._last_fetch_time > stale_threshold
        return is_data_fresh

    async def _fetch_and_update_cache(self) -> None:
        """
        Fetch new data and update the cache system.
        Uses cold cache for fetching, then swaps with hot cache.
        """
        try:
            self._logger.info("Starting fetch for opportunities data")

            # Fetch new data into a cold cache.
            new_data = await self._opportunities_data_repository.get_opportunities_skills_uuids(
                limit=self._config.fetch_opportunities_limit,
                batch_size=self._config.fetch_opportunities_batch_size)

            # Update cold cache with new data
            self._cold_cache = new_data

            # Swap hot and cold caches atomically
            self._hot_cache, self._cold_cache = self._cold_cache, self._hot_cache

            self._cold_cache = None  # Clear cold cache after swapping to free memory

            # Update fetch time
            self._last_fetch_time = datetime.now()

            self._logger.info(f"Successfully updated opportunities cache with {len(new_data)} opportunities")
        except Exception as e:
            self._logger.error(f"Failed to fetch opportunities data: {e}")
            raise
        finally:
            self._fetching_task = None

    async def get_opportunities_skills_uuids(self) -> list[set[str]]:
        """
        Get skills from opportunity data.

        Caching strategy:

        — If data is stale or not fetched yet, we need to fetch it.
        — For concurrency reasons, we use a lock to ensure that only one fetch operation happens at a time.
        — If the data needs to be fetched for the first time, we will fetch it synchronously
            and update the cache so that later requests can use the cache.
        — If the data is stale, we will start a background fetch,
            and for the other requests, we will be returning the stale data while the background fetch is in progress.
        — Until the background fetch is complete, all requests will return the stale data.

        :raises Exception: If an error fetching skills from opportunities.
        :return: The list of sets of skills UUIDs from opportunities.
        """

        # if data is fresh, return the hot cache directly
        # this avoids unnecessary fetches and locks if the data is already fresh
        if self._is_data_fresh() and self._hot_cache is not None:
            self._logger.debug("Returning fresh cached opportunities data")
            return self._hot_cache

        # if we have a fetching task, and we have a hot cache, return the hot cache right now.
        if self._fetching_task is not None and self._hot_cache is not None:
            self._logger.debug("Returning hot cached opportunities data while background fetch is in progress")
            return self._hot_cache

        async with self._fetch_lock:
            # Double-check after acquiring a lock (another request might have updated)
            if self._is_data_fresh() and self._hot_cache is not None:
                self._logger.debug("Returning fresh cached opportunities data (after lock)")
                return self._hot_cache

            # If no cache exists, it is for the first time
            # fetch synchronously (waiting) and update the cache
            if self._hot_cache is None:
                self._logger.info("No cached data exists, performing initial fetch")
                await self._fetch_and_update_cache()

                # If for some reason, the cache is still None after a fetch,
                # raise an exception to indicate failure.
                # This should not happen in normal operation, but it's a safety check
                # if the repository fails to fetch data,
                # then the above line should have raised an exception, and we don't reach here.
                if self._hot_cache is None:
                    self._logger.error("Failed to fetch opportunities data, cache is still None")
                    raise FailedToFetchOpportunitiesDataException

                # return the hot cache after successful fetch
                return self._hot_cache

            # Data is stale, but we have cache — start background fetch and return stale data
            if not self._fetching_task:
                self._logger.info("Data is stale, starting background refresh")
                # Start a background task without awaiting
                self._fetching_task = asyncio.create_task(self._fetch_and_update_cache())

            # Return the existing cache while a fetch happens in the background
            self._logger.debug("Returning stale cached data while background fetch is in progress")
            return self._hot_cache
