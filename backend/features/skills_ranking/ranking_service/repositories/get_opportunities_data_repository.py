import asyncio

from fastapi import Depends

from features.skills_ranking.config import get_skills_ranking_config
from features.skills_ranking.ranking_service.repositories.get_opportunities_data_db import get_opportunities_data_db
from features.skills_ranking.ranking_service.repositories.opportunities_data_mongo_repository import \
    OpportunitiesDataRepository
from features.skills_ranking.ranking_service.repositories.types import IOpportunitiesDataRepository

_opportunities_data_repository_singleton: IOpportunitiesDataRepository | None = None
_opportunities_data_repository_lock = asyncio.Lock()


async def get_opportunities_data_repository(db=Depends(get_opportunities_data_db),
                                            collection_name=Depends(
                                                lambda: get_skills_ranking_config().opportunity_data_collection_name)) -> IOpportunitiesDataRepository:
    global _opportunities_data_repository_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _opportunities_data_repository_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _opportunities_data_repository_lock:

            # double check after acquiring the lock
            if _opportunities_data_repository_singleton is None:
                _opportunities_data_repository_singleton = OpportunitiesDataRepository(db, collection_name)

    return _opportunities_data_repository_singleton
