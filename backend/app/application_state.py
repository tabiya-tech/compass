import logging
from abc import ABC, abstractmethod
from pydantic import BaseModel
from typing import AsyncIterator

from app.agent.agent_director.abstract_agent_director import AgentDirectorState
from app.agent.collect_experiences_agent import CollectExperiencesAgentState
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.agent.welcome_agent import WelcomeAgentState
from app.agent.preference_elicitation_agent import PreferenceElicitationAgentState
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState
from app.countries import Country


class ApplicationState(BaseModel):
    """
    The application state.
    This is an aggregation of the states of the different components of the application.
    """
    session_id: int
    agent_director_state: AgentDirectorState
    welcome_agent_state: WelcomeAgentState
    explore_experiences_director_state: ExploreExperiencesAgentDirectorState
    conversation_memory_manager_state: ConversationMemoryManagerState
    collect_experience_state: CollectExperiencesAgentState
    skills_explorer_agent_state: SkillsExplorerAgentState
    preference_elicitation_agent_state: PreferenceElicitationAgentState

    def __init__(self, *,
                 session_id: int,
                 agent_director_state: AgentDirectorState,
                 welcome_agent_state: WelcomeAgentState,
                 explore_experiences_director_state: ExploreExperiencesAgentDirectorState,
                 conversation_memory_manager_state: ConversationMemoryManagerState,
                 collect_experience_state: CollectExperiencesAgentState,
                 skills_explorer_agent_state: SkillsExplorerAgentState,
                 preference_elicitation_agent_state: PreferenceElicitationAgentState):
        if session_id != agent_director_state.session_id:
            raise ValueError("Session ID mismatch in Agent Director State")
        if session_id != welcome_agent_state.session_id:
            raise ValueError("Session ID mismatch in Welcome Agent State")
        if session_id != explore_experiences_director_state.session_id:
            raise ValueError("Session ID mismatch in Explore Experiences Director State")
        if session_id != conversation_memory_manager_state.session_id:
            raise ValueError("Session ID mismatch in Conversation Memory Manager State")
        if session_id != collect_experience_state.session_id:
            raise ValueError("Session ID mismatch in Collect Experience State")
        if session_id != skills_explorer_agent_state.session_id:
            raise ValueError("Session ID mismatch in Skills Explorer Agent State")
        if session_id != preference_elicitation_agent_state.session_id:
            raise ValueError("Session ID mismatch in Preference Elicitation Agent State")

        super().__init__(session_id=session_id,
                         agent_director_state=agent_director_state,
                         welcome_agent_state=welcome_agent_state,
                         explore_experiences_director_state=explore_experiences_director_state,
                         conversation_memory_manager_state=conversation_memory_manager_state,
                         collect_experience_state=collect_experience_state,
                         skills_explorer_agent_state=skills_explorer_agent_state,
                         preference_elicitation_agent_state=preference_elicitation_agent_state
                         )

    @classmethod
    def new_state(cls, session_id: int, country_of_user: Country = None) -> "ApplicationState":
        """
        Create a new application state for the given session ID.
        All the states are initialized with the session ID and their default values.
        :param session_id:
        :param country_of_user: The country of the user
        """
        if country_of_user is None:
            country_of_user = Country.UNSPECIFIED
        return cls(
            session_id=session_id,
            agent_director_state=AgentDirectorState(session_id=session_id),
            welcome_agent_state=WelcomeAgentState(session_id=session_id),
            explore_experiences_director_state=ExploreExperiencesAgentDirectorState(session_id=session_id, country_of_user=country_of_user),
            conversation_memory_manager_state=ConversationMemoryManagerState(session_id=session_id),
            collect_experience_state=CollectExperiencesAgentState(session_id=session_id, country_of_user=country_of_user),
            skills_explorer_agent_state=SkillsExplorerAgentState(session_id=session_id, country_of_user=country_of_user),
            preference_elicitation_agent_state=PreferenceElicitationAgentState(session_id=session_id)
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
    async def save_state(self, state: ApplicationState):
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

    @abstractmethod
    async def get_all_session_ids(self) -> AsyncIterator[int]:
        """
        Get all session ID
        """
        raise NotImplementedError


class IApplicationStateManager(ABC):
    """
    Interface for the application state manager

    Helps in mocking the class in tests
    """

    @abstractmethod
    async def get_state(self, session_id: int) -> ApplicationState:
        """
        Get the application state for a session
        If the state does not exist, a new state is created and stored in
        the store prior to returning it.
        """
        raise NotImplementedError()

    @abstractmethod
    async def save_state(self, state: ApplicationState):
        """
        Save the application state for a session
        """
        raise NotImplementedError()

    @abstractmethod
    async def delete_state(self, session_id: int) -> None:
        """
        Delete the application state for a session
        """
        raise NotImplementedError()

    @abstractmethod
    async def get_all_session_ids(self) -> AsyncIterator[int]:
        """
        Get all application states
        """
        raise NotImplementedError()


class ApplicationStateManager(IApplicationStateManager):
    """
    The application state manager is responsible for managing the application state.
    it delegates the storage and retrieval of the state to an application state store.
    """

    def __init__(self, *,
                 store: ApplicationStateStore,
                 default_country_of_user: Country = Country.UNSPECIFIED):
        self._store = store
        self._default_country_of_user = default_country_of_user
        self.logger = logging.getLogger(self.__class__.__name__)

    async def get_state(self, session_id: int) -> ApplicationState:
        state = await self._store.get_state(session_id)
        if state is None:
            # When creating a new state, use the default country of the user
            # Eventually, we may want to use the country of the user from the user's profile, but for now, we just use the default.
            # The default country is typically deployment-specific
            state = ApplicationState.new_state(
                session_id=session_id,
                country_of_user=self._default_country_of_user
            )
            logging.info("Creating a new application state for session ID %s", session_id)
            await self._store.save_state(state)
        return state

    async def save_state(self, state: ApplicationState):
        return await self._store.save_state(state)

    async def delete_state(self, session_id: int) -> None:
        return await self._store.delete_state(session_id)

    async def get_all_session_ids(self) -> AsyncIterator[int]:
        raise NotImplementedError("Not implemented yet")
