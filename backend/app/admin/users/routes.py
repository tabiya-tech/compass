"""
Routes for admin user management operations.
Provides endpoints to list and manage users.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Query, HTTPException, status, Depends
from firebase_admin.auth import EmailAlreadyExistsError

from app.admin.users._types import (
    ListUsersResponse,
    CreateUserRequest,
    CreateUserResponse,
    UpdateRoleRequest,
    UpdateRoleResponse,
    DeleteUserResponse,
    UpdateProfileRequest,
    UpdateProfileResponse,
)
from app.admin.users.service import UsersService, get_users_service
from app.app_config import get_application_config
from app.users.access_role import get_access_role_dependency, get_super_admin_dependency
from app.users.auth import Authentication

logger = logging.getLogger(__name__)


def get_admin_users_routes(auth: Authentication) -> APIRouter:
    """
    Create and return the admin users router with all endpoints.

    :param auth: Authentication instance used to resolve the caller's role for write-action gating.
    :return: APIRouter with admin user management endpoints.
    """
    router = APIRouter()
    require_super_admin = get_super_admin_dependency(auth)
    require_authenticated_admin = get_access_role_dependency(auth)

    @router.get(
        "",
        response_model=ListUsersResponse,
        summary="List all users",
        description="List all users with cursor-based pagination using Firebase Admin SDK.",
    )
    async def get_users(
            max_results: int = Query(
                default=100,
                ge=1,
                le=1000,
                description="Maximum number of users to return per page (1-1000)",
            ),
            page_token: Optional[str] = Query(
                default=None,
                description="Token for cursor-based pagination from previous response",
            ),
            users_service: UsersService = Depends(get_users_service),
    ) -> ListUsersResponse:
        """
        List all users with cursor-based pagination.

        This endpoint retrieves users from Firebase Authentication for the specified tenant.
        Use the `next_page_token` from the response to fetch the next page of results.

        - **max_results**: Number of users per page (default: 100, max: 1000)
        - **page_token**: Optional pagination token from previous response
        """
        try:
            tenant_id = get_application_config().admin_firebase_tenant_id
            return await users_service.list_users(
                tenant_id=tenant_id,
                max_results=max_results,
                page_token=page_token,
            )
        except ValueError as e:
            logger.error("Invalid request parameters: %s", e)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            ) from e
        except Exception as e:
            logger.error("Failed to list users: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to list users",
            ) from e

    @router.post(
        "",
        response_model=CreateUserResponse,
        status_code=status.HTTP_201_CREATED,
        summary="Create a new user",
        description="Create a new user with Firebase Auth and assign an access role. Super admin only.",
        dependencies=[Depends(require_super_admin)],
    )
    async def create_user(
            request: CreateUserRequest,
            users_service: UsersService = Depends(get_users_service),
    ) -> CreateUserResponse:
        """
        Create a new user.

        This endpoint creates a user in Firebase Authentication with a random password
        and creates an access role document in Firestore.

        - **email**: User's email address
        - **name**: User's display name
        - **role**: User's role (admin or institution_staff)
        - **institution_id**: Required if a role is institution_staff
        """
        try:
            tenant_id = get_application_config().admin_firebase_tenant_id
            return await users_service.create_user(
                tenant_id=tenant_id,
                request=request,
            )
        except ValueError as e:
            logger.exception(e)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            ) from e
        except EmailAlreadyExistsError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User already exists by email",
            )
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user",
            ) from e

    @router.delete(
        "/{user_id}",
        response_model=DeleteUserResponse,
        summary="Delete a user",
        description="Delete a user from Firebase Auth and remove their access role. Super admin only.",
        dependencies=[Depends(require_super_admin)],
    )
    async def delete_user(
            user_id: str,
            users_service: UsersService = Depends(get_users_service),
    ) -> DeleteUserResponse:
        """
        Delete a user.

        This endpoint deletes a user from Firebase Authentication
        and removes their access role document from the Firestore.

        - **user_id**: The user ID to delete
        """
        try:
            tenant_id = get_application_config().admin_firebase_tenant_id
            return await users_service.delete_user(
                tenant_id=tenant_id,
                user_id=user_id,
            )
        except ValueError as e:
            logger.error("Invalid request parameters: %s", e)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            ) from e
        except Exception as e:
            logger.error("Failed to delete user: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete user",
            ) from e

    @router.patch(
        "/{user_id}/role",
        response_model=UpdateRoleResponse,
        summary="Update user role",
        description="Update a user's role in Firestore. Super admin only.",
        dependencies=[Depends(require_super_admin)],
    )
    async def update_user_role(
            user_id: str,
            request: UpdateRoleRequest,
            users_service: UsersService = Depends(get_users_service),
    ) -> UpdateRoleResponse:
        """
        Update a user's role.

        This endpoint updates the user's access role document in Firestore.

        - **user_id**: The user ID to update
        - **role**: New role (admin or institution_staff)
        - **institution_id**: Required if a role is institution_staff
        """
        try:
            return await users_service.update_role(
                user_id=user_id,
                request=request,
            )
        except ValueError as e:
            logger.error("Invalid request parameters: %s", e)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            ) from e
        except Exception as e:
            logger.error("Failed to update user role: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user role",
            ) from e

    @router.patch(
        "/{user_id}/profile",
        response_model=UpdateProfileResponse,
        summary="Update user profile",
        description="Update a user's display name and/or email in Firebase Authentication.",
        dependencies=[Depends(require_authenticated_admin)],
    )
    async def update_user_profile(
            user_id: str,
            request: UpdateProfileRequest,
            users_service: UsersService = Depends(get_users_service),
    ) -> UpdateProfileResponse:
        """
        Update a user's profile.

        This endpoint updates the user's display name and/or email in Firebase Authentication.

        - **user_id**: The user ID to update
        - **name**: Optional new display name
        - **email**: Optional new email address
        """
        try:
            tenant_id = get_application_config().admin_firebase_tenant_id
            return await users_service.update_profile(
                tenant_id=tenant_id,
                user_id=user_id,
                request=request,
            )
        except ValueError as e:
            logger.error("Invalid request parameters: %s", e)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            ) from e
        except Exception as e:
            logger.error("Failed to update user profile: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update user profile",
            ) from e

    return router
