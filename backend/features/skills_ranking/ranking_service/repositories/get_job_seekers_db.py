import asyncio
import logging

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from common_libs.database.get_mongo_db_connection import get_mongo_db_connection
from common_libs.database.utils import check_mongo_health, get_database_connection_info
from features.skills_ranking.config import get_skills_ranking_config

_job_seekers_db_singleton: AsyncIOMotorDatabase | None = None
_job_seekers_db_lock = asyncio.Lock()

_logger = logging.getLogger(__name__)


async def get_job_seekers_db(mongo_db_uri: str = Depends(lambda: get_skills_ranking_config().job_seekers_mongodb_uri),
                             database_name: str = Depends(lambda: get_skills_ranking_config().job_seekers_database_name)
                             ) -> AsyncIOMotorDatabase:
    """
    Get the Job Seekers MongoDB database instance.
    """

    global _job_seekers_db_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _job_seekers_db_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _job_seekers_db_lock:

            # double check after acquiring the lock
            if _job_seekers_db_singleton is None:
                _logger.info("Connecting to JobSeekers MongoDB")

                # Create the database instance
                _job_seekers_db_singleton = get_mongo_db_connection(mongo_db_uri, database_name)

                _logger.info("Connected to JobSeekers database: %s",
                             await get_database_connection_info(_job_seekers_db_singleton))
                if not await check_mongo_health(_job_seekers_db_singleton.client):
                    raise RuntimeError("MongoDB health check failed for JobSeekers database")

                _logger.info("Successfully pinged JobSeekers MongoDB")

    return _job_seekers_db_singleton
