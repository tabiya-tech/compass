import asyncio
import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.agent.agent_director.abstract_agent_director import AgentDirectorState
from app.agent.collect_experiences_agent import CollectExperiencesAgentState
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.application_state import ApplicationStateStore, ApplicationState
from app.server_dependencies.database_collections import Collections
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState


class DatabaseApplicationStateStore(ApplicationStateStore):
    """
    A MongoDB store for application state.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
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
            # Using $eq to prevent NoSQL injection
            results = await asyncio.gather(
                self._agent_director_collection.find_one({"session_id": {"$eq": session_id}}, {'_id': False}),
                self._explore_experiences_director_state_collection.find_one({"session_id": {"$eq": session_id}}, {'_id': False}),
                self._conversation_memory_manager_state_collection.find_one({"session_id": {"$eq": session_id}}, {'_id': False}),
                self._collect_experience_state_collection.find_one({"session_id": {"$eq": session_id}}, {'_id': False}),
                self._skills_explorer_agent_state_collection.find_one({"session_id": {"$eq": session_id}}, {'_id': False})
            )

            if not all(results):
                # If any of the states are None, return None
                # but log which ones are None
                collection_names = [
                    'Agent Director',
                    'Explore Experiences Director State',
                    'Conversation Memory Manager State',
                    'Collect Experience State',
                    'Skills Explorer Agent State'
                ]
                # log the ones that are none
                for i, result in enumerate(results):
                    if result is None:
                        self._logger.info("No state found in the database for component %s with session ID %s", collection_names[i], session_id)
                return None

            agent_director_state, explore_experiences_director_state, conversation_memory_manager_state, collect_experience_state, skills_explorer_agent_state = results

            return ApplicationState(session_id=session_id,
                                    agent_director_state=AgentDirectorState.from_document(agent_director_state),
                                    explore_experiences_director_state=ExploreExperiencesAgentDirectorState.from_document(explore_experiences_director_state),
                                    conversation_memory_manager_state=ConversationMemoryManagerState.from_document(conversation_memory_manager_state),
                                    collect_experience_state=CollectExperiencesAgentState.from_document(collect_experience_state),
                                    skills_explorer_agent_state=SkillsExplorerAgentState.from_document(skills_explorer_agent_state))
        except Exception as e:  # pylint: disable=broad-except
            self._logger.error("Failed to get application state for session ID %s: %s", session_id, e, exc_info=True)
            return None

    async def save_state(self, state: ApplicationState):
        """
        Save the application state for a session.
        """
        try:
            # look through all the states to check that they use the same session_id
            # since all the session_ids should be the same, we can use any of them
            # here we use the agent_director_state.session_id
            session_id = state.agent_director_state.session_id
            if not all([state.explore_experiences_director_state.session_id == session_id,
                        state.conversation_memory_manager_state.session_id == session_id,
                        state.collect_experience_state.session_id == session_id,
                        state.skills_explorer_agent_state.session_id == session_id]):
                raise ValueError("All states must have the same session_id")
            # Write the component states to the database
            # Using $eq to prevent NoSQL injection
            await asyncio.gather(
                self._agent_director_collection.update_one({"session_id": {"$eq": session_id}}, {"$set": state.agent_director_state.model_dump()}, upsert=True),
                self._explore_experiences_director_state_collection.update_one({"session_id": {"$eq": session_id}}, {"$set": state.explore_experiences_director_state.model_dump()}, upsert=True),
                self._conversation_memory_manager_state_collection.update_one({"session_id": {"$eq": session_id}}, {"$set": state.conversation_memory_manager_state.model_dump()}, upsert=True),
                self._collect_experience_state_collection.update_one({"session_id": {"$eq": session_id}}, {"$set": state.collect_experience_state.model_dump()}, upsert=True),
                self._skills_explorer_agent_state_collection.update_one({"session_id": {"$eq": session_id}}, {"$set": state.skills_explorer_agent_state.model_dump()}, upsert=True)
            )

        except Exception as e:  # pylint: disable=broad-except
            # Log the error and raise an exception, so that the caller can handle it
            self._logger.error("Failed to save application state for session ID %s: %s", state.agent_director_state.session_id, e, exc_info=True)
            raise

    async def delete_state(self, session_id: int) -> None:
        """
        Delete the application state for a session.
        """
        try:
            # Delete the states from the database
            # Using $eq to prevent NoSQL injection
            await asyncio.gather(
                self._agent_director_collection.delete_one({"session_id": {"$eq": session_id}}),
                self._explore_experiences_director_state_collection.delete_one({"session_id": {"$eq": session_id}}),
                self._conversation_memory_manager_state_collection.delete_one({"session_id": {"$eq": session_id}}),
                self._collect_experience_state_collection.delete_one({"session_id": {"$eq": session_id}}),
                self._skills_explorer_agent_state_collection.delete_one({"session_id": {"$eq": session_id}})
            )

        except Exception as e: # pylint: disable=broad-except
            # Log the error and raise an exception, so that the caller can handle it
            self._logger.error("Failed to delete application state for session ID %s: %s", session_id, e, exc_info=True)
            raise
