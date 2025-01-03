"""
This module contains functions to add sensitive personal data routes to the users router.
"""
import asyncio
import logging
from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Path
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.constants.errors import HTTPErrorResponse
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication, UserInfo
from app.users.sensitive_personal_data.repository import SensitivePersonalDataRepository
from app.users.sensitive_personal_data.types import CreateSensitivePersonalDataRequest
from app.users.sensitive_personal_data.service import SensitivePersonalDataService, DuplicateSensitivePersonalDataError, ISensitivePersonalDataService

# Lock to ensure that the singleton instance is thread-safe
_sensitive_personal_data_service_lock = asyncio.Lock()
_sensitive_personal_data_service_singleton: ISensitivePersonalDataService | None = None


async def get_sensitive_personal_data_service(db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db)) -> ISensitivePersonalDataService:
    global _sensitive_personal_data_service_singleton
    if _sensitive_personal_data_service_singleton is None:  # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
        async with _sensitive_personal_data_service_lock:  # before modifying the singleton instance, acquire the lock
            if _sensitive_personal_data_service_singleton is None:  # double check after acquiring the lock
                _sensitive_personal_data_service_singleton = SensitivePersonalDataService(SensitivePersonalDataRepository(db))
    return _sensitive_personal_data_service_singleton


def add_user_sensitive_personal_data_routes(users_router: APIRouter, auth: Authentication):
    """
    Adds the sensitive personal data routes to the users router.

    :param users_router: the users router
    :param auth: Authentication
    """
    logger = logging.getLogger(__name__)

    router = APIRouter(
        prefix="/{user_id}/sensitive-personal-data",
        tags=["user-sensitive-personal-data"]
    )

    @router.post(
        path="",
        status_code=201,
        response_model=None,
        description="saves user's sensitive personal data",
        responses={
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},  # user is not allowed to create sensitive personal data for another user
            HTTPStatus.CONFLICT: {"model": HTTPErrorResponse},  # User already exists, has already created sensitive personal data
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},  # Internal server error, any server error
        },
    )
    async def _create_sensitive_personal_data(
            sensitive_personal_data: CreateSensitivePersonalDataRequest,
            user_id: str = Path(description="the unique identifier of the user", examples=["1"]),
            service: ISensitivePersonalDataService = Depends(get_sensitive_personal_data_service),
            user_info: UserInfo = Depends(auth.get_user_info())
    ):
        if user_info.user_id != user_id:
            warning_msg = f"User {user_info.user_id} is not allowed to create sensitive personal data for another user {user_id}"
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=warning_msg)

        try:
            await service.create(user_id, sensitive_personal_data)
        except DuplicateSensitivePersonalDataError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.CONFLICT, detail=warning_msg)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Opps! Something went wrong.")

    users_router.include_router(router)
