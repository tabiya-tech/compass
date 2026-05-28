import logging
from typing import Optional

from fastapi import Depends
from firebase_admin import auth
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.admin.firebase import FirebaseService, get_firebase_service
from app.admin.registrations.repository import AdminRegistrationRepository
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.admin.users._types import (
    UserRecord,
    ListUsersResponse,
    CreateUserRequest,
    CreateUserResponse,
    UpdateRoleRequest,
    UpdateRoleResponse,
    DeleteUserResponse,
    UpdateProfileRequest,
    UpdateProfileResponse,
    PasswordResetLinkResponse,
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

    def __init__(
        self,
        firebase_service: FirebaseService,
        registrations_repo: AdminRegistrationRepository,
    ):
        self._firebase = firebase_service
        self._registrations_repo = registrations_repo

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

        # Step 3: Mirror the role into Firebase custom claims. The admin frontend
        # reads role from token claims (not the Firestore doc), so without this
        # the user's first sign-in fails with USER_ACCESS_DISABLED.
        self._firebase.set_custom_claims(
            tenant_id=tenant_id,
            user_id=firebase_user.uid,
            role=request.role.value,
            institution_id=request.institution_id,
        )

        # Email delivery is handled client-side via Firebase's hosted
        # sendPasswordResetEmail template. The backend deliberately does not
        # generate or log a reset link here — logged links are recoverable
        # credentials.
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

        # Look up the email *before* deleting the Firebase user, so we can
        # cascade-delete the corresponding admin_registrations row by email.
        firebase_user = self._firebase.get_user(tenant_id=tenant_id, user_id=user_id)
        email = firebase_user.email if firebase_user else None

        # Step 1: Delete user from Firebase Auth
        self._firebase.delete_user(tenant_id=tenant_id, user_id=user_id)

        # Step 2: Delete access role document from Firestore
        await self._firebase.delete_access_role(user_id=user_id)

        # Step 3: Cascade-delete the registration row so a fresh signup with the
        # same email isn't blocked by an orphaned approved/rejected row.
        if email:
            deleted = await self._registrations_repo.delete_by_email(email)
            if deleted:
                logger.info("Cascade-deleted %d registration row(s) for email: %s", deleted, email)

        logger.info("Deleted user with UID: %s for tenant: %s", user_id, tenant_id)

        return DeleteUserResponse(uid=user_id, deleted=True)

    async def update_role(
            self,
            tenant_id: str,
            user_id: str,
            request: UpdateRoleRequest,
    ) -> UpdateRoleResponse:
        """
        Update a user's role in Firestore.

        :param tenant_id: The Firebase tenant ID (needed to update custom claims).
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

        # Mirror the role change in Firebase custom claims, otherwise the frontend
        # (which reads role from the ID token) would still see the old role.
        self._firebase.set_custom_claims(
            tenant_id=tenant_id,
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


    async def update_profile(
            self,
            tenant_id: str,
            user_id: str,
            request: UpdateProfileRequest,
    ) -> UpdateProfileResponse:
        """
        Update a user's display name and/or email in Firebase Authentication.

        :param tenant_id: The Firebase tenant ID.
        :param user_id: The user ID to update.
        :param request: UpdateProfileRequest containing the fields to update.
        :return: UpdateProfileResponse with the updated user details.
        """
        logger.info("Updating profile for user: %s", user_id)

        firebase_user = self._firebase.update_user(
            tenant_id=tenant_id,
            user_id=user_id,
            display_name=request.name,
            email=str(request.email) if request.email else None,
        )

        logger.info("Updated profile for user: %s", user_id)

        return UpdateProfileResponse(
            uid=firebase_user.uid,
            name=firebase_user.display_name,
            email=firebase_user.email,
        )


    async def get_password_reset_link(
            self,
            tenant_id: str,
            user_id: str,
            continue_url: Optional[str] = None,
    ) -> PasswordResetLinkResponse:
        """
        Generate a password reset link for the given user.

        :param tenant_id: The Firebase tenant ID.
        :param user_id: The user ID whose reset link to generate.
        :param continue_url: The admin frontend URL to embed so the link lands on the
            correct auth-handler page (tenant-aware). Should be the admin frontend's
            auth-handler URL (e.g. https://admin.njila.ai/#/auth-handler).
        :return: PasswordResetLinkResponse containing the reset link.
        """
        logger.info("Generating password reset link for user: %s, tenant: %s", user_id, tenant_id)
        firebase_user = self._firebase.get_user(tenant_id=tenant_id, user_id=user_id)
        if not firebase_user or not firebase_user.email:
            raise ValueError(f"User {user_id} not found or has no email")
        link = self._firebase.generate_password_reset_link(
            tenant_id=tenant_id,
            email=firebase_user.email,
            continue_url=continue_url,
        )
        return PasswordResetLinkResponse(reset_link=link)


def get_users_service(
        firebase_service: FirebaseService = Depends(get_firebase_service),
        application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_application_db),
) -> UsersService:
    """Build a UsersService for FastAPI request scope."""
    registrations_repo = AdminRegistrationRepository(application_db)
    return UsersService(firebase_service, registrations_repo)
