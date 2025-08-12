import logging
from abc import ABC, abstractmethod

from features.skills_ranking.ranking_service.repositories.types import IOpportunitiesDataRepository
from features.skills_ranking.ranking_service.services._cache_manager import CacheManager
from features.skills_ranking.ranking_service.services.config import OpportunitiesDataServiceConfig

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
    def __init__(self,
                 opportunities_data_repository: IOpportunitiesDataRepository,
                 config: OpportunitiesDataServiceConfig):
        self._opportunities_data_repository = opportunities_data_repository

        # service options and utilities
        self._logger = logging.getLogger(self.__class__.__name__)
        self._config = config

        self._cache_manager = CacheManager(
            stale_time=self._config.opportunities_data_stale_time,
            fetch_latest_value=self._fetch_opportunities_skills_uuids)

        self._logger.info("Opportunities data service initialized")

    async def _fetch_opportunities_skills_uuids(self) -> list[set[str]]:
        """
        Fetch skills UUIDS from opportunities data repository.
        :returns the list of sets of skill UUIDs from opportunities.
        """

        skills_uuids = await self._opportunities_data_repository.get_opportunities_skills_uuids(
            self._config.fetch_opportunities_limit,
            self._config.fetch_opportunities_batch_size)

        return skills_uuids

    async def get_opportunities_skills_uuids(self) -> list[set[str]]:
        """
        Get skills from opportunity data.
        """

        try:
            # get the uuids from the cache manager or fetch them if not cached
            uuids = await self._cache_manager.get()
            return uuids
        except Exception as e:
            self._logger.error(f"Failed to fetch opportunities data: {e}")
            raise
