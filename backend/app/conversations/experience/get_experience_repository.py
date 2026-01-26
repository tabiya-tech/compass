import asyncio

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.conversations.experience.repository import IExperiencesRepository, ExperiencesRepository
from app.server_dependencies.db_dependencies import CompassDBProvider

_experience_repository_singleton: IExperiencesRepository | None = None
_experience_repository_lock = asyncio.Lock()


async def get_experience_repository(
        application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)) -> IExperiencesRepository:
    global _experience_repository_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _experience_repository_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _experience_repository_lock:
            # double check after acquiring the lock
            if _experience_repository_singleton is None:
                _experience_repository_singleton = ExperiencesRepository(
                    application_db
                )

    return _experience_repository_singleton
