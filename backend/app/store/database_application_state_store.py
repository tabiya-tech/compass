import asyncio
import logging

from app.agent.agent_director.abstract_agent_director import AgentDirectorState
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
        self._logger = logging.getLogger(self.__class__.__name__)

        # _store will hold the state for components that are not yet implemented
        # keyed by session ID
        self._store: dict[int, ApplicationState] = {}

        #   This hybrid between in memory and mongodb stores is a temporary setup to implement the database transition
        #   gradually. The full application state will eventually be stored in mongodb.
        #   There will be 5 collections, one for each of the components of the application.
        #   The collections will be named as follows:
        #   - agent_director_state [DONE]
        #   - explore_experiences_state [UNIMPLEMENTED]
        #   - conversation_memory_state [UNIMPLEMENTED]
        #   - collect_experience_state [UNIMPLEMENTED]
        #   - skills_explorer_state [UNIMPLEMENTED]
        #   The components that remain unimplemented will be stored in memory until they are implemented.

    async def get_state(self, session_id: int) -> ApplicationState | None:
        """
        Get the application state for a session from the database and memory.
        """
        try:
            # Get the application state from memory
            # This is a temporary setup to implement the database transition gradually, and will be deleted
            # -------------------------------
            state = self._store.get(session_id)

            if state is None:
                self._logger.info("Application state not found in memory for session ID %s", session_id)
                return None
            # -------------------------------

            # Get the states of the different components from the database
            results = await asyncio.gather(
                self._agent_director_collection.find_one({"session_id": session_id}, {'_id': False}),
                # other collections will be added here
            )

            if not all(results):
                self._logger.info("Application state not found in the database for session ID %s", session_id)
                return None

            agent_director_state = results[0]

            # Overwrite the agent director state in the state object with the one from the database
            state.agent_director_state = AgentDirectorState(**agent_director_state)

            return state
        except Exception as e:
            self._logger.error("Failed to get application state for session ID %s: %s", session_id, str(e))
            return None

    async def save_state(self, session_id: int, state: ApplicationState):
        """
        Save the application state for a session.
        """
        try:
            # Write the agent director state to the database
            await self._agent_director_collection.update_one({"session_id": session_id}, {
                "$set": state.agent_director_state.dict()}, upsert=True)

            # Store the rest of the application state in memory
            self._store[session_id] = state
        except Exception as e:
            # Log the error and raise an exception, so that the caller can handle it
            self._logger.error("Failed to save application state for session ID %s: %s", session_id, str(e))
            raise

    async def delete_state(self, session_id: int) -> None:
        """
        Delete the application state for a session.
        """
        try:
            # Delete the agent director state from the database
            await self._agent_director_collection.delete_one({"session_id": session_id})

            # Remove the state from the in-memory store
            if session_id in self._store:
                del self._store[session_id]
        except Exception as e:
            # Log the error and raise an exception, so that the caller can handle it
            self._logger.error("Failed to delete application state for session ID %s: %s", session_id, str(e))
            raise