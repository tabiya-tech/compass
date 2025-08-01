from abc import ABC, abstractmethod

from features.skills_ranking.ranking_service.repositories.types import IOpportunitiesDataRepository
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
    def __init__(self, opportunities_data_repository: IOpportunitiesDataRepository,
                 config: OpportunitiesDataServiceConfig):
        self._opportunities_data_repository = opportunities_data_repository
        self._config = config

    async def get_opportunities_skills_uuids(self) -> list[set[str]]:
        return await self._opportunities_data_repository.get_opportunities_skills_uuids(
            self._config.fetch_opportunities_limit, self._config.fetch_opportunities_batch_size)
