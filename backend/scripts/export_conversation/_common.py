import os
from typing import Optional, Literal

from app.application_state import ApplicationStateStore
from app.store.database_application_state_store import DatabaseApplicationStateStore
from app.store.json_application_state_store import JSONApplicationStateStore
from app.store.markdown_conversation_state_store import MarkdownConversationStateStore
from app.store.txt_application_state_store import TxtApplicationStateStore
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

StoreType = Literal["JSON", "DB", "MD", "TXT"]


def create_store(
        store_type: StoreType,
        db: Optional[AsyncIOMotorDatabase] = None,
        folder_path: str | None = None
) -> ApplicationStateStore:
    """
    Create an application state store based on the specified type.
    
    Args:
        store_type: The type of store to create ('JSON', 'DB', or 'MD')
        db: Optional database connection for DB store
        folder_path: Optional folder path for JSON and MD stores
    Returns:
        An instance of ApplicationStateStore.
    """
    if store_type == "JSON":
        if folder_path is None:
            raise ValueError("Folder path is required for JSON store")
        # Ensure directory exists
        os.makedirs(folder_path, exist_ok=True)
        return JSONApplicationStateStore(folder_path)
    elif store_type == "DB":
        if db is None:
            raise ValueError("Database connection is required for DB store")

        return DatabaseApplicationStateStore(db)
    elif store_type == "MD":
        if folder_path is None:
            raise ValueError("Folder path is required for MD store")

        # Ensure directory exists
        os.makedirs(folder_path, exist_ok=True)
        return MarkdownConversationStateStore(folder_path)
    elif store_type == "TXT":
        if folder_path is None:
            raise ValueError("Folder path is required for TXT format")

        # Ensure directory exists
        os.makedirs(folder_path, exist_ok=True)
        return TxtApplicationStateStore(folder_path)
    else:
        raise ValueError(f"Unsupported store type: {store_type}")


def get_db_connection(mongodb_uri: str, database_name: str) -> AsyncIOMotorDatabase:
    """
    Create a database connection.
    
    Args:
        mongodb_uri: MongoDB connection URI
        database_name: Name of the database.
        
    Returns:
        An AsyncIOMotorDatabase instance
    """
    client = AsyncIOMotorClient(mongodb_uri, tlsAllowInvalidCertificates=True)
    return client.get_database(database_name)
