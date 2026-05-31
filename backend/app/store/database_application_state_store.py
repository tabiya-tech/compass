import asyncio
import logging
from typing import AsyncIterator

from motor.motor_asyncio import AsyncIOMotorDatabase

from ._utils import filter_explored_experiences

from app.agent.agent_director.abstract_agent_director import AgentDirectorState
from app.agent.collect_experiences_agent import CollectExperiencesAgentState
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.agent.welcome_agent import WelcomeAgentState
from app.agent.preference_elicitation_agent import PreferenceElicitationAgentState
from app.agent.recommender_advisor_agent import RecommenderAdvisorAgentState
from app.application_state import ApplicationStateStore, ApplicationState
from app.server_dependencies.database_collections import Collections
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState


class DatabaseApplicationStateStore(ApplicationStateStore):
    """
    A MongoDB store for application state.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self._agent_director_collection = db.get_collection(Collections.AGENT_DIRECTOR_STATE)
        self._welcome_agent_state = db.get_collection(Collections.WELCOME_AGENT_STATE)
        self._explore_experiences_director_state_collection = db.get_collection(Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE)
        self._conversation_memory_manager_state_collection = db.get_collection(Collections.CONVERSATION_MEMORY_MANAGER_STATE)
        self._collect_experience_state_collection = db.get_collection(Collections.COLLECT_EXPERIENCE_STATE)
        self._skills_explorer_agent_state_collection = db.get_collection(Collections.SKILLS_EXPLORER_AGENT_STATE)
        self._preference_elicitation_agent_state_collection = db.get_collection(Collections.PREFERENCE_ELICITATION_AGENT_STATE)
        self._recommender_advisor_agent_state_collection = db.get_collection(Collections.RECOMMENDER_ADVISOR_AGENT_STATE)
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
                self._welcome_agent_state.find_one({"session_id": {"$eq": session_id}}, {'_id': False}),
                self._explore_experiences_director_state_collection.find_one({"session_id": {"$eq": session_id}}, {'_id': False}),
                self._conversation_memory_manager_state_collection.find_one({"session_id": {"$eq": session_id}}, {'_id': False}),
                self._collect_experience_state_collection.find_one({"session_id": {"$eq": session_id}}, {'_id': False}),
                self._skills_explorer_agent_state_collection.find_one({"session_id": {"$eq": session_id}}, {'_id': False}),
                self._preference_elicitation_agent_state_collection.find_one({"session_id": {"$eq": session_id}}, {'_id': False}),
                self._recommender_advisor_agent_state_collection.find_one({"session_id": {"$eq": session_id}}, {'_id': False})
            )
            if all(_state_part is None for _state_part in results):
                # If all the states are None, return None
                self._logger.info("No application state found for session ID %s", session_id)
                return None

            collection_names = [
                Collections.AGENT_DIRECTOR_STATE,
                Collections.WELCOME_AGENT_STATE,
                Collections.EXPLORE_EXPERIENCES_DIRECTOR_STATE,
                Collections.CONVERSATION_MEMORY_MANAGER_STATE,
                Collections.COLLECT_EXPERIENCE_STATE,
                Collections.SKILLS_EXPLORER_AGENT_STATE,
                Collections.PREFERENCE_ELICITATION_AGENT_STATE,
                Collections.RECOMMENDER_ADVISOR_AGENT_STATE
            ]

            if len(collection_names) != len(results):
                self._logger.error(
                    "Mismatch between collection names and results for session ID %s. "
                    "Expected %d results, got %d.",
                    session_id,
                    len(collection_names),
                    len(results)
                )
                return None

            missing_parts = [name for name, result in zip(collection_names, results) if result is None]
            # Allow recommender_advisor_agent_state to be missing for backward compatibility
            critical_missing_parts = [name for name in missing_parts if name != Collections.RECOMMENDER_ADVISOR_AGENT_STATE]
            if critical_missing_parts:
                self._logger.error(
                    "Missing critical application state part(s) for session ID %s. Missing part(s): %s",
                    session_id,
                    critical_missing_parts
                )
                return None

            # Successfully retrieved all states
            (agent_director_state,
             welcome_agent_state,
             explore_experiences_director_state,
             conversation_memory_manager_state,
             collect_experience_state,
             skills_explorer_agent_state,
             preference_elicitation_agent_state,
             recommender_advisor_agent_state) = results

            # Backward compatibility: Create default recommender state if missing
            if recommender_advisor_agent_state is None:
                self._logger.info("Creating default RecommenderAdvisorAgentState for session ID %s (backward compatibility)", session_id)
                recommender_advisor_agent_state_obj = RecommenderAdvisorAgentState(session_id=session_id)
            else:
                recommender_advisor_agent_state_obj = RecommenderAdvisorAgentState.from_document(recommender_advisor_agent_state)

            state = ApplicationState(session_id=session_id,
                                     agent_director_state=AgentDirectorState.from_document(agent_director_state),
                                     welcome_agent_state=WelcomeAgentState.from_document(welcome_agent_state),
                                     explore_experiences_director_state=ExploreExperiencesAgentDirectorState.from_document(explore_experiences_director_state),
                                     conversation_memory_manager_state=ConversationMemoryManagerState.from_document(conversation_memory_manager_state),
                                     collect_experience_state=CollectExperiencesAgentState.from_document(collect_experience_state),
                                     skills_explorer_agent_state=SkillsExplorerAgentState.from_document(skills_explorer_agent_state),
                                     preference_elicitation_agent_state=PreferenceElicitationAgentState.from_document(preference_elicitation_agent_state),
                                     recommender_advisor_agent_state=recommender_advisor_agent_state_obj)

            # Upgrade the state if necessary
            state = await self._upgrade_state(state)

            return state

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
                        state.welcome_agent_state.session_id == session_id,
                        state.conversation_memory_manager_state.session_id == session_id,
                        state.collect_experience_state.session_id == session_id,
                        state.skills_explorer_agent_state.session_id == session_id,
                        state.preference_elicitation_agent_state.session_id == session_id,
                        state.recommender_advisor_agent_state.session_id == session_id]):
                raise ValueError("All states must have the same session_id")
            # Write the component states to the database
            # Using $eq to prevent NoSQL injection
            await asyncio.gather(
                self._agent_director_collection.update_one({"session_id": {"$eq": session_id}}, {"$set": state.agent_director_state.model_dump()}, upsert=True),
                self._welcome_agent_state.update_one({"session_id": {"$eq": session_id}}, {"$set": state.welcome_agent_state.model_dump()}, upsert=True),
                self._explore_experiences_director_state_collection.update_one({"session_id": {"$eq": session_id}},
                                                                               {"$set": state.explore_experiences_director_state.model_dump()}, upsert=True),
                self._conversation_memory_manager_state_collection.update_one({"session_id": {"$eq": session_id}},
                                                                              {"$set": state.conversation_memory_manager_state.model_dump()}, upsert=True),
                self._collect_experience_state_collection.update_one({"session_id": {"$eq": session_id}}, {"$set": state.collect_experience_state.model_dump()},
                                                                     upsert=True),
                self._skills_explorer_agent_state_collection.update_one({"session_id": {"$eq": session_id}},
                                                                        {"$set": state.skills_explorer_agent_state.model_dump()}, upsert=True),
                self._preference_elicitation_agent_state_collection.update_one({"session_id": {"$eq": session_id}},
                                                                               {"$set": state.preference_elicitation_agent_state.model_dump()}, upsert=True),
                self._recommender_advisor_agent_state_collection.update_one({"session_id": {"$eq": session_id}},
                                                                            {"$set": state.recommender_advisor_agent_state.model_dump()}, upsert=True)
            )

        except Exception as e:  # pylint: disable=broad-except
            # Log the error and raise an exception so that the caller can handle it
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
                self._welcome_agent_state.delete_one({"session_id": {"$eq": session_id}}),
                self._explore_experiences_director_state_collection.delete_one({"session_id": {"$eq": session_id}}),
                self._conversation_memory_manager_state_collection.delete_one({"session_id": {"$eq": session_id}}),
                self._collect_experience_state_collection.delete_one({"session_id": {"$eq": session_id}}),
                self._skills_explorer_agent_state_collection.delete_one({"session_id": {"$eq": session_id}}),
                self._preference_elicitation_agent_state_collection.delete_one({"session_id": {"$eq": session_id}}),
                self._recommender_advisor_agent_state_collection.delete_one({"session_id": {"$eq": session_id}})
            )

        except Exception as e:  # pylint: disable=broad-except
            # Log the error and raise an exception so that the caller can handle it
            self._logger.error("Failed to delete application state for session ID %s: %s", session_id, e, exc_info=True)
            raise

    async def get_all_session_ids(self) -> AsyncIterator[int]:
        """
        Stream all application states.
        Returns an async generator of ApplicationState objects.
        """
        try:
            # Create a cursor for streaming conversation memory manager documents
            cursor = self._conversation_memory_manager_state_collection.find(
                {}, {'_id': False, 'session_id': True}
            )

            async for doc in cursor:
                session_id = doc.get('session_id')
                if session_id is None:
                    self._logger.error("Session ID not found in document: %s", doc)
                    continue
                yield session_id

        except Exception as e:
            self._logger.error("Failed to stream application states: %s", e, exc_info=True)
            raise

    async def _upgrade_state(self, state: ApplicationState) -> ApplicationState:
        """
        Upgrade the state to the latest version if necessary.
        Saves it andy returns the upgraded state.

        This method should not raise an exception but log it and return the state as is.
        As we didn't upgrade the state, it will be returned as is.
        """

        try:
            _changes = False

            # The field `state.explore_experiences_director_state.explored_experiences` was added in a later version
            # if it is empty, and we have explored experiences, we populate it
            # with the experiences that have been processed
            if state.explore_experiences_director_state.explored_experiences is None:
                self._logger.info("upgrading state: populating explored_experiences field")
                state.explore_experiences_director_state.explored_experiences = filter_explored_experiences(state)
                _changes = True

            # Populate preference agent's initial_experiences_snapshot if empty
            # This ensures the preference agent can reference existing experiences
            if (state.preference_elicitation_agent_state.initial_experiences_snapshot is None and
                state.explore_experiences_director_state.explored_experiences):
                explored_count = len(state.explore_experiences_director_state.explored_experiences)
                explored_titles = [exp.experience_title for exp in state.explore_experiences_director_state.explored_experiences]
                self._logger.info(
                    f"upgrading state: populating preference agent initial_experiences_snapshot "
                    f"with {explored_count} experiences: {explored_titles}"
                )
                # Copy explored experiences to preference agent snapshot
                # Note: explored_experiences has tuple-format skills [(score, skill), ...]
                # but initial_experiences_snapshot needs plain ExperienceEntity with skills as dicts
                # Strip the tuple wrapping from top_skills during the copy
                from app.agent.experience.experience_entity import ExperienceEntity
                state.preference_elicitation_agent_state.initial_experiences_snapshot = [
                    ExperienceEntity(
                        **exp.model_dump(exclude={'top_skills', 'remaining_skills'}),
                        top_skills=[skill for _, skill in exp.top_skills] if exp.top_skills else [],
                        remaining_skills=[skill for _, skill in exp.remaining_skills] if exp.remaining_skills else []
                    )
                    for exp in state.explore_experiences_director_state.explored_experiences
                ]
                _changes = True
                self._logger.info(
                    "Successfully populated initial_experiences_snapshot with %d experiences",
                    explored_count
                )
            elif state.preference_elicitation_agent_state.initial_experiences_snapshot is None:
                self._logger.warning(
                    "Cannot populate initial_experiences_snapshot: explored_experiences is empty or None"
                )
            else:
                # Already populated, log for debugging
                snapshot_count = len(state.preference_elicitation_agent_state.initial_experiences_snapshot)
                snapshot_titles = [exp.experience_title for exp in state.preference_elicitation_agent_state.initial_experiences_snapshot]
                self._logger.debug(
                    f"initial_experiences_snapshot already populated with {snapshot_count} experiences: {snapshot_titles}"
                )

            # ========== Recommender Agent Data Transfer ==========
            # Copy preference data from preference agent to recommender agent if needed
            # This ensures seamless handoff from preference elicitation to recommendations
            # Only transfer when the preference agent has actually completed work
            # (not just default values). PreferenceVector() defaults exist on fresh states,
            # so we check n_vignettes_completed > 0 to avoid mutating state on every load.
            _pref_vec = state.preference_elicitation_agent_state.preference_vector
            _has_meaningful_preferences = (
                _pref_vec is not None
                and _pref_vec.n_vignettes_completed > 0
            )
            if (state.recommender_advisor_agent_state.preference_vector is None
                    and _has_meaningful_preferences):

                self._logger.info("Transferring preference data to recommender agent")

                # Transfer preference vector
                state.recommender_advisor_agent_state.preference_vector = state.preference_elicitation_agent_state.preference_vector

                # Transfer BWS data to recommender. HB is the source of truth for the ranking
                # sent to the matching service; counts are kept only as a fallback if HB failed.
                pref_state = state.preference_elicitation_agent_state
                if pref_state.hb_scores and pref_state.hb_ranking:
                    state.recommender_advisor_agent_state.bws_scores = {
                        wa_id: entry["mean"]
                        for wa_id, entry in pref_state.hb_scores.items()
                    }
                    state.recommender_advisor_agent_state.top_10_bws = list(pref_state.hb_ranking)
                else:
                    state.recommender_advisor_agent_state.bws_scores = pref_state.bws_scores
                    state.recommender_advisor_agent_state.top_10_bws = (
                        list(pref_state.top_10_bws) if pref_state.top_10_bws else None
                    )

                # Extract and transfer skills vector
                state.recommender_advisor_agent_state.skills_vector = self._extract_skills_from_experiences(
                    state.preference_elicitation_agent_state.initial_experiences_snapshot
                )

                # Set youth_id based on session_id
                state.recommender_advisor_agent_state.youth_id = f"youth_{state.session_id}"

                _changes = True
                self._logger.info("Successfully transferred preference data to recommender agent")

            # after the upgrade, we save the state
            if _changes:
                await self.save_state(state)

            # Currently, no upgrades are needed, but this method can be extended in the future
            return state
        except Exception as e:  # pylint: disable=broad-except
            self._logger.error("Failed to upgrade application state: %s", e, exc_info=True)
            return state

    def _extract_skills_from_experiences(self, experiences):
        """
        Extract skills vector from experiences snapshot.

        Args:
            experiences: List of ExperienceEntity objects or None

        Returns:
            Dictionary with skills vector data compatible with Node2Vec
        """
        if not experiences:
            return {"skills": [], "total_experiences": 0}

        try:
            # Use SkillsExtractor to aggregate skills
            from app.agent.recommender_advisor_agent.skills_extractor import SkillsExtractor
            extractor = SkillsExtractor()
            return extractor.extract_skills_vector(experiences)
        except Exception as e:  # pylint: disable=broad-except
            self._logger.error("Failed to extract skills from experiences: %s", e, exc_info=True)
            # Return empty skills vector on error
            return {"skills": [], "total_experiences": 0}
