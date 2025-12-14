import json
import logging
import os
from pathlib import Path
from typing import Optional, AsyncGenerator

from app.agent.agent_director.abstract_agent_director import AgentDirectorState
from app.agent.collect_experiences_agent import CollectExperiencesAgentState
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.agent.welcome_agent import WelcomeAgentState
from app.agent.preference_elicitation_agent import PreferenceElicitationAgentState
from app.application_state import ApplicationState, ApplicationStateStore
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState


class JSONApplicationStateStore(ApplicationStateStore):
    """
    A store that saves application states to individual JSON files.
    Each session is stored in a separate file named export-{session_id}.json.
    """

    def __init__(self, directory_path: str):
        """
        Initialize the JSON application state store.
        :param directory_path: The directory where JSON files will be stored
        """
        self._directory_path = directory_path
        os.makedirs(self._directory_path, exist_ok=True)
        self._logger = logging.getLogger(self.__class__.__name__)

    def _get_file_path(self, session_id: int) -> str:
        """Get the file path for a session ID"""
        session_id_path = os.path.join(self._directory_path, str(session_id))
        os.makedirs(session_id_path, exist_ok=True)
        return os.path.join(session_id_path, "state.json")

    async def get_state(self, session_id: int) -> Optional[ApplicationState]:
        """
        Get a state by session ID.
        :param session_id: The session ID
        :return: The state, or None if not found
        """
        file_path = self._get_file_path(session_id)
        self._logger.debug(f"Reading state for session id {session_id} from JSON file: {file_path}")

        if not os.path.exists(file_path):
            self._logger.warning(f"State file for session {session_id} does not exist: {file_path}")
            return None

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                state_dict = json.load(f)
                return ApplicationState(
                    session_id=session_id,
                    agent_director_state=AgentDirectorState.from_document(state_dict['agent_director_state']),
                    welcome_agent_state=WelcomeAgentState.from_document(state_dict['welcome_agent_state']),
                    explore_experiences_director_state=ExploreExperiencesAgentDirectorState.from_document(
                        state_dict['explore_experiences_director_state']),
                    conversation_memory_manager_state=ConversationMemoryManagerState.from_document(
                        state_dict['conversation_memory_manager_state']),
                    collect_experience_state=CollectExperiencesAgentState.from_document(
                        state_dict['collect_experience_state']),
                    skills_explorer_agent_state=SkillsExplorerAgentState.from_document(
                        state_dict['skills_explorer_agent_state']),
                    preference_elicitation_agent_state=PreferenceElicitationAgentState.from_document(
                        state_dict['preference_elicitation_agent_state'])
                )
        except (json.JSONDecodeError, FileNotFoundError) as e:
            self._logger.error(f"Error reading state file for session {session_id}: {e}")
            return None

    async def save_state(self, state: ApplicationState):
        """
        Save a state to a JSON file.
        :param state: The state to save
        """
        file_path = self._get_file_path(state.session_id)
        state_dict = json.loads(state.model_dump_json())

        try:
            self._logger.debug(f"Saving state for session id {state.session_id} to JSON file: {file_path}")
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(state_dict, f, indent=2)
        except Exception as e:
            self._logger.error(f"Error saving state for session {state.session_id}: {e}")
            raise

    async def delete_state(self, session_id: int) -> bool:
        """
        Delete a state file.
        
        Args:
            session_id: The session ID of the state to delete
            
        Returns:
            True if the state was deleted, False if it didn't exist
        """
        file_path = self._get_file_path(session_id)
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
            return False
        except Exception as e:
            self._logger.error(f"Error deleting state file for session {session_id}: {e}")
            return False

    async def get_all_session_ids(self) -> AsyncGenerator[int, None]:
        """
        Get all session IDs from the JSON files in the directory.

        :return: An async generator that yields session IDs
        """
        directory = Path(self._directory_path)
        for file_path in directory.iterdir():
            try:
                # Extract session ID from filename
                filename = os.path.basename(file_path)
                session_id = int(filename)
                yield session_id
            except Exception as e:
                self._logger.error(f"Error parsing session ID from file {file_path}: {e}")
                continue
