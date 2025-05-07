#!/usr/bin/env python3

import argparse
import asyncio
import logging
import os
from datetime import datetime, date
from textwrap import dedent
from typing import AsyncIterator

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic_settings import BaseSettings

from app.application_state import ApplicationStateStore, ApplicationState
from app.server_dependencies.database_collections import Collections
from common_libs.logging.log_utilities import setup_logging_config
from scripts.export_conversation._application_state_queue import ApplicationStateQueue, _fetcher, _saver
from scripts.export_conversation._common import get_db_connection, create_store
from scripts.export_conversation.constants import SCRIPT_DIR

setup_logging_config(os.path.join(SCRIPT_DIR, "logging.cfg.yaml"))
logger = logging.getLogger(__name__)

load_dotenv()


class Settings(BaseSettings):
    """
    Settings for the export conversation report.
    """

    # source database
    source_mongodb_uri: str
    source_database_name: str

    class Config:
        env_prefix = "EXPORT_CONVERSATION_REPORT_"


def _format_message(message: str):
    """Format a message for markdown"""
    return message.replace("\n", "\n\t\t")


class ConversationReportWriter(ApplicationStateStore):
    _conversations: list[str]
    _date: str

    def __init__(self, _date: date):
        self._conversations = []
        self._date = str(_date)

    async def get_state(self, session_id: int) -> ApplicationState:
        raise NotImplementedError

    async def delete_state(self, session_id: int) -> None:
        raise NotImplementedError

    async def get_all_session_ids(self) -> AsyncIterator[int]:
        raise NotImplementedError

    async def save_state(self, state: ApplicationState):
        report_content = "<conversation>\n"
        memory_state = state.conversation_memory_manager_state
        if not memory_state or not memory_state.all_history:
            logger.warning(f"No conversation history found for session {state.session_id}")
            return

        for index, turn in enumerate(memory_state.all_history.turns):
            if not turn.input.is_artificial and turn.input.message:
                report_content += (f"\t{state.session_id}: {_format_message(turn.input.message)}\n\n"
                                   f"\tcompass: {_format_message(turn.output.message_for_user)}\n")
            else:
                report_content += (f""
                                   f"\tcompass: {_format_message(turn.output.message_for_user)}\n"
                                   f"")

        report_content += "</conversation>\n"

        self._conversations.append(report_content)

    def write_to_file(self, output_directory: str):
        os.makedirs(output_directory, exist_ok=True)
        output_file_path = os.path.join(output_directory, f"{self._date}.txt")

        logger.info(f"Saving conversations report on date: {self._date} to {output_file_path}")

        report_content = ""

        for conversation in self._conversations:
            report_content += conversation

        with open(output_file_path, "w+", encoding='utf-8') as f:
            f.write(report_content)


def _valid_date(date_str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise argparse.ArgumentTypeError(f"Invalid date: '{date_str}'. Expected format: YYYY-MM-DD.")


async def export_conversations_report_by_date(*,
                                              db_connection: AsyncIOMotorDatabase,
                                              db_store: ApplicationStateStore,
                                              _date: date,
                                              output_directory):
    """
    Export conversations report by date.
    """

    queue = ApplicationStateQueue()

    writer = ConversationReportWriter(_date)

    logger.info(f"Exporting conversations report for date: {_date}...")

    start_of_date = datetime.combine(_date, datetime.min.time())
    end_of_date = datetime.combine(_date, datetime.max.time())

    logger.info(f"Fetching conversations conducted between {start_of_date} and {end_of_date}")
    sessions = await db_connection.get_collection(Collections.AGENT_DIRECTOR_STATE).find(
        dict(
            conversation_conducted_at={
                "$gte": start_of_date,
                "$lt": end_of_date
            }),
        dict(
            session_id=1
        )).to_list(None)

    logger.info(f"Found {len(sessions)} conversations on date {_date}")

    session_ids = [s["session_id"] for s in sessions]
    await asyncio.gather(
        # fetch from the database.
        _fetcher(
            queue=queue,
            source_store=db_store,
            session_ids=session_ids),
        # and save them in our file writer.
        _saver(
            queue=queue,
            target_store=writer)
    )

    writer.write_to_file(output_directory)


async def _export_conversations_report(*, dates: list[date], output_directory: str):
    """
    Export conversations report to the TXT format.

    :param dates: List of dates to export.
    :param output_directory: The output directory to save the report. An absolute path or relative path when running the script.
    """

    logger.info("Exporting conversations report...")

    # load environment variables
    settings = Settings()  # type: ignore[call-arg]

    # create the source database connection
    source_db = get_db_connection(settings.source_mongodb_uri, settings.source_database_name)
    db_store = create_store("DB", db=source_db)

    await asyncio.gather(*[
        # process all the dates in parallel
        # for each day, fetch the conversations conducted on that day.
        export_conversations_report_by_date(db_connection=source_db,
                                            db_store=db_store,
                                            _date=_date,
                                            output_directory=output_directory) for _date in dates])


def _parse_args():
    parser = argparse.ArgumentParser(
        description="Export conversations report to the TXT format.",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=dedent("""
                        Environment Variables:
                          Source database:
                            EXPORT_CONVERSATION_REPORT_SOURCE_MONGODB_URI    MongoDB connection URI for source database
                            EXPORT_CONVERSATION_REPORT__SOURCE_DATABASE_NAME  Database name for source
                            
                        Th saved format is TXT.
                        Example:
                        ```
                        <conversation>
                            compass: hello
                            {{ session_id }}: I am fine, thank you.
                        </conversation>
                        
                        <conversation>
                            compass: hello
                            {{ session_id }}: hi
                        </conversation>
                        ```
                        """)
    )

    parser.add_argument(
        "--dates",
        nargs="+",
        required=True,
        type=_valid_date,
        help="Dates to export, separated by space. eg: 2000-01-01 2000-01-02"
    )

    parser.add_argument(
        "--output-directory",
        required=True,
        type=str,
        help="The output directory to save the report. Absolute path or relative path when running the script. "
             "All the conversations will be saved in this directory/{{ date }}.txt",
    )

    args = parser.parse_args()

    return args


async def main():
    args = _parse_args()

    try:
        await _export_conversations_report(
            dates=args.dates,
            output_directory=args.output_directory,
        )

    except Exception as e:
        logger.error(f"Error during export: {str(e)}")
        logger.exception(e)
        exit(1)


if __name__ == "__main__":
    asyncio.run(main())
