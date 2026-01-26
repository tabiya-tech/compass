import asyncio

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.job_preferences.repository import JobPreferencesRepository
from app.job_preferences.service import IJobPreferencesService, JobPreferencesService
from app.server_dependencies.db_dependencies import CompassDBProvider

_job_preferences_service_singleton: IJobPreferencesService | None = None
_job_preferences_service_lock = asyncio.Lock()


async def get_job_preferences_service(
        application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)
) -> IJobPreferencesService:
    global _job_preferences_service_singleton

    if _job_preferences_service_singleton is None:
        async with _job_preferences_service_lock:
            if _job_preferences_service_singleton is None:
                _job_preferences_service_singleton = JobPreferencesService(repository=JobPreferencesRepository(application_db))

    return _job_preferences_service_singleton
