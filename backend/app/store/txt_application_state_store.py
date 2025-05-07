import logging
import os
from typing import AsyncIterator

from app.application_state import ApplicationStateStore, ApplicationState

logger = logging.getLogger(__name__)


def _format_message(message: str):
    """Format a message for markdown"""
    return message.replace("\n", "\n\t\t")


class TxtApplicationStateStore(ApplicationStateStore):
    """
    A store that saves conversation states to text files.
    Conversations are stored in files grouped by the date the conversation was conducted as {date}.txt.

    Only implements save_state as it's only used for exporting conversations.
    """

    _output_dir: str
    """
    output-dir: str - The directory where the conversation files will be saved.
    """

    _created_files: list[str]
    """
    _created_files - save created files to avoid overwriting, by knowing when to append or overwrite
    """

    def __init__(self, output_dir: str):
        self._created_files = []
        self._output_dir = output_dir

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

        state_date_file_name = f"{state.agent_director_state.conversation_conducted_at.date().strftime('%Y-%m-%d')}.txt"

        # if the file is already created then append to it
        # Otherwise overwrite to it.
        if state_date_file_name in self._created_files:
            mode = "a+"
        else:
            mode = "w+"
            self._created_files.append(state_date_file_name)

        # Write in the TXT file.
        with open(os.path.join(self._output_dir, state_date_file_name), mode, encoding='utf-8') as f:
            f.write(report_content)
