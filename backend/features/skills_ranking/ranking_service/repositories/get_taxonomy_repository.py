import asyncio

from fastapi import Depends

from features.skills_ranking.config import get_skills_ranking_config
from features.skills_ranking.ranking_service.repositories.get_opportunities_data_db import get_opportunities_data_db
from features.skills_ranking.ranking_service.repositories.taxonomy_mongo_repository import TaxonomyMongoRepository
from features.skills_ranking.ranking_service.repositories.types import ITaxonomyRepository

_taxonomy_repository_singleton: ITaxonomyRepository | None = None
_taxonomy_repository_lock = asyncio.Lock()


async def get_taxonomy_repository(db=Depends(get_opportunities_data_db),
                                  skills_collection_name=Depends(
                                      lambda: get_skills_ranking_config().skills_collection_name)) -> ITaxonomyRepository:
    global _taxonomy_repository_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _taxonomy_repository_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _taxonomy_repository_lock:

            # double check after acquiring the lock
            if _taxonomy_repository_singleton is None:
                _taxonomy_repository_singleton = TaxonomyMongoRepository(db=db,
                                                                         skills_collection_name=skills_collection_name)

    return _taxonomy_repository_singleton
