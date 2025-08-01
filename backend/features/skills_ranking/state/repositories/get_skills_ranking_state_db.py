import asyncio
import logging
from typing import Optional

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from common_libs.database.get_mongo_db_connection import get_mongo_db_connection
from common_libs.database.utils import get_database_connection_info, check_mongo_health, initialize_mongo_db_indexes
from features.skills_ranking.config import get_skills_ranking_config

# Global variables for singleton pattern
_skills_ranking_mongo_db: Optional[AsyncIOMotorDatabase] = None
_lock = asyncio.Lock()
_logger = logging.getLogger(__name__)


async def get_skills_ranking_state_db(mongo_db_uri: str = Depends(lambda: get_skills_ranking_config().skills_ranking_state_mongodb_uri),
                                      database_name: str = Depends(lambda: get_skills_ranking_config().skills_ranking_state_database_name)) -> AsyncIOMotorDatabase:
    """
    Get the skills ranking state database instance.
    Creates and initializes the database if it doesn't exist.

    :return: The skills ranking state database
    """
    global _skills_ranking_mongo_db

    if _skills_ranking_mongo_db is None:
        async with _lock:
            if _skills_ranking_mongo_db is None:
                _logger.info("Connecting to Skills Ranking MongoDB")
                _skills_ranking_mongo_db = get_mongo_db_connection(mongo_db_uri, database_name)

                _logger.info("Connected to Skills Ranking MongoDB database: %s",
                             await get_database_connection_info(_skills_ranking_mongo_db))

                if not await check_mongo_health(_skills_ranking_mongo_db.client):
                    raise RuntimeError("MongoDB health check failed for Skills Ranking database")

                _logger.info("Successfully pinged Skills Ranking MongoDB")

    return _skills_ranking_mongo_db

async def initialize_skills_ranking_state_db(skills_ranking_db: AsyncIOMotorDatabase, collection_name: str, logger: logging.Logger):
    """ Initialize the Skills Ranking MongoDB database."""
    try:
        logger.info("Initializing indexes for the skills ranking database")

        # Define the indexes for the skills ranking state collection
        skills_ranking_state_indexes = [
            {
                "fields": [("session_id", 1)],
                "options": {"unique": True}
            }
        ]

        await initialize_mongo_db_indexes(
            skills_ranking_db,
            collection_name,
            skills_ranking_state_indexes,
            logger
        )

        logger.info("Finished creating indexes for the skills ranking database")
    except Exception as e:
        logger.exception(e)
        raise e


def clear_skills_ranking_db_cache():
    """
    Clear the cached database instance.

    This is useful for testing purposes to ensure that the database instance is re-created.
    """
    global _skills_ranking_mongo_db
    _skills_ranking_mongo_db = None
    _logger.info("Cleared cached skills ranking database instance")
