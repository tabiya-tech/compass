#!/usr/bin/env python3

import asyncio
import json
import logging
import os
from typing import Optional

from dotenv import load_dotenv

from _base import Settings
from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.server_dependencies.database_collections import Collections
from common_libs.logging.log_utilities import setup_logging_config
from scripts.export_discovered_skills._get_skills_to_export import _get_skills_to_export
from scripts.export_discovered_skills.utils import get_db_connection

# Current file directory.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Load environment variables from .env file.
load_dotenv()

# setup logging configuration
setup_logging_config(os.path.join(SCRIPT_DIR, "logging.cfg.yaml"))

logger = logging.getLogger(__name__)


async def _export_discovered_skills(*,
                                    output_directory: str,
                                    only_conversation_phase: Optional[ConversationPhase] = None,
                                    excluded_session_ids: Optional[list[int]] = None) -> None:
    """
    Export discovered skills to a JSON file.
    """

    settings = Settings()  # type: ignore

    logger.info("exporting discovered skills....")
    logger.info("Output directory: %s", output_directory)

    # Stream the conversations IDs matching the user input
    query = {}

    if excluded_session_ids:
        query["session_id"] = {
            "$nin": excluded_session_ids
        }

    if only_conversation_phase is not None:
        query["current_phase"] = {
            "$eq": only_conversation_phase.name
        }

    application_db = get_db_connection(settings.application_mongo_db_uri, settings.application_mongo_db_name)
    agent_director_collection = application_db.get_collection(Collections.AGENT_DIRECTOR_STATE)
    conversations = await agent_director_collection.find(query).to_list(length=None)

    taxonomy_db = get_db_connection(settings.taxonomy_mongo_db_uri, settings.taxonomy_mongo_db_name)

    skills_to_export = await _get_skills_to_export(application_db=application_db, taxonomy_db=taxonomy_db, conversations=conversations)

    os.makedirs(output_directory, exist_ok=True)

    output_file_name = os.path.join(output_directory, "discovered_skills.json")
    logger.info("Exporting discovered skills to %s", output_file_name)

    with open(output_file_name, "w") as file:
        json.dump(skills_to_export, file, indent=3)


def parse_args():
    """
    Parse command line arguments.
    """
    import argparse

    parser = argparse.ArgumentParser(
        description="Export discovered skills to a JSON file.",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog="Environment Variables:\n"
               "  EXPORT_DISCOVERED_SKILLS_APPLICATION_MONGO_DB_URI    MongoDB connection URI\n"
               "  EXPORT_DISCOVERED_SKILLS_APPLICATION_MONGO_DB_NAME   Database name\n"

               "  EXPORT_DISCOVERED_SKILLS_TAXONOMY_MONGO_DB_URI       MongoDB connection URI\n"
               "  EXPORT_DISCOVERED_SKILLS_TAXONOMY_MONGO_DB_NAME      Database name\n"
    )

    parser.add_argument(
        "--output-directory",
        type=str,
        required=True,
        help="Directory to save the exported JSON file. Absolute path or relative to the current working directory.",
    )

    parser.add_argument(
        "--only-conversation-phase",
        type=str,
        default=None,
        choices=[phase.name for phase in ConversationPhase],
        help="Export only the skills whose conversation are in the specified conversation phase."
    )

    parser.add_argument(
        "--excluded-session-ids",
        required=False,
        type=int,
        nargs="+",
        help="Session ids to exclude when separated by a space")

    return parser.parse_args()


if __name__ == "__main__":
    _args = parse_args()

    # Get the only conversation phase to export, otherwise None,
    _only_conversation_phase = ConversationPhase[
        _args.only_conversation_phase] if _args.only_conversation_phase else None

    # Export Discovered Skills.
    asyncio.run(_export_discovered_skills(
        output_directory=_args.output_directory,
        excluded_session_ids=_args.excluded_session_ids,
        only_conversation_phase=_only_conversation_phase
    ))
