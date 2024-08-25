import asyncio
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections

import logging

from common_libs.environment_settings.mongo_db_settings import MongoDbSettings


def _get_application_db(mongodb_uri: str, db_name: str) -> AsyncIOMotorDatabase:
    """
    Decouples the database creation from the database provider.
    This allows to mock the database creation in tests, instead of mocking the database provider.
    """
    return AsyncIOMotorClient(
        mongodb_uri,
        tlsAllowInvalidCertificates=True
    ).get_database(db_name)

def _get_taxonomy_db(mongodb_uri: str, db_name: str) -> AsyncIOMotorDatabase:
    """
    Decouples the database creation from the database provider.
    This allows to mock the database creation in tests, instead of mocking the database provider.
    """
    return AsyncIOMotorClient(
        mongodb_uri,
        tlsAllowInvalidCertificates=True
    ).get_database(db_name)

class CompassDBProvider:
    """
    Provides the taxonomy and application database instances.
    """
    _settings = MongoDbSettings()
    _application_mongo_db: Optional[AsyncIOMotorDatabase] = None
    _taxonomy_mongo_db: Optional[AsyncIOMotorDatabase] = None
    _lock = asyncio.Lock()
    _logger = logging.getLogger(__qualname__)

    @staticmethod
    async def initialize_application_mongo_db(application_db: AsyncIOMotorDatabase, logger: logging.Logger):
        """ Initialize the MongoDB database."""
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

    @classmethod
    async def get_application_db(cls) -> AsyncIOMotorDatabase:
        if cls._application_mongo_db is None:  # Check if the database instance has been created
            async with cls._lock:  # Ensure that only one coroutine is creating and initializing the database instance
                if cls._application_mongo_db is None:  # Double-check after acquiring the lock
                    cls._logger.info("Initializing Application MongoDB")
                    # Create the database instance
                    cls._application_mongo_db = _get_application_db(cls._settings.application_mongodb_uri, cls._settings.application_database_name)
        return cls._application_mongo_db

    @classmethod
    async def get_taxonomy_db(cls) -> AsyncIOMotorDatabase:
        if cls._taxonomy_mongo_db is None:  # Check if the database instance has been created
            async with cls._lock:  # Ensure that only one coroutine is creating and initializing the database instance
                if cls._taxonomy_mongo_db is None:  # Double-check after acquiring the lock
                    cls._logger.info("Initializing Taxonomy MongoDB")
                    # Create the database instance
                    cls._taxonomy_mongo_db = _get_taxonomy_db(cls._settings.taxonomy_mongodb_uri, cls._settings.taxonomy_database_name)
        return cls._taxonomy_mongo_db
