import asyncio
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .database_collections import Collections

import logging

from common_libs.environment_settings.mongo_db_settings import MongoDbSettings


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


def _get_application_db(mongodb_uri: str, db_name: str) -> AsyncIOMotorDatabase:
    """
    Decouples the database creation from the database provider.
    This allows to mock the database creation in tests, instead of mocking the database provider.
    """
    return AsyncIOMotorClient(
        mongodb_uri,
        tlsAllowInvalidCertificates=True
    ).get_database(db_name)


def _get_userdata_db(userdata_mongodb_uri: str, userdata_db_name: str) -> AsyncIOMotorDatabase:
    """
    Decouples the database creation from the database provider.
    This allows to mock the database creation in tests, instead of mocking the database provider.
    """

    return AsyncIOMotorClient(
        userdata_mongodb_uri,
        tlsAllowInvalidCertificates=True
    ).get_database(userdata_db_name)


def _get_taxonomy_db(mongodb_uri: str, db_name: str) -> AsyncIOMotorDatabase:
    """
    Decouples the database creation from the database provider.
    This allows to mock the database creation in tests, instead of mocking the database provider.
    """
    return AsyncIOMotorClient(
        mongodb_uri,
        tlsAllowInvalidCertificates=True
    ).get_database(db_name)


def _get_metrics_db(mongodb_uri: str, db_name: str) -> AsyncIOMotorDatabase:
    """
    Decouples the database creation from the database provider.
    This allows to mock the database creation in tests, instead of mocking the database provider.
    """
    return AsyncIOMotorClient(
        mongodb_uri,
        tlsAllowInvalidCertificates=True
    ).get_database(db_name)


async def check_mongo_health(client: AsyncIOMotorClient) -> bool:
    try:
        result = await client.admin.command("ping")
        return result.get("ok") == 1.0
    except Exception:
        return False


class CompassDBProvider:
    """
    Provides the taxonomy and application database instances.
    """
    _application_mongo_db: Optional[AsyncIOMotorDatabase] = None
    _taxonomy_mongo_db: Optional[AsyncIOMotorDatabase] = None
    _userdata_mongo_db: Optional[AsyncIOMotorDatabase] = None
    _metrics_mongo_db: Optional[AsyncIOMotorDatabase] = None
    _lock = asyncio.Lock()
    _logger = logging.getLogger(__qualname__)

    @staticmethod
    def _get_settings() -> MongoDbSettings:
        # Deffer reading the settings until the first time they are needed
        # Otherwise, the settings will be read at import time which can cause issues with unset environment variables during testing
        return MongoDbSettings()

    @staticmethod
    async def initialize_userdata_mongo_db(userdata_db: AsyncIOMotorDatabase, logger: logging.Logger):
        """ Initialize the MongoDB database."""
        try:
            logger.info("Initializing indexes for the userdata database")
            # Create the sensitive personal data indexes
            await userdata_db.get_collection(Collections.SENSITIVE_PERSONAL_DATA).create_index([
                ("user_id", 1)
            ], unique=True)

            logger.info("Finished creating indexes for the userdata database")
        except Exception as e:
            logger.exception(e)
            raise e

    @staticmethod
    async def initialize_application_mongo_db(application_db: AsyncIOMotorDatabase, logger: logging.Logger):
        """ Initialize the MongoDB database."""
        try:
            logger.info("Initializing indexes for the application database")
            # Create the user preferences indexes
            await application_db.get_collection(Collections.USER_PREFERENCES).create_index([
                ("user_id", 1)
            ], unique=True)

            # Create the user invitations indexes
            await application_db.get_collection(Collections.USER_INVITATIONS).create_index([
                ("invitation_code", 1)
            ], unique=True)

            # Create indexes for the application state elements
            await application_db.get_collection(Collections.AGENT_DIRECTOR_STATE).create_index([
                ("session_id", 1)
            ], unique=True)

            await application_db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE).create_index([
                ("session_id", 1)
            ], unique=True)

            await application_db.get_collection(Collections.CONVERSATION_MEMORY_MANAGER_STATE).create_index([
                ("session_id", 1)
            ], unique=True)

            await application_db.get_collection(Collections.COLLECT_EXPERIENCE_STATE).create_index([
                ("session_id", 1)
            ], unique=True)

            await application_db.get_collection(Collections.SKILLS_EXPLORER_AGENT_STATE).create_index([
                ("session_id", 1)
            ], unique=True)

            # Create the user feedback indexes
            await application_db.get_collection(Collections.USER_FEEDBACK).create_index([
                ("user_id", 1), ("session_id", 1)
            ])

            await application_db.get_collection(Collections.USER_FEEDBACK).create_index([
                ("session_id", 1)
            ], unique=True)

            await application_db.get_collection(Collections.REACTIONS).create_index([
                ("session_id", 1),
                ("message_id", 1)
            ], unique=True)

            # Add unique index on message_id for reactions
            await application_db.get_collection(Collections.REACTIONS).create_index([
                ("message_id", 1)
            ], unique=True)

            logger.info("Finished creating indexes for the application database")
        except Exception as e:
            logger.exception(e)
            raise e

    @staticmethod
    async def initialize_metrics_mongo_db(metrics_db: AsyncIOMotorDatabase, logger: logging.Logger):
        """ Initialize the MongoDB database."""
        try:
            logger.info("Initializing indexes for the metrics database")
            # Create the metrics indexes
            await metrics_db.get_collection(Collections.COMPASS_METRICS).create_index([
                ("event_type", 1)
            ])
            # Create sparse index on anonymized_session_id and anonymized_user_id
            await metrics_db.get_collection(Collections.COMPASS_METRICS).create_index([
                ("anonymized_session_id", 1),
                ("anonymized_user_id", 1),
                ("event_type", 1)
            ], sparse=True)

            logger.info("Finished creating indexes for the metrics database")
        except Exception as e:
            logger.exception(e)
            raise e

    @classmethod
    async def get_application_db(cls) -> AsyncIOMotorDatabase:
        if cls._application_mongo_db is None:  # Check if the database instance has been created
            async with cls._lock:  # Ensure that only one coroutine is creating and initializing the database instance
                if cls._application_mongo_db is None:  # Double-check after acquiring the lock
                    cls._logger.info("Connecting to Application MongoDB")
                    # Create the database instance
                    cls._application_mongo_db = _get_application_db(cls._get_settings().application_mongodb_uri,
                                                                    cls._get_settings().application_database_name)
                    cls._logger.info("Connected to Application MongoDB database: %s",
                                     await _get_database_connection_info(cls._application_mongo_db))
                    if not await check_mongo_health(cls._application_mongo_db.client):
                        raise RuntimeError("MongoDB health check failed for Application database")
                    cls._logger.info("Successfully pinged Application MongoDB")

        return cls._application_mongo_db

    @classmethod
    async def get_userdata_db(cls) -> AsyncIOMotorDatabase:
        """
        Get the userdata database instance.
        :return: AsyncIOMotorDatabase[userdata_db_name]
        """
        if cls._userdata_mongo_db is None:  # Check if the database instance has been created
            async with cls._lock:  # Ensure that only one coroutine is creating and initializing the database instance
                if cls._userdata_mongo_db is None:  # Double-check after acquiring the lock
                    cls._logger.info("Connecting to Userdata MongoDB")
                    # Create the database instance
                    cls._userdata_mongo_db = _get_userdata_db(
                        cls._get_settings().userdata_mongodb_uri,
                        cls._get_settings().userdata_database_name
                    )
                    cls._logger.info("Connected to Userdata MongoDB database: %s",
                                     await _get_database_connection_info(cls._userdata_mongo_db))
                    if not await check_mongo_health(cls._userdata_mongo_db.client):
                        raise RuntimeError("MongoDB health check failed for Userdata database")
                    cls._logger.info("Successfully pinged Userdata MongoDB")
        return cls._userdata_mongo_db

    @classmethod
    async def get_taxonomy_db(cls) -> AsyncIOMotorDatabase:
        if cls._taxonomy_mongo_db is None:  # Check if the database instance has been created
            async with cls._lock:  # Ensure that only one coroutine is creating and initializing the database instance
                if cls._taxonomy_mongo_db is None:  # Double-check after acquiring the lock
                    cls._logger.info("Connecting to Taxonomy MongoDB")
                    # Create the database instance
                    cls._taxonomy_mongo_db = _get_taxonomy_db(cls._get_settings().taxonomy_mongodb_uri,
                                                              cls._get_settings().taxonomy_database_name)
                    cls._logger.info("Connected to MongoDB database: %s",
                                     await _get_database_connection_info(cls._taxonomy_mongo_db))
                    if not await check_mongo_health(cls._taxonomy_mongo_db.client):
                        raise RuntimeError("MongoDB health check failed for Taxonomy database")
                    cls._logger.info("Successfully pinged Taxonomy MongoDB")
        return cls._taxonomy_mongo_db

    @classmethod
    async def get_metrics_db(cls) -> AsyncIOMotorDatabase:
        if cls._metrics_mongo_db is None:  # Check if the database instance has been created
            async with cls._lock:  # Ensure that only one coroutine is creating and initializing the database instance
                if cls._metrics_mongo_db is None:  # Double-check after acquiring the lock
                    cls._logger.info("Connecting to Metrics MongoDB")
                    # Create the database instance
                    cls._metrics_mongo_db = _get_metrics_db(cls._get_settings().metrics_mongodb_uri,
                                                            cls._get_settings().metrics_database_name)
                    cls._logger.info("Connected to MongoDB database: %s",
                                     await _get_database_connection_info(cls._metrics_mongo_db))
                    if not await check_mongo_health(cls._metrics_mongo_db.client):
                        raise RuntimeError("MongoDB health check failed for Metrics database")
                    cls._logger.info("Successfully pinged Metrics MongoDB")
        return cls._metrics_mongo_db
