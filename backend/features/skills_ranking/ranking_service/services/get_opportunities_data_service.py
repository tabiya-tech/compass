import asyncio

from fastapi import Depends

from features.skills_ranking.config import get_skills_ranking_config
from features.skills_ranking.ranking_service.repositories.get_opportunities_data_repository import \
    get_opportunities_data_repository
from features.skills_ranking.ranking_service.repositories.types import IOpportunitiesDataRepository
from features.skills_ranking.ranking_service.services.opportunities_data_service import IOpportunitiesDataService, OpportunitiesDataService

_opportunities_data_service_singleton: IOpportunitiesDataService | None = None
_opportunities_data_service_lock = asyncio.Lock()


async def get_opportunities_data_service(
        opportunities_data_repository: IOpportunitiesDataRepository = Depends(get_opportunities_data_repository),
        config=Depends(lambda: get_skills_ranking_config())
) -> IOpportunitiesDataService:
    global _opportunities_data_service_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _opportunities_data_service_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _opportunities_data_service_lock:
            # double check after acquiring the lock
            if _opportunities_data_service_singleton is None:
                _opportunities_data_service_singleton = OpportunitiesDataService(
                    opportunities_data_repository=opportunities_data_repository,
                    config=config)

    return _opportunities_data_service_singleton
