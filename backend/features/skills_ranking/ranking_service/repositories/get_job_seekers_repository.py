import asyncio

from fastapi import Depends

from features.skills_ranking.config import get_skills_ranking_config
from features.skills_ranking.ranking_service.repositories.get_job_seekers_db import get_job_seekers_db
from features.skills_ranking.ranking_service.repositories.job_seekers_mongo_repository import JobSeekersMongoRepository
from features.skills_ranking.ranking_service.repositories.types import IJobSeekersRepository

_job_seekers_repository_singleton: IJobSeekersRepository | None = None
_job_seekers_repository_lock = asyncio.Lock()


async def get_job_seekers_repository(db=Depends(get_job_seekers_db),
                                     collection_name=Depends(
                                         lambda: get_skills_ranking_config().job_seekers_collection_name)
                                     ) -> IJobSeekersRepository:
    global _job_seekers_repository_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _job_seekers_repository_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _job_seekers_repository_lock:

            # double check after acquiring the lock
            if _job_seekers_repository_singleton is None:
                _job_seekers_repository_singleton = JobSeekersMongoRepository(db, collection_name)

    return _job_seekers_repository_singleton
