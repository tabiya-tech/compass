import asyncio

from fastapi import Depends

from features.skills_ranking.config import get_skills_ranking_config
from features.skills_ranking.state.repositories.registration_mongo_repository import RegistrationMongoRepository
from features.skills_ranking.state.repositories.types import IRegistrationDataRepository
from features.skills_ranking.state.repositories.get_registration_data_db import get_registration_data_db

_registration_repository_singleton: IRegistrationDataRepository | None = None
_registration_repository_lock = asyncio.Lock()


async def get_registration_data_repository(db=Depends(get_registration_data_db),
                                           collection_name = Depends(lambda: get_skills_ranking_config().registration_data_collection_name)) -> IRegistrationDataRepository:
    global _registration_repository_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _registration_repository_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _registration_repository_lock:

            # double check after acquiring the lock
            if _registration_repository_singleton is None:
                _registration_repository_singleton = RegistrationMongoRepository(db, collection_name)

    return _registration_repository_singleton

