import asyncio
import os
import argparse

from datetime import datetime
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from app.store.json_application_state_store import JsonApplicationStateStore

load_dotenv()

# Access the environment variables
mongo_uri = os.getenv("APPLICATION_MONGODB_URI")
database_name = os.getenv("APPLICATION_DATABASE_NAME")

async def export_import_conversation(source_session_id, target_session_id, target_user_id):
    # Connect to the MongoDB database
    client = AsyncIOMotorClient(mongo_uri,
                                tlsAllowInvalidCertificates=True)
    db = client.get_database(database_name)

    # Initialize the state store
    state_store = JsonApplicationStateStore(db)

    # Create directory if it doesn't exist
    directory = "exported-conversations"
    os.makedirs(directory, exist_ok=True)

    # Generate a filename with timestamp and session ID
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    filename = f"conversation_{source_session_id}_{timestamp}.json"
    file_path = os.path.join(directory, filename)

    # Export the state to a JSON file
    await state_store.export_state_to_json(source_session_id, file_path)
    print(f"State exported to {file_path}")

    # Import the state from the JSON file to a new session ID
    await state_store.import_state_from_json(file_path, target_session_id, target_user_id)
    print(f"State imported from {file_path} to session ID {target_session_id} and user ID {target_user_id}")

def parse_args():
    parser = argparse.ArgumentParser(description="Export and import a conversation state")
    parser.add_argument("--source-session-id", type=int, help="The source session ID to export conversation from")
    parser.add_argument("--target-session-id", type=int, help="The target session ID to import conversation to")
    parser.add_argument("--target-user-id", type=str, help="The target user ID to assign to the imported conversation")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    asyncio.run(export_import_conversation(
        args.source_session_id, args.target_session_id, args.target_user_id
    ))