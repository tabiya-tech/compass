import asyncio
import logging

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from common_libs.database.get_mongo_db_connection import get_mongo_db_connection
from common_libs.database.utils import initialize_mongo_db_indexes
from features.skills_ranking.config import get_skills_ranking_config

_job_seekers_db_singleton: AsyncIOMotorDatabase | None = None
_job_seekers_db_lock = asyncio.Lock()

_logger = logging.getLogger(__name__)


async def get_job_seekers_db(mongo_db_uri: str = Depends(lambda: get_skills_ranking_config().job_seekers_mongodb_uri),
                             database_name: str = Depends(lambda: get_skills_ranking_config().job_seekers_database_name)
                             ) -> AsyncIOMotorDatabase:
    global _job_seekers_db_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _job_seekers_db_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _job_seekers_db_lock:

            # double check after acquiring the lock
            if _job_seekers_db_singleton is None:
                _job_seekers_db_singleton = get_mongo_db_connection(mongo_db_uri, database_name)

    return _job_seekers_db_singleton


async def initialize_job_seekers_db(_db: AsyncIOMotorDatabase, collection_name: str):
    await initialize_mongo_db_indexes(
        _db,
        collection_name,
        [
            {
                "name": "user_id_unique_index",
                "fields": [("user_id", 1)],
                "options": {"unique": True}
            }
        ],
        _logger
    )
