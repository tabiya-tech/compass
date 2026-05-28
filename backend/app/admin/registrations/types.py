from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


class RegistrationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class RegistrationRoleRequest(str, Enum):
    """Roles that can be requested via the public signup endpoint. super_admin is excluded."""
    ADMIN = "admin"
    INSTITUTION_STAFF = "institution_staff"


class AdminRegistration(BaseModel):
    """A user-submitted request to be added as an admin or instructor."""
    id: Optional[str] = None
    email: EmailStr
    name: str = Field(max_length=100)
    requested_role: RegistrationRoleRequest
    institution_id: Optional[str] = Field(default=None, max_length=100)
    status: RegistrationStatus
    submitted_at: datetime
    decided_at: Optional[datetime] = None
    decided_by: Optional[str] = None
    rejection_reason: Optional[str] = None

    model_config = {"extra": "forbid"}


class CreateRegistrationRequest(BaseModel):
    email: EmailStr
    name: str = Field(max_length=100)
    requested_role: RegistrationRoleRequest
    institution_id: Optional[str] = Field(default=None, max_length=100)

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def _validate_institution_id_matches_role(self) -> "CreateRegistrationRequest":
        if self.requested_role == RegistrationRoleRequest.INSTITUTION_STAFF and not self.institution_id:
            raise ValueError("institution_id is required for institution_staff role")
        if self.requested_role == RegistrationRoleRequest.ADMIN and self.institution_id:
            raise ValueError("institution_id must not be provided for admin role")
        return self


class CreateRegistrationResponse(BaseModel):
    id: str
    status: RegistrationStatus

    model_config = {"extra": "forbid"}


class RegistrationStatusResponse(BaseModel):
    """Public status lookup response. Status is None when no record exists (no enumeration)."""
    email: EmailStr
    status: Optional[RegistrationStatus] = None

    model_config = {"extra": "forbid"}


class ListRegistrationsResponse(BaseModel):
    registrations: list[AdminRegistration]
    pending_count: int

    model_config = {"extra": "forbid"}


class RejectRegistrationRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)

    model_config = {"extra": "forbid"}


class ApproveRegistrationResponse(BaseModel):
    """Response for approving a registration — includes the registration record and the new user's UID."""
    registration: AdminRegistration
    uid: str

    model_config = {"extra": "forbid"}


class DuplicateActiveRegistrationError(Exception):
    """Raised when an active (pending or approved) registration already exists for the email."""
