"""
GET /users/me/institution-assignment

Returns the institution pre-assigned to the authenticated user (if any).
Used by the sensitive data form to lock the institution field for pilot users.
"""
import asyncio
import logging
from http import HTTPStatus
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.constants.errors import HTTPErrorResponse
from app.server_dependencies.database_collections import Collections
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.user_institution_assignment.repository import (
    IUserInstitutionAssignmentRepository,
    UserInstitutionAssignmentRepository,
)
from app.users.auth import Authentication, UserInfo

logger = logging.getLogger(__name__)

_lock = asyncio.Lock()
_repo_singleton: Optional[IUserInstitutionAssignmentRepository] = None


async def _get_assignment_repository(
    application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
) -> IUserInstitutionAssignmentRepository:
    global _repo_singleton
    if _repo_singleton is None:
        async with _lock:
            if _repo_singleton is None:
                _repo_singleton = UserInstitutionAssignmentRepository(
                    application_db.get_collection(Collections.USER_INSTITUTION_ASSIGNMENT)
                )
    return _repo_singleton


class InstitutionAssignmentResponse(BaseModel):
    institution_name: str
    reg_no: Optional[str] = None


def add_institution_assignment_route(users_router: APIRouter, auth: Authentication) -> None:
    """Add GET /users/me/institution-assignment to the users router."""

    router = APIRouter(prefix="/me", tags=["user-institution-assignment"])

    @router.get(
        path="/institution-assignment",
        response_model=Optional[InstitutionAssignmentResponse],
        status_code=HTTPStatus.OK,
        responses={
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description=(
            "Returns the institution pre-assigned to the authenticated user for a pilot programme. "
            "Returns null if the user has no pre-assignment (regular user). "
            "When an assignment exists, the frontend should lock the institution field to this value."
        ),
    )
    async def _get_institution_assignment(
        user_info: UserInfo = Depends(auth.get_user_info()),
        repo: IUserInstitutionAssignmentRepository = Depends(_get_assignment_repository),
    ) -> Optional[InstitutionAssignmentResponse]:
        try:
            assignment = await repo.find_by_user_id(user_info.user_id)
            if assignment is None:
                return None
            return InstitutionAssignmentResponse(
                institution_name=assignment.institution_name,
                reg_no=assignment.reg_no,
            )
        except Exception as exc:
            logger.exception("Error fetching institution assignment for user %s: %s", user_info.user_id, exc)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to fetch institution assignment",
            ) from exc

    users_router.include_router(router)
