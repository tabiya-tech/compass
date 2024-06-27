import logging
from abc import ABC, abstractmethod
from pydantic import BaseModel
from app.agent.agent_director import AgentDirectorState
from app.agent.experiences_explorer_agent import ExperiencesAgentState
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState
from app.server_dependencies import get_mongo_db
from common_libs.environment_settings.constants import Collections


class ApplicationState(BaseModel):
    """
    The application state.
    This is an aggregation of the states of the different components of the application.
    """
    session_id: int
    agent_director_state: AgentDirectorState
    experiences_explorer_state: ExperiencesAgentState
    conversation_memory_manager_state: ConversationMemoryManagerState

    def __init__(self, session_id, agent_director_state=None,
            experiences_explorer_state=None,
            conversation_memory_manager_state=None):
        if agent_director_state is None:
            agent_director_state = AgentDirectorState(session_id)
        if experiences_explorer_state is None:
            experiences_explorer_state = ExperiencesAgentState(session_id)
        if conversation_memory_manager_state is None:
            conversation_memory_manager_state = ConversationMemoryManagerState(session_id)
        super().__init__(session_id=session_id,
                         agent_director_state=agent_director_state,
                         experiences_explorer_state=experiences_explorer_state,
                         conversation_memory_manager_state=conversation_memory_manager_state
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


class InMemoryApplicationStateStore(ApplicationStateStore):
    """
    An im-memory store for application state
    """

    def __init__(self):
        self._store: dict[int, ApplicationState] = {}
        self._logger = logging.getLogger(self.__class__.__name__)

    async def get_state(self, session_id: int) -> ApplicationState:
        """
        Get the application state for a session.
        """
        return self._store.get(session_id)

    async def save_state(self, session_id: int, state: ApplicationState):
        """
        Save the application state for a session
        """
        self._store[session_id] = state

    async def delete_state(self, session_id: int) -> None:
        """
        Delete the application state for a session
        """
        if session_id in self._store:
            del self._store[session_id]
        else:
            self._logger.info("Session ID %s not found.", session_id)


class DatabaseApplicationStateStore(ApplicationStateStore):
    """
    A MongoDB store for application state
    """

    def __init__(self):
        self._store = get_mongo_db().get_collection(Collections.APPLICATION_STATE)
        self._logger = logging.getLogger(self.__class__.__name__)


    async def create_collection(self, drop=True):
        """
        Creates the collection to store the application state. If it already exists and drop = True, it will be dropped
        and recreated.
        """
        db = get_mongo_db()
        collist = await db.list_collection_names()
        if Collections.APPLICATION_STATE in collist and drop:
            await db.drop_collection(Collections.APPLICATION_STATE)
        else:
            return
        await db.create_collection(Collections.APPLICATION_STATE)
        self._store = get_mongo_db().get_collection(Collections.APPLICATION_STATE)


    async def get_state(self, session_id: int) -> ApplicationState:
        """
        Get the application state for a session.
        """
        state = await self._store.find_one({"session_id": session_id})
        if state is None:
            return None
        state.pop("_id")
        return ApplicationState.model_validate(state)

    async def save_state(self, session_id: int, state: ApplicationState):
        """
        Save the application state for a session
        """
        store_entry = await self._store.find_one({"session_id": session_id})
        if store_entry is None:
            await self._store.insert_one(state.dict())
        else:
            await self._store.update_one({"session_id": session_id}, state.dict())

    async def delete_state(self, session_id: int) -> None:
        """
        Delete the application state for a session
        """
        await self._store.find_one_and_delete({"session_id": session_id})
