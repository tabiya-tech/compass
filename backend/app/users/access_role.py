import base64
import logging
from enum import Enum
from typing import Optional

from fastapi import Depends, HTTPException, status

from app.users.auth import UserInfo

logger = logging.getLogger(__name__)


class AccessRoleValue(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    INSTITUTION_STAFF = "institution_staff"


class AccessRole:
    def __init__(self, role: AccessRoleValue, institution_id: Optional[str] = None):
        self.role = role
        self.institution_id = institution_id

    @property
    def is_super_admin(self) -> bool:
        return self.role == AccessRoleValue.SUPER_ADMIN

    @property
    def is_admin(self) -> bool:
        return self.role == AccessRoleValue.ADMIN

    @property
    def is_institution_staff(self) -> bool:
        return self.role == AccessRoleValue.INSTITUTION_STAFF


def decode_institution_id(institution_id: str) -> str:
    """Decode a base64url-encoded institution ID to the institution name (padding-tolerant)."""
    pad = 4 - len(institution_id) % 4
    if pad != 4:
        institution_id = institution_id + "=" * pad
    return base64.urlsafe_b64decode(institution_id).decode("utf-8")


def get_access_role_dependency(auth: "Authentication"):
    """
    Factory that returns a FastAPI dependency for resolving the caller's AccessRole.
    Reads role and institutionId directly from JWT custom claims (via UserInfo).
    Usage: access_role: AccessRole = Depends(get_access_role_dependency(auth))
    """
    def _dependency(user_info: UserInfo = Depends(auth.get_user_info())) -> AccessRole:
        role_str = user_info.role
        if not role_str:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        try:
            role = AccessRoleValue(role_str)
        except ValueError:
            logger.warning("Unknown role '%s' for user_id=%s", role_str, user_info.user_id)
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        institution_id = user_info.institution_id if role == AccessRoleValue.INSTITUTION_STAFF else None
        return AccessRole(role=role, institution_id=institution_id)

    return _dependency


def get_super_admin_dependency(auth: "Authentication"):
    """
    Factory returning a FastAPI dependency that 403s unless the caller is super_admin.
    Returns the resolved AccessRole on success.
    """
    base_dependency = get_access_role_dependency(auth)

    def _dependency(access_role: AccessRole = Depends(base_dependency)) -> AccessRole:
        if not access_role.is_super_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return access_role

    return _dependency
