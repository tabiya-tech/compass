from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from common_libs.environment_settings.mongo_db_settings import MongoDbSettings

_settings = MongoDbSettings()

_mongo_db: AsyncIOMotorDatabase = AsyncIOMotorClient(_settings.mongodb_uri).get_database(_settings.database_name)


def get_mongo_db() -> AsyncIOMotorDatabase:
    """ Get the MongoDB database instance."""
    return _mongo_db
