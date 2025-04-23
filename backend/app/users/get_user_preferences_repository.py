import asyncio

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.repositories import UserPreferenceRepository, IUserPreferenceRepository

######################
# UserPreferencesRepository
######################

_user_preferences_repository_singleton: IUserPreferenceRepository | None = None
_user_preferences_repository_lock = asyncio.Lock()


async def get_user_preferences_repository(
        application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)
) -> IUserPreferenceRepository:
    global _user_preferences_repository_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _user_preferences_repository_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _user_preferences_repository_lock:
            # double check after acquiring the lock
            if _user_preferences_repository_singleton is None:
                _user_preferences_repository_singleton = UserPreferenceRepository(application_db)

    return _user_preferences_repository_singleton

