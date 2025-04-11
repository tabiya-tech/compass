import argparse
import asyncio
import logging
from typing import Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pydantic_settings import BaseSettings

from app.application_state import ApplicationStateStore
from app.server_dependencies.database_collections import Collections
from app.store.database_application_state_store import DatabaseApplicationStateStore
from app.store.json_application_state_store import JSONApplicationStateStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Hardcoded directory for JSON files
JSON_STORE_DIRECTORY = "exported-conversations"


class Settings(BaseSettings):
    # source database
    source_mongodb_uri: Optional[str] = None
    source_database_name: Optional[str] = None

    # destination database
    target_mongodb_uri: Optional[str] = None
    target_database_name: Optional[str] = None

    class Config:
        env_prefix = "EXPORT_IMPORT_"


async def get_latest_session_id(db: AsyncIOMotorDatabase, user_id: str) -> Optional[int]:
    """
    Get the latest session ID from a user's preferences.
    
    Args:
        db: The database connection
        user_id: The user ID to look up
        
    Returns:
        The latest session ID, or None if not found
    """
    try:
        # Get the user preferences document
        user_prefs = await db.get_collection(Collections.USER_PREFERENCES).find_one(
            {"user_id": user_id},
            projection={"sessions": 1}
        )

        if not user_prefs or "sessions" not in user_prefs or not user_prefs["sessions"]:
            logger.error(f"No sessions found for user {user_id}")
            return None

        # Get the latest session ID (first item in the array)
        latest_session_id = user_prefs["sessions"][0]
        logger.info(f"Found latest session ID {latest_session_id} for user {user_id}")
        return latest_session_id

    except Exception as e:
        logger.error(f"Error getting latest session ID for user {user_id}: {e}")
        return None


async def export_state(
        source_store: ApplicationStateStore,
        source_session_id: int,
        target_store: ApplicationStateStore,
        target_session_id: int
) -> bool:
    """
    Export a state from source store to target store.
    
    Args:
        source_store: The source application state store
        source_session_id: The session ID in the source store
        target_store: The target application state store
        target_session_id: The session ID to use in the target store
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Get state from source store
        state = await source_store.get_state(source_session_id)
        if state is None:
            logger.error(f"No state found for session ID {source_session_id}")
            return False

        # Update session ID for target
        state.session_id = target_session_id

        # Update all agent states with the new session ID
        if hasattr(state, 'agent_director_state') and state.agent_director_state:
            state.agent_director_state.session_id = target_session_id

        if hasattr(state, 'explore_experiences_director_state') and state.explore_experiences_director_state:
            state.explore_experiences_director_state.session_id = target_session_id

        if hasattr(state, 'conversation_memory_manager_state') and state.conversation_memory_manager_state:
            state.conversation_memory_manager_state.session_id = target_session_id

        if hasattr(state, 'collect_experience_state') and state.collect_experience_state:
            state.collect_experience_state.session_id = target_session_id

        if hasattr(state, 'skills_explorer_agent_state') and state.skills_explorer_agent_state:
            state.skills_explorer_agent_state.session_id = target_session_id

        # Save to target store
        await target_store.save_state(state)
        logger.info(f"Successfully exported state from session {source_session_id} to {target_session_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to export state: {e}")
        return False


def create_store(store_type: str, **kwargs) -> ApplicationStateStore:
    """
    Create an application state store based on the specified type.
    
    Args:
        store_type: The type of store to create ('json' or 'db')
        **kwargs: Additional arguments for store creation
        
    Returns:
        An instance of ApplicationStateStore
    """
    if store_type.lower() == 'json':
        return JSONApplicationStateStore(JSON_STORE_DIRECTORY)
    elif store_type.lower() == 'db':
        if 'db' not in kwargs:
            raise ValueError("db is required for DB store")
        return DatabaseApplicationStateStore(kwargs['db'])
    else:
        raise ValueError(f"Unsupported store type: {store_type}")


async def export_import_conversation(
        source_session_id: int,
        target_session_id: int,
        source_type: str,
        target_type: str
):
    """
    Export/import a conversation between different stores.
    
    Args:
        source_session_id: The source session ID
        target_session_id: The target session ID
        source_type: The type of source store ('json' or 'db')
        target_type: The type of target store ('json' or 'db')
    """
    try:
        # Initialize settings
        settings = Settings()

        # Create source store
        source_store = None
        if source_type.lower() == 'json':
            source_store = create_store('json')
        elif source_type.lower() == 'db':
            if not settings.source_mongodb_uri or not settings.source_database_name:
                raise ValueError("Source MongoDB URI and database name are required")
            source_client = AsyncIOMotorClient(settings.source_mongodb_uri, tlsAllowInvalidCertificates=True)
            source_db = source_client.get_database(settings.source_database_name)
            source_store = create_store('db', db=source_db)

        # Create target store
        target_store = None
        if target_type.lower() == 'json':
            target_store = create_store('json')
        elif target_type.lower() == 'db':
            if not settings.target_mongodb_uri or not settings.target_database_name:
                raise ValueError("Target MongoDB URI and database name are required")
            target_client = AsyncIOMotorClient(settings.target_mongodb_uri, tlsAllowInvalidCertificates=True)
            target_db = target_client.get_database(settings.target_database_name)
            target_store = create_store('db', db=target_db)

        # Export the state
        success = await export_state(source_store, source_session_id, target_store, target_session_id)
        if success:
            logger.info(f"Successfully exported conversation from {source_session_id} to {target_session_id}")
            return True
        else:
            logger.error(f"Failed to export conversation from {source_session_id} to {target_session_id}")
            return False

    except Exception as e:
        logger.error(f"Error during export/import: {e}")
        return False


def parse_args():
    parser = argparse.ArgumentParser(description="Export and import conversation states")

    # Add arguments for export/import
    parser.add_argument("--source-session-id", type=int,
                        help="The source session ID (required if --source-user-id not provided)")
    parser.add_argument("--source-user-id", type=str,
                        help="The source user ID to get the latest session from (only valid when source is DB)")
    parser.add_argument("--target-session-id", type=int,
                        help="The target session ID (required if --target-user-id not provided)")
    parser.add_argument("--target-user-id", type=str,
                        help="The target user ID to get the latest session from (only valid when target is DB)")
    parser.add_argument("--source", type=str, choices=["JSON", "DB"], help="Source store type (defaults to DB)")
    parser.add_argument("--target", type=str, default="DB", choices=["JSON", "DB"],
                        help="Target store type (default: DB)")

    args = parser.parse_args()

    # Validate arguments
    if not args.source_session_id and not args.source_user_id:
        parser.error("Either --source-session-id or --source-user-id must be provided")
    if not args.target_session_id and not args.target_user_id:
        parser.error("Either --target-session-id or --target-user-id must be provided")
    if args.source_user_id and args.source and args.source != "DB":
        parser.error("--source-user-id can only be used when source is DB")
    if args.target_user_id and args.target != "DB":
        parser.error("--target-user-id can only be used when target is DB")

    return args


async def main():
    args = parse_args()

    # Set default source type to DB if not provided
    source_type = args.source if args.source else "DB"

    # Get source session ID from user preferences if user ID is provided
    source_session_id = args.source_session_id
    if args.source_user_id and source_type == "DB":
        settings = Settings()
        if not settings.source_mongodb_uri or not settings.source_database_name:
            raise ValueError("Source MongoDB URI and database name are required for user preferences lookup")
        source_client = AsyncIOMotorClient(settings.source_mongodb_uri, tlsAllowInvalidCertificates=True)
        source_db = source_client.get_database(settings.source_database_name)
        source_session_id = await get_latest_session_id(source_db, args.source_user_id)
        if source_session_id is None:
            raise ValueError(f"Could not find latest session ID for user {args.source_user_id}")

    # Get target session ID from user preferences if user ID is provided
    target_session_id = args.target_session_id
    if args.target_user_id and args.target == "DB":
        settings = Settings()
        if not settings.target_mongodb_uri or not settings.target_database_name:
            raise ValueError("Target MongoDB URI and database name are required for user preferences lookup")
        target_client = AsyncIOMotorClient(settings.target_mongodb_uri, tlsAllowInvalidCertificates=True)
        target_db = target_client.get_database(settings.target_database_name)
        target_session_id = await get_latest_session_id(target_db, args.target_user_id)
        if target_session_id is None:
            raise ValueError(f"Could not find latest session ID for user {args.target_user_id}")
    elif target_session_id is None and args.target == "JSON":
        target_session_id = source_session_id
        logger.info(f"Using source session ID {target_session_id} as target session ID for JSON export")
    elif target_session_id is None:
        raise ValueError("Target session ID is required when not exporting to JSON")

    await export_import_conversation(
        source_session_id,
        target_session_id,
        source_type,
        args.target
    )


if __name__ == "__main__":
    asyncio.run(main())
