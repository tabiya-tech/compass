import asyncio
import logging

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from common_libs.database.get_mongo_db_connection import get_mongo_db_connection
from features.skills_ranking.config import get_skills_ranking_config

_opportunities_data_db_singleton: AsyncIOMotorDatabase | None = None
_opportunities_data_db_lock = asyncio.Lock()

_logger = logging.getLogger(__name__)


async def get_opportunities_data_db(
        mongo_db_uri: str = Depends(lambda: get_skills_ranking_config().opportunity_data_mongodb_uri),
        database_name: str = Depends(
            lambda: get_skills_ranking_config().opportunity_data_database_name)) -> AsyncIOMotorDatabase:
    global _opportunities_data_db_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _opportunities_data_db_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _opportunities_data_db_lock:

            # double check after acquiring the lock
            if _opportunities_data_db_singleton is None:
                _config = get_skills_ranking_config()
                _opportunities_data_db_singleton = get_mongo_db_connection(mongo_db_uri, database_name)

    return _opportunities_data_db_singleton
