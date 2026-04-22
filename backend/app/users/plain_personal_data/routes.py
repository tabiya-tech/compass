"""
This module contains functions to add plain personal data routes to the users router.
"""
import asyncio
import logging
from http import HTTPStatus
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.constants.errors import HTTPErrorResponse
from app.context_vars import user_id_ctx_var
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.auth import Authentication, UserInfo
from app.users.repositories import UserPreferenceRepository
from app.users.plain_personal_data.repository import PlainPersonalDataRepository
from app.users.plain_personal_data.types import CreateOrUpdatePlainPersonalDataRequest, PlainPersonalData
from app.users.plain_personal_data.service import PlainPersonalDataService, IPlainPersonalDataService
from app.users.plain_personal_data.errors import UserPreferencesNotFoundError

# Lock to ensure that the singleton instance is thread-safe
_plain_personal_data_service_lock = asyncio.Lock()
_plain_personal_data_service_singleton: Optional[IPlainPersonalDataService] = None


async def get_plain_personal_data_service(
    user_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_userdata_db),
    application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
) -> IPlainPersonalDataService:
    global _plain_personal_data_service_singleton
    if _plain_personal_data_service_singleton is None:
        async with _plain_personal_data_service_lock:
            if _plain_personal_data_service_singleton is None:
                _plain_personal_data_service_singleton = PlainPersonalDataService(
                    repository=PlainPersonalDataRepository(user_db),
                    user_preference_repository=UserPreferenceRepository(application_db),
                )
    return _plain_personal_data_service_singleton


def add_user_plain_personal_data_routes(users_router: APIRouter, auth: Authentication):
    """
    Adds the plain personal data routes to the users router.

    :param users_router: the users router
    :param auth: Authentication
    """
    logger = logging.getLogger(__name__)

    router = APIRouter(
        prefix="/{user_id}/plain-personal-data",
        tags=["user-plain-personal-data"],
    )

    @router.post(
        path="",
        status_code=200,
        response_model=None,
        description="Creates or updates the user's plain (unencrypted) personal data. Upsert semantics: existing keys are updated, new keys are added.",
        responses={
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
    )
    async def _handle_upsert_plain_personal_data(
        plain_personal_data_payload: CreateOrUpdatePlainPersonalDataRequest,
        user_id: str = Path(description="the unique identifier of the user", examples=["1"]),
        service: IPlainPersonalDataService = Depends(get_plain_personal_data_service),
        user_info: UserInfo = Depends(auth.get_user_info()),
    ):
        user_id_ctx_var.set(user_id)

        if user_info.user_id != user_id:
            warning_msg = f"User {user_info.user_id} is not allowed to handle plain personal data for another user {user_id}"
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=warning_msg)

        try:
            await service.upsert(user_id, plain_personal_data_payload.data)
        except UserPreferencesNotFoundError as e:
            warning_msg = str(e)
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail=warning_msg)
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    @router.get(
        path="",
        status_code=200,
        response_model=PlainPersonalData,
        description="Retrieves the user's plain (unencrypted) personal data.",
        responses={
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
    )
    async def _handle_get_plain_personal_data(
        user_id: str = Path(description="the unique identifier of the user", examples=["1"]),
        service: IPlainPersonalDataService = Depends(get_plain_personal_data_service),
        user_info: UserInfo = Depends(auth.get_user_info()),
    ):
        user_id_ctx_var.set(user_id)

        if user_info.user_id != user_id:
            warning_msg = f"User {user_info.user_id} is not allowed to retrieve plain personal data for another user {user_id}"
            logger.warning(warning_msg)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=warning_msg)

        try:
            result = await service.get(user_id)
            if result is None:
                raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail=f"Plain personal data not found for user {user_id}")
            return result
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    users_router.include_router(router)
