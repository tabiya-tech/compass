from typing import Optional

from app.admin.registrations.repository import AdminRegistrationRepository
from app.admin.registrations.types import (
    AdminRegistration,
    CreateRegistrationRequest,
    RegistrationRoleRequest,
    RegistrationStatus,
    RegistrationStatusResponse,
)
from app.admin.users._types import CreateUserRequest, Role
from app.admin.users.service import UsersService
from app.app_config import get_application_config
from common_libs.time_utilities import get_now


class AdminRegistrationsService:
    """Coordinates the public signup → super_admin approval workflow."""

    def __init__(self, repository: AdminRegistrationRepository, users_service: UsersService):
        self._repository = repository
        self._users_service = users_service

    async def submit(self, request: CreateRegistrationRequest) -> AdminRegistration:
        return await self._repository.create_or_replace_pending(request)

    async def approve(self, registration_id: str, super_admin_uid: str) -> AdminRegistration:
        registration = await self._repository.get_by_id(registration_id)
        if not registration:
            raise ValueError("Registration not found")
        if registration.status != RegistrationStatus.PENDING:
            raise ValueError(f"Registration is not pending (status={registration.status.value})")

        tenant_id = get_application_config().admin_firebase_tenant_id
        role = (
            Role.INSTITUTION_STAFF
            if registration.requested_role == RegistrationRoleRequest.INSTITUTION_STAFF
            else Role.ADMIN
        )
        create_request = CreateUserRequest(
            email=registration.email,
            name=registration.name,
            role=role,
            institution_id=registration.institution_id,
        )

        # Surface Firebase failures (e.g., EmailAlreadyExistsError) without marking as decided.
        await self._users_service.create_user(tenant_id=tenant_id, request=create_request)

        decided = await self._repository.mark_decided(
            registration_id,
            status=RegistrationStatus.APPROVED,
            decided_by=super_admin_uid,
            decided_at=get_now(),
        )
        if not decided:
            raise ValueError("Failed to mark registration as approved")
        return decided

    async def reject(
        self, registration_id: str, super_admin_uid: str, reason: str
    ) -> AdminRegistration:
        registration = await self._repository.get_by_id(registration_id)
        if not registration:
            raise ValueError("Registration not found")
        if registration.status != RegistrationStatus.PENDING:
            raise ValueError(f"Registration is not pending (status={registration.status.value})")

        decided = await self._repository.mark_decided(
            registration_id,
            status=RegistrationStatus.REJECTED,
            decided_by=super_admin_uid,
            decided_at=get_now(),
            rejection_reason=reason,
        )
        if not decided:
            raise ValueError("Failed to mark registration as rejected")
        return decided

    async def get_status(self, email: str) -> RegistrationStatusResponse:
        registration = await self._repository.get_by_email(email)
        return RegistrationStatusResponse(
            email=email,
            status=registration.status if registration else None,
        )

    async def list(
        self, status_filter: Optional[RegistrationStatus] = None
    ) -> tuple[list[AdminRegistration], int]:
        registrations = await self._repository.list_by_status(status_filter)
        pending_count = await self._repository.count_pending()
        return registrations, pending_count

    async def pending_count(self) -> int:
        return await self._repository.count_pending()
