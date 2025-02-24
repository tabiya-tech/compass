import asyncio
import logging
import argparse
import os
import dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from app.store.database_application_state_store import DatabaseApplicationStateStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def migrate_messages(*, mongo_uri: str, database_name: str, hot_run: bool = False):
    """
    Migration script to process all states and save them back, allowing message IDs 
    to be automatically generated during state construction.
    Args:
        mongo_uri: MongoDB connection URI
        database_name: Name of the database to use
        hot_run: True, if the script should make changes in the database, otherwise False to only log changes
    """
    try:
        # Get application database using the provider
        # Connect to MongoDB
        client = AsyncIOMotorClient(mongo_uri,
                                    tlsAllowInvalidCertificates=True)
        db = client.get_database(database_name)
        state_store = DatabaseApplicationStateStore(db)

        # Counters for reporting
        total_states = 0
        processed_states = 0
        errored = 0

        logger.info(f"Starting migration {'(HOT RUN)' if hot_run else ''}")

        # Stream all states
        try:
            async for session_id in state_store.get_all_session_ids():
                try:
                    state = await state_store.get_state(session_id)
                    total_states += 1

                    if hot_run:
                        # Save the state back - this will trigger message ID generation
                        await state_store.save_state(state)

                    processed_states += 1
                    action = "Process" if hot_run else "would process"
                    logger.info(f"{action} state for session {session_id}")

                except Exception as e:
                    errored += 1
                    logger.error(f"Error processing state for session {session_id}: {str(e)}")
                    continue

        except Exception as e:
            errored += 1
            logger.error(f"Error loading state: {str(e)}")

        # Log summary
        logger.info(f"Migration {'completed ' if hot_run else ''}simulated!")
        logger.info(f"Total states found: {total_states}")
        logger.info(f"States processed: {processed_states}")
        logger.info(f"Errors: {errored}")
        logger.info(f"Successfully processed: {processed_states - errored}")

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        raise


def parse_args():
    parser = argparse.ArgumentParser(description='Migrate states to add message IDs.')
    parser.add_argument('--hot-run', action='store_true', help='Run in "hot mode" and make changes in the database')
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    env = dotenv.find_dotenv()
    dotenv.load_dotenv(env)
    _mongo_uri = os.getenv("MIGRATE_APPLICATION_MONGO_URI")
    if not _mongo_uri:
        raise ValueError("Missing required environment variable: MIGRATE_APPLICATION_MONGO_URI")
    _database_name = os.getenv("MIGRATE_APPLICATION_DB_NAME")
    if not _database_name:
        raise ValueError("Missing required environment variable: MIGRATE_APPLICATION_DB_NAME")
    asyncio.run(migrate_messages(mongo_uri=_mongo_uri, database_name=_database_name, hot_run=True))
