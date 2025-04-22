import logging
import os
from textwrap import dedent
from typing import AsyncIterator, Optional
from datetime import datetime

from app.application_state import ApplicationState, ApplicationStateStore

MarkdownOnlyForExportError = Exception("MarkdownConversationStateStore is only for exporting")


class MarkdownConversationStateStore(ApplicationStateStore):
    """
    A store that saves conversation states to markdown files.
    Each session is stored in a separate file named analysis-{session_id}.md.
    Only implements save_state as it's only used for exporting conversations.
    """

    def __init__(self, directory_path: str):
        """
        Initialize the markdown conversation state store.
        :param directory_path: The directory where markdown files will be stored
        """
        self._directory_path = directory_path
        os.makedirs(self._directory_path, exist_ok=True)
        self._logger = logging.getLogger(self.__class__.__name__)

    def _get_file_path(self, session_id: int) -> str:
        """Get the file path for a session ID"""
        session_id_path = os.path.join(self._directory_path, str(session_id))
        os.makedirs(session_id_path, exist_ok=True)
        return os.path.join(session_id_path, "conversation.md")

    def _format_message(self, message: str):
        """Format a message for markdown"""
        return message.replace("\n", "<br/>")

    def _formatted_duration(self, first_timestamp: datetime, second_timestamp: datetime):
        """Get formatted duration, eg: 1 hour, 4 minutes and 2 seconds """
        duration = second_timestamp - first_timestamp
        hours, remainder = divmod(duration.total_seconds(), 3600)
        minutes, seconds = divmod(remainder, 60)
        parts = []
        if hours:
            parts.append(f"{int(hours)} hr{'s' if hours > 1 else ''}")
        if minutes:
            parts.append(f"{int(minutes)} min{'s' if minutes > 1 else ''}")
        if seconds:
            parts.append(f"{int(seconds)} sec{'s' if seconds > 1 else ''}")
        return ' and '.join(parts)

    async def save_state(self, state: ApplicationState):
        """
        Save a conversation state to a markdown file.
        Only saves the conversation history from all_history.
        :param state: The state to save
        """
        # Get the conversation history from the state
        memory_state = state.conversation_memory_manager_state
        if not memory_state or not memory_state.all_history:
            self._logger.warning(f"No conversation history found for session {state.session_id}")
            return

        # Create markdown content
        markdown_lines = []
        conversation_started_at = memory_state.all_history.turns[0].output.sent_at
        conversation_ended_at = memory_state.all_history.turns[len(memory_state.all_history.turns) - 1].output.sent_at
        markdown_lines.append(dedent(f"""
        # Conversation {state.session_id}
        
        Conversation started at: {conversation_started_at.isoformat()}  
        Conversation ended at: {conversation_ended_at.isoformat()}  
        Conversation duration: {self._formatted_duration(conversation_started_at, conversation_ended_at)}
        
        ## Messages
        | turn | Compass | User | Time elapsed (since previous message) | Agent |
        |------|---------|------|-----------|-------|"""))

        # Write conversation turns
        turn_count = 1
        previous_time_stamp = conversation_started_at
        for index, turn in enumerate(memory_state.all_history.turns):
            if not turn.input.is_artificial and turn.input.message:
                markdown_lines.append(f"| {turn_count} | "
                                      f"| {self._format_message(turn.input.message)} "
                                      f"| {self._formatted_duration(previous_time_stamp, turn.input.sent_at)} "
                                      f"| {turn.output.agent_type.value} |")
                turn_count += 1
                previous_time_stamp = turn.input.sent_at

            markdown_lines.append(dedent(f"| {turn_count} "
                                         f"| {self._format_message(turn.output.message_for_user)} "
                                         f"| | {self._formatted_duration(previous_time_stamp, turn.output.sent_at)} "
                                         f"| {turn.output.agent_type.value} |"))
            previous_time_stamp = turn.output.sent_at

        # Write to file
        markdown_path = self._get_file_path(state.session_id)
        try:
            with open(markdown_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(markdown_lines))
            self._logger.info(f"Conversation saved to {markdown_path}")
        except Exception as e:
            self._logger.error(f"Error saving markdown for session {state.session_id}: {e}")
            raise

    async def get_state(self, session_id: int) -> Optional[ApplicationState]:
        """Not implemented as this store is only for exporting"""
        raise MarkdownOnlyForExportError

    async def delete_state(self, session_id: int) -> None:
        """Not implemented as this store is only for exporting"""
        raise MarkdownOnlyForExportError

    async def get_all_session_ids(self) -> AsyncIterator[int]:
        """Not implemented as this store is only for exporting"""
        raise MarkdownOnlyForExportError
