import asyncio
import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pydantic import BaseModel

from common_libs.database.utils import get_database_connection_info, check_mongo_health, initialize_mongo_db_indexes


class SkillsRankingDbSettings(BaseModel):
    """
    Settings for the Skills Ranking MongoDB database.
    """
    mongodb_uri: str = ""
    """
    The URI of the skills ranking MongoDB instance.
    """
    database_name: str = ""
    """
    The name of the skills ranking database.
    """


def _get_skills_ranking_db(mongodb_uri: str, db_name: str) -> AsyncIOMotorDatabase:
    """
    Decouples the database creation from the database provider.
    This allows to mock the database creation in tests, instead of mocking the database provider.
    """
    return AsyncIOMotorClient(
        mongodb_uri,
        tlsAllowInvalidCertificates=True
    ).get_database(db_name)


# Global variables for singleton pattern
_skills_ranking_mongo_db: Optional[AsyncIOMotorDatabase] = None
_lock = asyncio.Lock()
_logger = logging.getLogger(__name__)
_settings: Optional[SkillsRankingDbSettings] = None


def configure_skills_ranking_db(settings: SkillsRankingDbSettings):
    """
    Configure the skills ranking database settings.
    This should be called before any database operations.
    """
    global _settings
    _settings = settings
    _logger.info("Skills ranking database configured")


async def get_skills_ranking_state_db() -> AsyncIOMotorDatabase:
    """
    Get the skills ranking state database instance.
    Creates and initializes the database if it doesn't exist.
    
    :return: The skills ranking state database
    """
    global _skills_ranking_mongo_db, _settings
    
    if _settings is None:
        raise RuntimeError("Skills ranking database settings not configured. Call configure_skills_ranking_db() first.")
    
    if _skills_ranking_mongo_db is None:
        async with _lock:
            if _skills_ranking_mongo_db is None:
                _logger.info("Connecting to Skills Ranking MongoDB")
                # Create the database instance
                _skills_ranking_mongo_db = _get_skills_ranking_db(
                    _settings.mongodb_uri,
                    _settings.database_name
                )
                _logger.info("Connected to Skills Ranking MongoDB database: %s",
                             await get_database_connection_info(_skills_ranking_mongo_db))
                if not await check_mongo_health(_skills_ranking_mongo_db.client):
                    raise RuntimeError("MongoDB health check failed for Skills Ranking database")
                _logger.info("Successfully pinged Skills Ranking MongoDB")

    return _skills_ranking_mongo_db


async def initialize_skills_ranking_db(skills_ranking_db: AsyncIOMotorDatabase, logger: logging.Logger):
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
            "skills_ranking_state", 
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