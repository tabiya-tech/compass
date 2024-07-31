from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.constants.database import Collections

import logging

from common_libs.environment_settings.mongo_db_settings import MongoDbSettings

_settings = MongoDbSettings()

_mongo_db: AsyncIOMotorDatabase = AsyncIOMotorClient(
    _settings.mongodb_uri,
    tlsAllowInvalidCertificates=True
).get_database(_settings.database_name)

INITIALIZED_MONGO_DB = False


async def initialize_mongo_db():
    logger = logging.getLogger(__name__)

    global INITIALIZED_MONGO_DB

    if not INITIALIZED_MONGO_DB:
        logger.info("Initializing MongoDB")

        # Create the user preferences indexes
        await _mongo_db.get_collection(Collections.USER_PREFERENCES).create_index([
            ("user_id", 1)
        ], unique=True)

        # create the user invitations indexes
        await _mongo_db.get_collection(Collections.USER_INVITATIONS).create_index([
            ("code", 1)
        ], unique=True)

    INITIALIZED_MONGO_DB = True


def get_mongo_db() -> AsyncIOMotorDatabase:
    """ Get the MongoDB database instance."""
    return _mongo_db
