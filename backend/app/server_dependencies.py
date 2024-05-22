import os

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

_mongo_db: AsyncIOMotorDatabase = AsyncIOMotorClient(os.getenv("MONGODB_URI")).get_database("compass-poc")


def get_mongo_db() -> AsyncIOMotorDatabase:
    """ Get the MongoDB database instance."""
    return _mongo_db
