from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.constants.database import Collections

import logging

from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
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

    INITIALIZED_MONGO_DB = True


def get_mongo_db() -> AsyncIOMotorDatabase:
    """ Get the MongoDB database instance."""
    return _mongo_db


_conversation_memory_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)


def get_conversation_memory_manager() -> ConversationMemoryManager:
    """ Get the conversation memory manager instance."""
    return _conversation_memory_manager
