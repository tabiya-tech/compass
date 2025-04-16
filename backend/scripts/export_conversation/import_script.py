#!/usr/bin/env python3

import argparse
import asyncio
import logging
import os
from textwrap import dedent
from typing import Optional

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

from app.application_state import ApplicationStateStore, ApplicationState
from app.users.repositories import UserPreferenceRepository
from app.users.sessions import SessionsService
from _common import StoreType, create_store, get_db_connection
from common_libs.logging.log_utilities import setup_logging_config
from scripts.export_conversation.constants import SCRIPT_DIR, DEFAULT_EXPORTS_DIR

# set up the logging
setup_logging_config(os.path.join(SCRIPT_DIR, "logging.cfg.yaml"))
logger = logging.getLogger(__name__)

load_dotenv()


class Settings(BaseSettings):
    """
    Settings for the import script.

    All the fields are optional, because they are required depending on user's needs.
    """

    # source database
    source_mongodb_uri: Optional[str] = None
    source_database_name: Optional[str] = None

    # destination database
    target_mongodb_uri: str
    target_database_name: str

    class Config:
        env_prefix = "IMPORT_CONVERSATION_"


def _get_source_store(settings: Settings, source_type: StoreType, source_directory: str) -> ApplicationStateStore:
    source_store = None
    if source_type == "JSON":
        source_store = create_store("JSON", folder_path=source_directory)
    elif source_type == "DB":
        if not settings.source_mongodb_uri or not settings.source_database_name:
            raise ValueError("Source MongoDB URI and database name are required")

        source_db = get_db_connection(settings.source_mongodb_uri, settings.source_database_name)
        source_store = create_store(
            "DB",
            db=source_db
        )

    return source_store


def _update_state_session_id(state: ApplicationState, new_session_id: int) -> ApplicationState:
    # Update all agent states with new session ID
    if hasattr(state, 'agent_director_state') and state.agent_director_state:
        state.agent_director_state.session_id = new_session_id

    if hasattr(state, 'welcome_agent_state') and state.welcome_agent_state:
        state.welcome_agent_state.session_id = new_session_id

    if hasattr(state, 'explore_experiences_director_state') and state.explore_experiences_director_state:
        state.explore_experiences_director_state.session_id = new_session_id

    if hasattr(state, 'conversation_memory_manager_state') and state.conversation_memory_manager_state:
        state.conversation_memory_manager_state.session_id = new_session_id

    if hasattr(state, 'collect_experience_state') and state.collect_experience_state:
        state.collect_experience_state.session_id = new_session_id

    if hasattr(state, 'skills_explorer_agent_state') and state.skills_explorer_agent_state:
        state.skills_explorer_agent_state.session_id = new_session_id

    return state


def _parse_args():
    parser = argparse.ArgumentParser(
        description="Import a single session from a source store (DB or JSON) to "
                    "target store (Database is now only supported).",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=dedent("""
        Environment Variables:
          Target database (required):
            IMPORT_CONVERSATION_TARGET_MONGODB_URI    MongoDB connection URI for target database
            IMPORT_CONVERSATION_TARGET_DATABASE_NAME  Database name for target

          Source database (required if source is DB):
            IMPORT_CONVERSATION_SOURCE_MONGODB_URI    MongoDB connection URI for source database
            IMPORT_CONVERSATION_SOURCE_DATABASE_NAME  Database name for source

        Notes:
          - When importing from JSON, files are read from the 'exports/{{ session-id }}/state.json' file
          - A new session will be created for the target user
          - All agent states within the session are updated with the new session ID
          - The script will exit with code 1 if the import fails
        """)
    )

    # Required session IDs
    parser.add_argument(
        "--source-session-id",
        type=int,
        required=True,
        help="Session ID to import from the source store"
    )
    parser.add_argument(
        "--target-user-id",
        type=str,
        required=True,
        help="User ID to create a new session for in the target database"
    )

    parser.add_argument(
        "--source-dir",
        type=str,
        default=DEFAULT_EXPORTS_DIR,
        help=f"The import directory for the import script, where the inputs will be found. "
             f"Default value is {DEFAULT_EXPORTS_DIR}. Absolute path or relative path to the running directory"
    )

    # Source type
    parser.add_argument(
        "--source",
        type=str,
        choices=["DB", "JSON"],
        required=True,
        dest="source",
        help="Source store type (DB or JSON)"
    )

    return parser.parse_args()


async def import_conversation(
        source_session_id: int,
        target_user_id: str,
        source_directory: str,
        source_type: StoreType
) -> bool:
    """
    Import a single conversation from source store to Database.
    
    Args:
        source_session_id: The source session ID
        target_user_id: The target user ID to create a new session for
        source_type: Type of source store ('JSON' or 'DB')
        source_directory: The directory where the source files are located.
        
    Returns:
        True if successful, False otherwise
    """

    try:
        settings = Settings()

        # Set up source store
        source_store = _get_source_store(settings=settings, source_type=source_type, source_directory=source_directory)

        # Set up target DB store
        if not settings.target_mongodb_uri or not settings.target_database_name:
            raise ValueError("Target MongoDB URI and database name are required")

        target_db = get_db_connection(settings.target_mongodb_uri, settings.target_database_name)
        target_store = create_store(
            "DB",
            db=target_db
        )

        # Get state from source
        state = await source_store.get_state(source_session_id)
        if state is None:
            logger.error(f"No state found for session {source_session_id}")
            return False

        # Create a new session for the target user
        user_repository = UserPreferenceRepository(target_db)
        session_service = SessionsService(user_repository)

        # get the new session on the target user preferences with new session id.
        new_user_preferences = await session_service.new_session(target_user_id)
        target_new_session_id = new_user_preferences.sessions[0]

        # Update session ID in the state
        state.session_id = target_new_session_id
        state = _update_state_session_id(state, target_new_session_id)

        # Save to target DB
        await target_store.save_state(state)

        logger.info(
            f"Successfully imported session {source_session_id} to {target_new_session_id} for user {target_user_id}")
        return True

    except Exception as e:
        logger.error(f"Error during import: {e}")
        return False


async def main():
    args = _parse_args()

    success = await import_conversation(
        source_session_id=args.source_session_id,
        target_user_id=args.target_user_id,
        source_directory=args.source_dir,
        source_type=args.source
    )

    if not success:
        exit(1)


if __name__ == "__main__":
    asyncio.run(main())
