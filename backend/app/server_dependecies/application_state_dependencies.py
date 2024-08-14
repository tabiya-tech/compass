from threading import Lock
from app.application_state import ApplicationStateManager
from app.store.database_application_state_store import DatabaseApplicationStateStore

# Lock to ensure that the singleton instance is thread-safe
_application_state_manager_lock = Lock()
_application_state_manager_singleton: ApplicationStateManager | None = None


def get_application_state_manager() -> ApplicationStateManager:
    global _application_state_manager_singleton
    if _application_state_manager_singleton is None:  # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
        with _application_state_manager_lock:  # before modifying the singleton instance, acquire the lock
            if _application_state_manager_singleton is None:  # double check after acquiring the lock
                _application_state_manager_singleton = ApplicationStateManager(DatabaseApplicationStateStore())
    return _application_state_manager_singleton
