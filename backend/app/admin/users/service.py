import logging
from functools import cache
from typing import Optional

from fastapi import Depends
from firebase_admin import auth

from app.admin.firebase import FirebaseService, get_firebase_service
from app.admin.users._types import (
    UserRecord,
    ListUsersResponse,
    CreateUserRequest,
    CreateUserResponse,
    UpdateRoleRequest,
    UpdateRoleResponse,
    DeleteUserResponse,
)

logger = logging.getLogger(__name__)


def _convert_firebase_user_to_record(
        firebase_user: auth.UserRecord,
        access_role: Optional[dict] = None,
) -> UserRecord:
    role = None
    institution_id = None

    if access_role:
        role = access_role.get("role")
        institution_id = access_role.get("institutionId")

    return UserRecord(
        uid=firebase_user.uid,
        email=firebase_user.email,
        display_name=firebase_user.display_name,
        phone_number=firebase_user.phone_number,
        photo_url=firebase_user.photo_url,
        disabled=firebase_user.disabled,
        email_verified=firebase_user.email_verified,
        role=role,
        institution_id=institution_id,
    )


class UsersService:
    """Service for admin user management operations."""

    def __init__(self, firebase_service: FirebaseService):
        self._firebase = firebase_service

    async def list_users(
            self,
            tenant_id: str,
            max_results: int = 100,
            page_token: Optional[str] = None,
    ) -> ListUsersResponse:
        """
        List users with cursor-based pagination.

        :param tenant_id: The Firebase tenant ID.
        :param max_results: Maximum number of users to return per page.
        :param page_token: Optional token for cursor-based pagination.
        :return: ListUsersResponse containing users and optional next page token.
        """
        logger.info("Listing users for tenant: %s, max_results: %d", tenant_id, max_results)

        # Fetch users from Firebase Auth
        firebase_users, next_page_token = self._firebase.list_users(
            tenant_id=tenant_id,
            max_results=max_results,
            page_token=page_token,
        )

        # Get all user IDs for batch fetching access roles
        user_ids = [user.uid for user in firebase_users]

        # Fetch access roles for all users in a single Firestore request
        access_roles = await self._firebase.fetch_access_roles_batch(user_ids)

        # Convert Firebase users to our model, enriching with access role data
        users = [
            _convert_firebase_user_to_record(user, access_roles.get(user.uid))
            for user in firebase_users
        ]

        logger.info("Retrieved %d users for tenant: %s", len(users), tenant_id)

        return ListUsersResponse(
            users=users,
            next_page_token=next_page_token,
        )

    async def create_user(
            self,
            tenant_id: str,
            request: CreateUserRequest,
    ) -> CreateUserResponse:
        """
        Create a new user with a Firebase Auth and Firestore access role.

        :param tenant_id: The Firebase tenant ID.
        :param request: CreateUserRequest containing user details.
        :return: CreateUserResponse with the created user details.
        """
        logger.info("Creating user for tenant: %s, email: %s", tenant_id, request.email)

        # Step 1: Create a user in Firebase Auth
        firebase_user = self._firebase.create_user(
            tenant_id=tenant_id,
            email=request.email,
            display_name=request.name,
        )

        # Step 2: Create an access role document in Firestore
        await self._firebase.create_access_role(
            user_id=firebase_user.uid,
            role=request.role.value,
            institution_id=request.institution_id,
        )

        logger.info("Created user with UID: %s for tenant: %s", firebase_user.uid, tenant_id)

        return CreateUserResponse(
            uid=firebase_user.uid,
            email=firebase_user.email,
            display_name=firebase_user.display_name,
            role=request.role.value,
            institution_id=request.institution_id,
        )

    async def delete_user(
            self,
            tenant_id: str,
            user_id: str,
    ) -> DeleteUserResponse:
        """
        Delete a user from Firebase Auth and Firestore.

        :param tenant_id: The Firebase tenant ID.
        :param user_id: The user ID to delete.
        :return: DeleteUserResponse confirming deletion.
        """
        logger.info("Deleting user: %s for tenant: %s", user_id, tenant_id)

        # Step 1: Delete user from Firebase Auth
        self._firebase.delete_user(tenant_id=tenant_id, user_id=user_id)

        # Step 2: Delete access role document from Firestore
        await self._firebase.delete_access_role(user_id=user_id)

        logger.info("Deleted user with UID: %s for tenant: %s", user_id, tenant_id)

        return DeleteUserResponse(uid=user_id, deleted=True)

    async def update_role(
            self,
            user_id: str,
            request: UpdateRoleRequest,
    ) -> UpdateRoleResponse:
        """
        Update a user's role in Firestore.

        :param user_id: The user ID to update.
        :param request: UpdateRoleRequest containing the new role.
        :return: UpdateRoleResponse with the updated role details.
        """
        logger.info("Updating role for user: %s to: %s", user_id, request.role.value)

        # Update access role document in Firestore
        await self._firebase.update_access_role(
            user_id=user_id,
            role=request.role.value,
            institution_id=request.institution_id,
        )

        logger.info("Updated role for user: %s to: %s", user_id, request.role.value)

        return UpdateRoleResponse(
            uid=user_id,
            role=request.role.value,
            institution_id=request.institution_id,
        )


@cache
def get_users_service(
        firebase_service: FirebaseService = Depends(get_firebase_service),
) -> UsersService:
    """
    Get a cached instance of the users service.

    :param firebase_service: Firebase service (injected by FastAPI).
    :return: UsersService instance.
    """
    return UsersService(firebase_service)
