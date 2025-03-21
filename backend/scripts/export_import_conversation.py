import asyncio
import os
import argparse
import json

from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from app.agent.agent_director.abstract_agent_director import AgentDirectorState
from app.agent.collect_experiences_agent import CollectExperiencesAgentState
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.store.database_application_state_store import DatabaseApplicationStateStore
from app.application_state import ApplicationState
from pydantic_settings import BaseSettings
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState

load_dotenv()

# Access the environment variables
mongo_uri = os.getenv("EXPORT_IMPORT_MONGODB_URI")
database_name = os.getenv("EXPORT_IMPORT_DATABASE_NAME")

class Settings(BaseSettings):
    # source database
    source_mongodb_uri: Optional[str] = None
    source_database_name: Optional[str]  = None

    # destination database
    target_mongodb_uri: Optional[str] = None
    target_database_name: Optional[str] = None

    class Config:
        env_prefix = "EXPORT_IMPORT_"


async def export_state_to_json(state_store, session_id: int, file_path: str):
    state = await state_store.get_state(session_id)
    if state is None:
        raise ValueError(f"No state found for session ID {session_id}")

    state_json = state.model_dump_json(indent=2)
    with open(file_path, 'w') as file:
        file.write(state_json)

async def import_state_from_json(state_store, file_path: str, target_session_id: int):
    existing_state = await state_store.get_state(target_session_id)
    if not existing_state:
        raise ValueError(f"Session ID {target_session_id} does not exist. Cannot import to a non-existent session.")

    # Load the exported state from file
    with open(file_path, 'r') as file:
        state_dict = json.loads(file.read())

    # Update session_id in all components
    for component in ['agent_director_state', 'explore_experiences_director_state',
                      'conversation_memory_manager_state', 'collect_experience_state',
                      'skills_explorer_agent_state']:
        if component in state_dict:
            state_dict[component]['session_id'] = target_session_id

    state = ApplicationState(
        session_id=target_session_id,
        agent_director_state=AgentDirectorState.from_document(state_dict['agent_director_state']),
        explore_experiences_director_state=ExploreExperiencesAgentDirectorState.from_document(state_dict['explore_experiences_director_state']),
        conversation_memory_manager_state=ConversationMemoryManagerState.from_document(state_dict['conversation_memory_manager_state']),
        collect_experience_state=CollectExperiencesAgentState.from_document(state_dict['collect_experience_state']),
        skills_explorer_agent_state=SkillsExplorerAgentState.from_document(state_dict['skills_explorer_agent_state'])
    )
    await state_store.save_state(state)

async def export_import_conversation(source_session_id, target_session_id, json_file_name = None, action="both" ):
    try:
        # Try to initialize settings from environment variables
        settings = Settings()

        # Source database connection
        source_mongo_uri = settings.source_mongodb_uri or mongo_uri
        source_db_name = settings.source_database_name or database_name

        # Target database connection
        target_mongo_uri = settings.target_mongodb_uri or mongo_uri
        target_db_name = settings.target_database_name or database_name

    except Exception as e:
        print(f"Warning: Could not load custom database settings: {e}")
        # Fallback to default settings
        source_mongo_uri = target_mongo_uri = mongo_uri
        source_db_name = target_db_name = database_name

    # Connect to the source database
    source_client = AsyncIOMotorClient(source_mongo_uri, tlsAllowInvalidCertificates=True)
    source_db = source_client.get_database(source_db_name)
    source_state_store = DatabaseApplicationStateStore(source_db)

    # Connect to the target database
    target_client = AsyncIOMotorClient(target_mongo_uri, tlsAllowInvalidCertificates=True)
    target_db = target_client.get_database(target_db_name)
    target_state_store = DatabaseApplicationStateStore(target_db)

    # Create directory if it doesn't exist
    directory = "exported-conversations"
    os.makedirs(directory, exist_ok=True)

    # Initialize file path
    file_path = None

    if action in ["export", "both"]:
        # Create file path based on json_file_name
        if json_file_name:
            # Add .json extension if not present
            if not json_file_name.lower().endswith('.json'):
                json_file_name = f"{json_file_name}.json"
            file_path = os.path.join(directory, json_file_name)
        else:
            # Generate filename with timestamp if none provided
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            filename = f"conversation_{source_session_id}_{timestamp}.json"
            file_path = os.path.join(directory, filename)

        # Export the state to a JSON file
        await export_state_to_json(source_state_store, source_session_id, file_path)
        print(f"State exported to {file_path}")

    if action in ["import", "both"]:
        if json_file_name:
            import_file_path = os.path.join(directory, json_file_name)
        elif file_path:
            # Use the same file path for import if not provided
            import_file_path = file_path
        else:
            raise ValueError("JSON file name is required for import action")

        # Import the state from the JSON file to a new session ID
        await import_state_from_json(target_state_store, import_file_path, target_session_id)
        print(f"State imported from {import_file_path} to session ID {target_session_id}")

    return file_path

def parse_args():
    parser = argparse.ArgumentParser(description="Export and import a conversation state")
    parser.add_argument("--source-session-id", type=int, help="The source session ID to export conversation from")
    parser.add_argument("--target-session-id", type=int, help="The target session ID to import conversation to")
    parser.add_argument("--json-file-name", type=str, help="The name of the JSON file to export to or import from")
    parser.add_argument("--action",
                        type=str,
                        help="The action to perform: export or import or do both",
                        choices=["import", "export", "both"],
                        default="both")

    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    asyncio.run(export_import_conversation(
        args.source_session_id, args.target_session_id, args.json_file_name, args.action
    ))
