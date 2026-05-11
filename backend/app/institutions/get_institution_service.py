import asyncio

from fastapi import Depends

from app.institutions.repository import InstitutionRepository
from app.institutions.service import IInstitutionService, InstitutionService
from app.server_dependencies.database_collections import Collections
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.user_institution_assignment.pilot_whitelist_repository import PilotWhitelistRepository

_institution_service_singleton: IInstitutionService | None = None
_institution_service_lock = asyncio.Lock()


async def get_institution_service(
        application_db=Depends(CompassDBProvider.get_application_db)
) -> IInstitutionService:
    global _institution_service_singleton

    if _institution_service_singleton is None:
        async with _institution_service_lock:
            if _institution_service_singleton is None:
                collection = application_db.get_collection(Collections.INSTITUTIONS)
                whitelist_collection = application_db.get_collection(Collections.PILOT_WHITELIST)
                _institution_service_singleton = InstitutionService(
                    repository=InstitutionRepository(collection),
                    whitelist_repository=PilotWhitelistRepository(whitelist_collection),
                )

    return _institution_service_singleton
