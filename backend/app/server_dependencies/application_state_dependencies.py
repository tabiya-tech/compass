import asyncio

from fastapi.params import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.application_state import ApplicationStateManager
from .db_dependencies import CompassDBProvider
from app.store.database_application_state_store import DatabaseApplicationStateStore

# Lock to ensure that the singleton instance is thread-safe
_application_state_manager_lock = asyncio.Lock()
_application_state_manager_singleton: ApplicationStateManager | None = None


async def get_application_state_manager(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)) -> ApplicationStateManager:
    global _application_state_manager_singleton
    if _application_state_manager_singleton is None:  # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
        async with _application_state_manager_lock:  # before modifying the singleton instance, acquire the lock
            if _application_state_manager_singleton is None:  # double check after acquiring the lock
                _application_state_manager_singleton = ApplicationStateManager(DatabaseApplicationStateStore(db))
    return _application_state_manager_singleton
