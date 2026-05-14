import asyncio
from typing import Optional

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.server_dependencies.database_collections import Collections
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.user_institution_assignment.repository import (
    IUserInstitutionAssignmentRepository,
    UserInstitutionAssignmentRepository,
)

_lock = asyncio.Lock()
_singleton: Optional[IUserInstitutionAssignmentRepository] = None


async def get_assignment_repository(
    application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
) -> IUserInstitutionAssignmentRepository:
    global _singleton
    if _singleton is None:
        async with _lock:
            if _singleton is None:
                _singleton = UserInstitutionAssignmentRepository(
                    application_db.get_collection(Collections.USER_INSTITUTION_ASSIGNMENT)
                )
    return _singleton
