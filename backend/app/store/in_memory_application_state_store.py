import logging

from app.application_state import ApplicationStateStore, ApplicationState


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

