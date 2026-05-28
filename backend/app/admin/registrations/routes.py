import logging
from http import HTTPStatus
from typing import Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query
from firebase_admin.auth import EmailAlreadyExistsError
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.admin.registrations.rate_limit import (
    registration_rate_limiter,
    status_rate_limiter,
)
from app.admin.registrations.repository import AdminRegistrationRepository
from app.admin.registrations.service import AdminRegistrationsService
from app.admin.registrations.types import (
    AdminRegistration,
    ApproveRegistrationResponse,
    CreateRegistrationRequest,
    CreateRegistrationResponse,
    DuplicateActiveRegistrationError,
    ListRegistrationsResponse,
    RegistrationStatus,
    RegistrationStatusResponse,
    RejectRegistrationRequest,
)
from app.admin.users.service import UsersService, get_users_service
from app.constants.errors import HTTPErrorResponse
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.access_role import AccessRole, get_super_admin_dependency
from app.users.auth import Authentication

logger = logging.getLogger(__name__)


async def _get_registrations_service(
    db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
    users_service: UsersService = Depends(get_users_service),
) -> AdminRegistrationsService:
    repository = AdminRegistrationRepository(db)
    return AdminRegistrationsService(repository, users_service)


def add_admin_registrations_routes(app: FastAPI, auth: Authentication) -> None:
    """Register the public + super-admin registration routes on the FastAPI app."""
    require_super_admin = get_super_admin_dependency(auth)

    router = APIRouter(prefix="/admin-registrations", tags=["admin-registrations"])

    @router.post(
        "",
        response_model=CreateRegistrationResponse,
        status_code=HTTPStatus.CREATED,
        responses={
            409: {"model": HTTPErrorResponse},
            429: {"model": HTTPErrorResponse},
            500: {"model": HTTPErrorResponse},
        },
        name="submit admin registration",
        dependencies=[Depends(registration_rate_limiter)],
    )
    async def _submit(
        request: CreateRegistrationRequest,
        service: AdminRegistrationsService = Depends(_get_registrations_service),
    ) -> CreateRegistrationResponse:
        try:
            registration = await service.submit(request)
        except DuplicateActiveRegistrationError as e:
            # Generic detail prevents account enumeration via the public endpoint.
            raise HTTPException(
                status_code=HTTPStatus.CONFLICT,
                detail="An active registration already exists for this email.",
            ) from e
        except Exception as e:  # pylint: disable=broad-except
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to submit registration",
            ) from e
        return CreateRegistrationResponse(id=registration.id, status=registration.status)

    @router.get(
        "/status",
        response_model=RegistrationStatusResponse,
        responses={429: {"model": HTTPErrorResponse}, 500: {"model": HTTPErrorResponse}},
        name="get registration status",
        dependencies=[Depends(status_rate_limiter)],
    )
    async def _get_status(
        email: str = Query(..., min_length=3, max_length=320),
        service: AdminRegistrationsService = Depends(_get_registrations_service),
    ) -> RegistrationStatusResponse:
        try:
            return await service.get_status(email)
        except Exception as e:  # pylint: disable=broad-except
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to look up registration status",
            ) from e

    @router.get(
        "",
        response_model=ListRegistrationsResponse,
        responses={403: {"model": HTTPErrorResponse}, 500: {"model": HTTPErrorResponse}},
        name="list admin registrations",
    )
    async def _list(
        status_filter: Optional[RegistrationStatus] = Query(default=None, alias="status"),
        _access_role: AccessRole = Depends(require_super_admin),
        service: AdminRegistrationsService = Depends(_get_registrations_service),
    ) -> ListRegistrationsResponse:
        try:
            registrations, pending_count = await service.list(status_filter)
            return ListRegistrationsResponse(
                registrations=registrations, pending_count=pending_count
            )
        except Exception as e:  # pylint: disable=broad-except
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to list registrations",
            ) from e

    @router.post(
        "/{registration_id}/approve",
        response_model=ApproveRegistrationResponse,
        responses={
            400: {"model": HTTPErrorResponse},
            403: {"model": HTTPErrorResponse},
            404: {"model": HTTPErrorResponse},
            409: {"model": HTTPErrorResponse},
            500: {"model": HTTPErrorResponse},
        },
        name="approve admin registration",
    )
    async def _approve(
        registration_id: str,
        access_role: AccessRole = Depends(require_super_admin),
        user_info=Depends(auth.get_user_info()),
        service: AdminRegistrationsService = Depends(_get_registrations_service),
    ) -> ApproveRegistrationResponse:
        try:
            return await service.approve(registration_id, super_admin_uid=user_info.user_id)
        except EmailAlreadyExistsError as e:
            raise HTTPException(
                status_code=HTTPStatus.CONFLICT,
                detail="A Firebase user with this email already exists.",
            ) from e
        except ValueError as e:
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=str(e)) from e
        except Exception as e:  # pylint: disable=broad-except
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to approve registration",
            ) from e

    @router.post(
        "/{registration_id}/reject",
        response_model=AdminRegistration,
        responses={
            400: {"model": HTTPErrorResponse},
            403: {"model": HTTPErrorResponse},
            404: {"model": HTTPErrorResponse},
            500: {"model": HTTPErrorResponse},
        },
        name="reject admin registration",
    )
    async def _reject(
        registration_id: str,
        request: RejectRegistrationRequest,
        access_role: AccessRole = Depends(require_super_admin),
        user_info=Depends(auth.get_user_info()),
        service: AdminRegistrationsService = Depends(_get_registrations_service),
    ) -> AdminRegistration:
        try:
            return await service.reject(
                registration_id, super_admin_uid=user_info.user_id, reason=request.reason
            )
        except ValueError as e:
            raise HTTPException(status_code=HTTPStatus.BAD_REQUEST, detail=str(e)) from e
        except Exception as e:  # pylint: disable=broad-except
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to reject registration",
            ) from e

    app.include_router(router)
