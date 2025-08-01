import asyncio

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from common_libs.database.get_mongo_db_connection import get_mongo_db_connection
from features.skills_ranking.config import get_skills_ranking_config

_registration_data_db_singleton: AsyncIOMotorDatabase | None = None
_registration_data_db_lock = asyncio.Lock()


async def get_registration_data_db(
        mongo_db_uri: str = Depends(lambda: get_skills_ranking_config().registration_data_mongodb_uri),
        database_name: str = Depends(
            lambda: get_skills_ranking_config().registration_data_database_name)) -> AsyncIOMotorDatabase:
    global _registration_data_db_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _registration_data_db_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _registration_data_db_lock:

            # double check after acquiring the lock
            if _registration_data_db_singleton is None:
                _registration_data_db_singleton = get_mongo_db_connection(mongo_db_uri,
                                                                          database_name)

    return _registration_data_db_singleton
