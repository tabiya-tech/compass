import logging
from abc import ABC, abstractmethod
import hashlib
import json

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

    @property
    @abstractmethod
    def dataset_version(self) -> str | None:
        """
        Returns a deterministic version hash of the currently cached opportunities dataset.
        Computed once per cache refresh.
        """
        raise NotImplementedError

    @property
    @abstractmethod
    def last_fetch_time(self):
        """
        Returns the last time the opportunities cache was fetched.
        property here so that it can be accessed without parentheses.
        """
        raise NotImplementedError


def _compute_version_from_skills(skills_sets: list[set[str]]) -> str:
    """
    Compute a deterministic version hash from a list of sets of skill UUIDs.
    """
    # convert the sets to lists, because JSON does not support sets
    # sort the skills within each set to ensure consistent ordering
    normalized = [sorted(skills_set) for skills_set in skills_sets]

    # sort the lists by each string, because the result we can not guarantee order of sets
    #   unless we specify a sort order, and we want the version to be deterministic
    normalized.sort(key=lambda s: json.dumps(s))

    # serialize to JSON with no spaces to ensure consistent hashing
    serialized = json.dumps(normalized)

    # compute the MD5 hash of the serialized string
    return hashlib.md5(serialized.encode("utf-8")).hexdigest() # nosec B324 - versioning only


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
            fetch_latest_value=self._fetch_opportunities_skills_uuids,
            compute_version=_compute_version_from_skills)

        self._logger.info("Opportunities data service initialized")

    @property
    def last_fetch_time(self):
        return self._cache_manager._last_fetch_time

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

    @property
    def dataset_version(self) -> str | None:
        return self._cache_manager.version
