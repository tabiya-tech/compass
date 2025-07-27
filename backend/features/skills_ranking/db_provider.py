import asyncio
import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pydantic import BaseModel


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


async def _get_database_connection_info(database: AsyncIOMotorDatabase) -> str:
    """
    Retrieves connection information for a MongoDB database, formatted for logging.

    :param database: The MongoDB database object from AsyncIOMotorClient
    :return: A single-line string describing the database connection details
    """
    client = database.client
    db_name = database.name
    # Get the primary address (host and port)
    try:
        # Ensure the client is connected, before trying to get the client.address, otherwise it might be None
        si = await client.server_info()
        host, port = client.address
        primary_info = f"{host}:{port} version:{si.get('version', 'Unknown version')}"
    except Exception:  # noqa
        primary_info = "Unknown primary node"

    # Get all connected nodes
    connected_nodes = client.nodes
    connected_nodes_info = ", ".join([f"{node[0]}:{node[1]}" for node in connected_nodes]) or "None"  # type: ignore

    # Format the output for logging
    connection_info = (
        f"Database: {db_name}, Primary: {primary_info}, Nodes: {connected_nodes_info}"
    )

    return connection_info


async def check_mongo_health(client: AsyncIOMotorClient) -> bool:
    try:
        result = await client.admin.command("ping")
        return result.get("ok") == 1.0
    except Exception:
        return False


class SkillsRankingDBProvider:
    """
    Provides the skills ranking database instance.
    """
    _skills_ranking_mongo_db: Optional[AsyncIOMotorDatabase] = None
    _lock = asyncio.Lock()
    _logger = logging.getLogger(__qualname__)
    _settings: Optional[SkillsRankingDbSettings] = None

    @classmethod
    def _get_settings(cls) -> SkillsRankingDbSettings:
        # Defer reading the settings until the first time they are needed
        # Otherwise, the settings will be read at import time which can cause issues with unset environment variables during testing
        if cls._settings is None:
            raise RuntimeError("Skills ranking database settings not configured. Call configure() first.")
        return cls._settings

    @classmethod
    def configure(cls, settings: SkillsRankingDbSettings):
        """
        Configure the database provider with settings.
        This should be called before any database operations.
        """
        cls._settings = settings
        cls._logger.info("Skills ranking database provider configured")

    @staticmethod
    async def initialize_skills_ranking_mongo_db(skills_ranking_db: AsyncIOMotorDatabase, logger: logging.Logger):
        """ Initialize the Skills Ranking MongoDB database."""
        try:
            logger.info("Initializing indexes for the skills ranking database")
            
            # Create the skills ranking state indexes
            await skills_ranking_db.get_collection("skills_ranking_state").create_index([
                ("session_id", 1)
            ], unique=True)

            logger.info("Finished creating indexes for the skills ranking database")
        except Exception as e:
            logger.exception(e)
            raise e

    @classmethod
    async def get_skills_ranking_db(cls) -> AsyncIOMotorDatabase:
        if cls._skills_ranking_mongo_db is None:  # Check if the database instance has been created
            async with cls._lock:  # Ensure that only one coroutine is creating and initializing the database instance
                if cls._skills_ranking_mongo_db is None:  # Double-check after acquiring the lock
                    cls._logger.info("Connecting to Skills Ranking MongoDB")
                    # Create the database instance
                    settings = cls._get_settings()
                    cls._skills_ranking_mongo_db = _get_skills_ranking_db(
                        settings.mongodb_uri,
                        settings.database_name
                    )
                    cls._logger.info("Connected to Skills Ranking MongoDB database: %s",
                                     await _get_database_connection_info(cls._skills_ranking_mongo_db))
                    if not await check_mongo_health(cls._skills_ranking_mongo_db.client):
                        raise RuntimeError("MongoDB health check failed for Skills Ranking database")
                    cls._logger.info("Successfully pinged Skills Ranking MongoDB")

        return cls._skills_ranking_mongo_db

    @staticmethod
    def clear_cache():
        """
        Clear the cached database instances.

        This is useful for testing purposes to ensure that the database instances are re-created.
        """
        SkillsRankingDBProvider._skills_ranking_mongo_db = None
        SkillsRankingDBProvider._logger.info("Cleared cached skills ranking database instances") 