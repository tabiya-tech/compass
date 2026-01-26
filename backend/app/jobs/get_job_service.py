import asyncio

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.jobs.repository import JobRepository
from app.jobs.service import IJobService, JobService
from app.server_dependencies.db_dependencies import CompassDBProvider

_job_service_singleton: IJobService | None = None
_job_service_lock = asyncio.Lock()


async def get_job_service(
        application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)
) -> IJobService:
    global _job_service_singleton

    if _job_service_singleton is None:
        async with _job_service_lock:
            if _job_service_singleton is None:
                _job_service_singleton = JobService(repository=JobRepository(application_db))

    return _job_service_singleton
