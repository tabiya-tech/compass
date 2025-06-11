"""
This module contains functions to add sensitive personal data routes to the users router.
"""
import asyncio
import logging
from datetime import datetime, timezone
from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Path
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.constants.errors import HTTPErrorResponse
from app.context_vars import user_id_ctx_var
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication, UserInfo
from app.users.repositories import UserPreferenceRepository
from app.users.sensitive_personal_data.repository import SensitivePersonalDataRepository
from app.users.sensitive_personal_data.types import CreateSensitivePersonalDataRequest, SensitivePersonalData
from app.users.sensitive_personal_data.service import SensitivePersonalDataService, ISensitivePersonalDataService
from app.users.sensitive_personal_data.errors import (
    DuplicateSensitivePersonalDataError,
    UserPreferencesNotFoundError,
    SensitivePersonalDataRequiredError,
    SensitivePersonalDataNotAvailableError
)

# Lock to ensure that the singleton instance is thread-safe
_sensitive_personal_data_service_lock = asyncio.Lock()
_sensitive_personal_data_service_singleton: ISensitivePersonalDataService | None = None


async def get_sensitive_personal_data_service(user_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db), application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db)) -> ISensitivePersonalDataService:
    global _sensitive_personal_data_service_singleton
    if _sensitive_personal_data_service_singleton is None:  # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
        async with _sensitive_personal_data_service_lock:  # before modifying the singleton instance, acquire the lock
            if _sensitive_personal_data_service_singleton is None:  # double check after acquiring the lock
                _sensitive_personal_data_service_singleton = SensitivePersonalDataService(
                    repository=SensitivePersonalDataRepository(user_db),
                    user_preference_repository=UserPreferenceRepository(application_db)
                )
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
        description="saves or skips user's sensitive personal data. If sensitive_personal_data is None or empty, it is treated as a skip request",
        responses={
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},  # user is not allowed to create/skip sensitive personal data for another user
            HTTPStatus.CONFLICT: {"model": HTTPErrorResponse},  # User already exists, has already created/skipped sensitive personal data
            HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},  # When sensitive personal data is not available or required but trying to skip
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},  # When user preferences are not found
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},  # Internal server error, any server error
        },
    )
    async def _handle_sensitive_personal_data(
            sensitive_personal_data_payload: CreateSensitivePersonalDataRequest,
            user_id: str = Path(description="the unique identifier of the user", examples=["1"]),
            service: ISensitivePersonalDataService = Depends(get_sensitive_personal_data_service),
            user_info: UserInfo = Depends(auth.get_user_info())
    ):
        # set the user id context variable.
        user_id_ctx_var.set(user_id)

        if user_info.user_id != user_id:
            warning_msg = f"User {user_info.user_id} is not allowed to handle sensitive personal data for another user {user_id}"
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=warning_msg)

        try:
            if sensitive_personal_data_payload.sensitive_personal_data is None:
                await service.skip(user_id)
            else:
                # Create sensitive personal data
                sensitive_personal_data = SensitivePersonalData(
                    user_id=user_id,
                    created_at=datetime.now(timezone.utc),
                    sensitive_personal_data=sensitive_personal_data_payload.sensitive_personal_data
                )
                await service.create(sensitive_personal_data)
        except DuplicateSensitivePersonalDataError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.CONFLICT, detail=warning_msg)
        except UserPreferencesNotFoundError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail=warning_msg)
        except (SensitivePersonalDataRequiredError, SensitivePersonalDataNotAvailableError) as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=warning_msg)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Opps! Something went wrong.")

    users_router.include_router(router)
