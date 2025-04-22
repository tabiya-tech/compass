#!/usr/bin/env python3

import argparse
import asyncio
import logging
import os.path
from textwrap import dedent
from typing import Optional

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

from app.application_state import ApplicationStateStore
from common_libs.logging.log_utilities import setup_logging_config

from constants import SCRIPT_DIR, DEFAULT_EXPORTS_DIR
from _common import StoreType, create_store, get_db_connection
from _application_state_queue import ApplicationStateQueue, _fetcher, _saver

# set up the logging
setup_logging_config(os.path.join(SCRIPT_DIR, "logging.cfg.yaml"))
logger = logging.getLogger(__name__)

load_dotenv()


class Settings(BaseSettings):
    """
    Settings for the export script.

    All the fields are optional, because they are required depending on user's needs.
    """

    # source database
    source_mongodb_uri: Optional[str] = None
    source_database_name: Optional[str] = None

    class Config:
        env_prefix = "EXPORT_CONVERSATION_"


def _get_source_store(settings: Settings, output_directory: str, source_type: StoreType) -> ApplicationStateStore:
    if source_type == "JSON":
        source_store = create_store(source_type, folder_path=output_directory)
    elif source_type == "DB":
        if not settings.source_mongodb_uri or not settings.source_database_name:
            raise ValueError("Source MongoDB URI and database name are required")

        source_db = get_db_connection(settings.source_mongodb_uri, settings.source_database_name)

        source_store = create_store(
            source_type,
            db=source_db
        )
    else:
        raise ValueError(f"Unsupported source store type: {source_type}")

    return source_store


def _get_target_store(output_directory: str, target_type: StoreType) -> ApplicationStateStore:
    if target_type == "JSON":
        target_store = create_store(target_type, folder_path=output_directory)
    elif target_type == "MD":
        target_store = create_store(target_type, folder_path=output_directory)
    else:
        raise ValueError(f"Unsupported target store type: {target_type}")

    return target_store


def _parse_args():
    parser = argparse.ArgumentParser(
        description="Export sessions from a source store to a target store.",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=dedent("""
        Environment Variables:
          Source database (required if source is DB):
            EXPORT_CONVERSATION_SOURCE_MONGODB_URI    MongoDB connection URI for source database
            EXPORT_CONVERSATION_SOURCE_DATABASE_NAME  Database name for source

        Notes:
          - When exporting to JSON, files are saved in the 'output_dir/{{ session-id }}/state.json' directory
          - When exporting to MD, files are saved in the 'output_dir/{{ session-id }}/conversation.md' directory
          - The script will exit with code 1 if the export fails
        """)
    )
    
    # Required session IDs
    parser.add_argument(
        "--session-ids",
        type=int,
        nargs="+",
        required=True,
        help="Session IDs to export, separated by space. eg: 1 2 3"
    )

    # Source and target types
    parser.add_argument(
        "--source",
        type=str,
        choices=["DB", "JSON"],
        required=True,
        help="Source store type (DB or JSON)"
    )

    parser.add_argument(
        "--target",
        type=str,
        choices=["JSON", "MD"],
        required=True,
        help="Target store type (JSON or MD)"
    )

    parser.add_argument(
        "--output-dir",
        type=str,
        default=DEFAULT_EXPORTS_DIR,
        help=f"The Output directory for th export script. Default value is {DEFAULT_EXPORTS_DIR}. "
             f"Absolute path or relative path to the running directory"
    )
    
    args = parser.parse_args()

    # Prevent source type and target type from being the same.
    if args.source == args.target:
        parser.error("Source and target store types cannot be the same")

    return args


async def export_conversations(
        session_ids: list[int],
        source_type: StoreType,
        target_type: StoreType,
        output_directory: str,
        queue_size: int = 5
) -> None:
    """
    Export multiple conversations from source to target store.

    Uses a producer-consumer pattern with a queue for efficient processing.
    Errors are logged and skipped to allow processing to continue.

    Args:
        session_ids: List of session IDs of the conversations to export
        source_type: Type of source store ('JSON' or 'DB')
        target_type: Type of target store ('JSON' or 'MD')
        output_directory: Directory where the exported files will be saved
        queue_size: Size of the processing queue.
    """

    # get the script settings.
    settings = Settings()

    logger.info(f"Exporting conversations from: {source_type}, to: {target_type}")
    logger.info(f"Output directory where files will be saved: {output_directory}")

    # 1. Set up source store.
    source_store = _get_source_store(settings=settings, source_type=source_type, output_directory=output_directory)

    # 2. Set up target store.
    target_store = _get_target_store(target_type=target_type, output_directory=output_directory)

    # 3. Create a queue for application states.
    queue: ApplicationStateQueue = asyncio.Queue(maxsize=queue_size)

    # 4. Run both stages (fetch and save) concurrently.
    await asyncio.gather(
        _fetcher(
            queue=queue,
            source_store=source_store,
            session_ids=session_ids),

        _saver(
            queue=queue,
            target_store=target_store)
    )


async def main():
    args = _parse_args()
    
    try:
        await export_conversations(
            session_ids=args.session_ids,
            source_type=args.source,
            target_type=args.target,
            output_directory=args.output_dir,
        )
    except Exception as e:
        logger.error(f"Error during export: {str(e)}")
        logger.exception(e)
        exit(1)


if __name__ == "__main__":
    asyncio.run(main())
