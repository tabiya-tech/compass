import asyncio
import logging

from app.application_state import ApplicationStateStore, ApplicationState
from app.constants.database import Collections
from app.server_dependecies.db_dependecies import get_mongo_db


class DatabaseApplicationStateStore(ApplicationStateStore):
    """
    A MongoDB store for application state.
    """
    def __init__(self):
        db = get_mongo_db()
        self._agent_director_collection = db.get_collection(Collections.AGENT_DIRECTOR_STATE)
        self._explore_experiences_director_state_collection = db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)
        self._conversation_memory_manager_state_collection = db.get_collection(Collections.CONVERSATION_MEMORY_MANAGER_STATE)
        self._collect_experience_state_collection = db.get_collection(Collections.COLLECT_EXPERIENCE_STATE)
        self._skills_explorer_agent_state_collection = db.get_collection(Collections.SKILLS_EXPLORER_AGENT_STATE)
        self._logger = logging.getLogger(self.__class__.__name__)

    async def get_state(self, session_id: int) -> ApplicationState | None:
        """
        Get the application state for a session from the databaseProtected Attributes and memory.
        """
        try:

            # Get the states of the different components from the database
            results = await asyncio.gather(
                self._agent_director_collection.find_one({"session_id": session_id}, {'_id': False}),
                self._explore_experiences_director_state_collection.find_one({"session_id": session_id}, {'_id': False}),
                self._conversation_memory_manager_state_collection.find_one({"session_id": session_id}, {'_id': False}),
                self._collect_experience_state_collection.find_one({"session_id": session_id}, {'_id': False}),
                self._skills_explorer_agent_state_collection.find_one({"session_id": session_id}, {'_id': False})
            )

            if not all(results):
                self._logger.info("Application state not found in the database for session ID %s", session_id)
                return None

            state_dict = {
                "agent_director_state": results[0],
                "explore_experiences_director_state": results[1],
                "conversation_memory_manager_state": results[2],
                "collect_experience_state": results[3],
                "skills_explorer_agent_state": results[4],
            }

            return ApplicationState(session_id=session_id, **state_dict)
        except Exception as e:
            self._logger.error("Failed to get application state for session ID %s: %s", session_id, str(e))
            return None

    async def save_state(self, session_id: int, state: ApplicationState):
        """
        Save the application state for a session.
        """
        try:
            # Write the component states to the database
            await asyncio.gather(
                self._agent_director_collection.update_one({"session_id": session_id}, {"$set": state.agent_director_state.dict()}, upsert=True),
                self._explore_experiences_director_state_collection.update_one({"session_id": session_id}, {"$set": state.explore_experiences_director_state.dict()}, upsert=True),
                self._conversation_memory_manager_state_collection.update_one({"session_id": session_id}, {"$set": state.conversation_memory_manager_state.dict()}, upsert=True),
                self._collect_experience_state_collection.update_one({"session_id": session_id}, {"$set": state.collect_experience_state.dict()}, upsert=True),
                self._skills_explorer_agent_state_collection.update_one({"session_id": session_id}, {"$set": state.skills_explorer_agent_state.dict()}, upsert=True)
            )
        except Exception as e:
            # Log the error and raise an exception, so that the caller can handle it
            self._logger.error("Failed to save application state for session ID %s: %s", session_id, str(e))
            raise

    async def delete_state(self, session_id: int) -> None:
        """
        Delete the application state for a session.
        """
        try:
            # Delete the states from the database
            await asyncio.gather(
                self._agent_director_collection.delete_one({"session_id": session_id}),
                self._explore_experiences_director_state_collection.delete_one({"session_id": session_id}),
                self._conversation_memory_manager_state_collection.delete_one({"session_id": session_id}),
                self._collect_experience_state_collection.delete_one({"session_id": session_id}),
                self._skills_explorer_agent_state_collection.delete_one({"session_id": session_id})
            )
        except Exception as e:
            # Log the error and raise an exception, so that the caller can handle it
            self._logger.error("Failed to delete application state for session ID %s: %s", session_id, str(e))
            raise
