from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator, Field


class Role(str, Enum):
    """User role enumeration."""
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    INSTITUTION_STAFF = "institution_staff"


class UserRecord(BaseModel):
    """Represents a user record from Firebase Authentication with access role info."""
    uid: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    phone_number: Optional[str] = None
    photo_url: Optional[str] = None
    disabled: bool = False
    email_verified: bool = False
    role: Optional[str] = None
    institution_id: Optional[str] = None

    model_config = {"extra": "forbid"}


class ListUsersResponse(BaseModel):
    """Response model for paginated user listing."""
    users: list[UserRecord]
    next_page_token: Optional[str] = None

    model_config = {"extra": "forbid"}


class CreateUserRequest(BaseModel):
    """Request model for creating a new user."""
    email: EmailStr
    name: str = Field(description="User's full name", max_length=100)
    role: Role
    institution_id: Optional[str] = Field(default=None, description="Institution ID for institution_staff role",
                                          max_length=100)

    model_config = {"extra": "forbid"}

    @field_validator("institution_id")
    @classmethod
    def validate_institution_id(cls, v, info):
        """Validate institution_id presence matches the role."""
        role = info.data.get("role")
        if role == Role.INSTITUTION_STAFF and not v:
            raise ValueError("institution_id is required for institution_staff role")
        if role in (Role.ADMIN, Role.SUPER_ADMIN) and v:
            raise ValueError(f"institution_id must not be provided for {role.value} role")
        return v


class CreateUserResponse(BaseModel):
    """Response model for user creation."""
    uid: str
    email: str
    display_name: str
    role: str
    institution_id: Optional[str] = None

    model_config = {"extra": "forbid"}


class UpdateRoleRequest(BaseModel):
    """Request model for updating a user's role."""
    role: Role
    institution_id: Optional[str] = None

    model_config = {"extra": "forbid"}

    @field_validator("institution_id")
    @classmethod
    def validate_institution_id(cls, v, info):
        """Validate institution_id presence matches the role."""
        role = info.data.get("role")
        if role == Role.INSTITUTION_STAFF and not v:
            raise ValueError("institution_id is required for institution_staff role")
        if role in (Role.ADMIN, Role.SUPER_ADMIN) and v:
            raise ValueError(f"institution_id must not be provided for {role.value} role")
        return v


class UpdateRoleResponse(BaseModel):
    """Response model for role update."""
    uid: str
    role: str
    institution_id: Optional[str] = None

    model_config = {"extra": "forbid"}


class DeleteUserResponse(BaseModel):
    """Response model for user deletion."""
    uid: str
    deleted: bool = True

    model_config = {"extra": "forbid"}


class UpdateProfileRequest(BaseModel):
    """Request model for updating the current user's profile."""
    name: Optional[str] = Field(default=None, description="User's display name", max_length=100)
    email: Optional[EmailStr] = Field(default=None, description="User's email address")

    model_config = {"extra": "forbid"}


class UpdateProfileResponse(BaseModel):
    """Response model for profile update."""
    uid: str
    name: Optional[str] = None
    email: Optional[str] = None

    model_config = {"extra": "forbid"}
