from abc import ABC, abstractmethod
from pydantic import BaseModel

from app.agent.agent_director.abstract_agent_director import AgentDirectorState
from app.agent.collect_experiences_agent import CollectExperiencesAgentState
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState
from app.countries import Country


class ApplicationState(BaseModel):
    """
    The application state.
    This is an aggregation of the states of the different components of the application.
    """
    session_id: int
    country_of_interest: Country = Country.UNSPECIFIED
    agent_director_state: AgentDirectorState
    explore_experiences_director_state: ExploreExperiencesAgentDirectorState
    conversation_memory_manager_state: ConversationMemoryManagerState
    collect_experience_state: CollectExperiencesAgentState
    skills_explorer_agent_state: SkillsExplorerAgentState

    def __init__(self, session_id):
        super().__init__(session_id=session_id,
                         agent_director_state=AgentDirectorState(session_id),
                         explore_experiences_director_state=ExploreExperiencesAgentDirectorState(session_id),
                         conversation_memory_manager_state=ConversationMemoryManagerState(session_id),
                         collect_experience_state=CollectExperiencesAgentState(session_id),
                         skills_explorer_agent_state=SkillsExplorerAgentState(session_id)
                         )


class ApplicationStateStore(ABC):
    """
    The interface for an application state store
    """

    @abstractmethod
    async def get_state(self, session_id: int) -> ApplicationState:
        """
        Get the application state for a session
        """
        raise NotImplementedError

    @abstractmethod
    async def save_state(self, session_id: int, state: ApplicationState):
        """
        Save the application state for a session
        """
        raise NotImplementedError

    @abstractmethod
    async def delete_state(self, session_id: int) -> None:
        """
        Delete the application state for a session
        """
        raise NotImplementedError


class ApplicationStateManager:
    """
    The application state manager is responsible for managing the application state.
    it delegates the storage and retrieval of the state to an application state store.
    """

    def __init__(self, store: ApplicationStateStore):
        self._store = store

    async def get_state(self, session_id: int) -> ApplicationState:
        """
        Get the application state for a session
        If the state does not exist, a new state is created and stored in
        the store prior to returning it.
        """
        state = await self._store.get_state(session_id)
        if state is None:
            state = ApplicationState(session_id)
            await self._store.save_state(session_id, state)
        return state

    async def save_state(self, session_id: int, state: ApplicationState):
        """
        Save the application state for a session
        """
        return await self._store.save_state(session_id, state)

    async def delete_state(self, session_id: int) -> None:
        """
        Delete the application state for a session
        """
        return await self._store.delete_state(session_id)
