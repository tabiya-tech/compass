import asyncio

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.career_path.repository import CareerPathRepository
from app.career_path.service import ICareerPathService, CareerPathService
from app.server_dependencies.db_dependencies import CompassDBProvider

_career_path_service_singleton: ICareerPathService | None = None
_career_path_service_lock = asyncio.Lock()


async def get_career_path_service(
        application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)
) -> ICareerPathService:
    global _career_path_service_singleton

    if _career_path_service_singleton is None:
        async with _career_path_service_lock:
            if _career_path_service_singleton is None:
                _career_path_service_singleton = CareerPathService(repository=CareerPathRepository(application_db))

    return _career_path_service_singleton
