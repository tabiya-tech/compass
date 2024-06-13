from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from common_libs.environment_settings.mongo_db_settings import MongoDbSettings

_settings = MongoDbSettings()

_mongo_db: AsyncIOMotorDatabase = AsyncIOMotorClient(
    _settings.mongodb_uri,
    tls=True, tlsAllowInvalidCertificates=True
    ).get_database(_settings.database_name)


def get_mongo_db() -> AsyncIOMotorDatabase:
    """ Get the MongoDB database instance."""
    return _mongo_db


_conversation_memory_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)


def get_conversation_memory_manager() -> ConversationMemoryManager:
    """ Get the conversation memory manager instance."""
    return ConversationMemoryManager(20, TO_BE_SUMMARIZED_WINDOW_SIZE)
