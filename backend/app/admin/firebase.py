"""
Firebase facade module for admin operations.
Provides a unified interface for Firebase Admin SDK operations.
"""

import logging
import os
import secrets
import string
from functools import cache
from typing import Optional

import firebase_admin
from firebase_admin import credentials, tenant_mgt, auth, firestore_async
from google.cloud.firestore_v1 import DELETE_FIELD


class AuthClientsMap:
    """Cache for Firebase Auth clients per tenant."""

    def __init__(self):
        self.auth_clients = {}

    def get_auth_client(self, tenant_id: str):
        """
        Get or create an auth client for the specified tenant.

        :param tenant_id: The Firebase tenant ID.
        :return: Auth client for the specified tenant.
        """
        if tenant_id not in self.auth_clients:
            self.auth_clients[tenant_id] = tenant_mgt.auth_for_tenant(tenant_id)

        return self.auth_clients[tenant_id]


def _generate_random_password(length: int = 32) -> str:
    """
    Generate a secure random password.

    :param length: Length of the password to generate.
    :return: Random password string.
    """
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return "".join(secrets.choice(alphabet) for _ in range(length))


class FirebaseService:
    """
    Facade for Firebase Admin SDK operations.

    Provides methods for authentication and Firestore operations,
    abstracting the underlying Firebase Admin SDK complexity.
    """

    def __init__(self):
        self._db = None

        cred = credentials.ApplicationDefault()
        # Identity Platform tenants live in the admin Firebase project, which may differ from
        # GOOGLE_CLOUD_PROJECT (the backend's default project). Pass projectId explicitly when
        # ADMIN_FIREBASE_PROJECT_ID is set so tenant lookups target the right project.
        admin_project_id = os.getenv("ADMIN_FIREBASE_PROJECT_ID")
        init_options = {"projectId": admin_project_id} if admin_project_id else None
        firebase_admin.initialize_app(cred, options=init_options)
        firebase_admin.get_app()

        self._db = firestore_async.client()
        self._auth_clients = AuthClientsMap()
        self._logger = logging.getLogger(self.__class__.__name__)

    def list_users(
            self,
            tenant_id: str,
            max_results: int = 100,
            page_token: Optional[str] = None,
    ) -> tuple[list[auth.UserRecord], Optional[str]]:
        """
        List users from Firebase Authentication with cursor-based pagination.

        :param tenant_id: The Firebase tenant ID.
        :param max_results: Maximum number of users to return per page.
        :param page_token: Optional token for cursor-based pagination.
        :return: Tuple of (a list of Firebase UserRecords, next_page_token).
        """
        auth_client = self._auth_clients.get_auth_client(tenant_id)
        page = auth_client.list_users(max_results=max_results, page_token=page_token)
        return list(page.users), page.next_page_token

    async def fetch_access_roles_batch(self, user_ids: list[str]) -> dict[str, dict]:
        """
        Fetch access roles for multiple users in a single Firestore request.

        :param user_ids: List of user IDs to fetch access roles for.
        :return: Dictionary mapping user_id to access role data.
        """
        if not user_ids:
            return {}

        access_roles_collection = self._db.collection("access_roles")

        # Create document references for all user IDs
        doc_refs = [access_roles_collection.document(uid) for uid in user_ids]

        # Fetch all documents in a single batch request
        docs = self._db.get_all(doc_refs)

        # Build a dictionary mapping user_id to access role data
        access_roles = {}
        async for doc in docs:
            if doc.exists:
                access_roles[doc.id] = doc.to_dict()

        self._logger.debug("Fetched access roles for %d/%d users", len(access_roles), len(user_ids))

        return access_roles

    def create_user(
        self,
        tenant_id: str,
        email: str,
        display_name: str,
    ) -> auth.UserRecord:
        """
        Create a new user in Firebase Authentication.

        :param tenant_id: The Firebase tenant ID.
        :param email: User's email address.
        :param display_name: User's display name.
        :return: Created Firebase UserRecord.
        """
        auth_client = self._auth_clients.get_auth_client(tenant_id)
        password = _generate_random_password()

        user = auth_client.create_user(
            email=email,
            email_verified=True,
            password=password,
            display_name=display_name,
            disabled=False,
        )

        self._logger.info("Created Firebase user with UID: %s", user.uid)
        return user

    def get_user(self, tenant_id: str, user_id: str) -> Optional[auth.UserRecord]:
        """Look up a Firebase user by UID; returns None if the user doesn't exist."""
        auth_client = self._auth_clients.get_auth_client(tenant_id)
        try:
            return auth_client.get_user(user_id)
        except auth.UserNotFoundError:
            return None

    def update_user(
        self,
        tenant_id: str,
        user_id: str,
        display_name: Optional[str] = None,
        email: Optional[str] = None,
    ) -> auth.UserRecord:
        """
        Update a user's profile in Firebase Authentication.

        :param tenant_id: The Firebase tenant ID.
        :param user_id: The user ID to update.
        :param display_name: Optional new display name.
        :param email: Optional new email address.
        :return: Updated Firebase UserRecord.
        """
        auth_client = self._auth_clients.get_auth_client(tenant_id)
        kwargs: dict = {}
        if display_name is not None:
            kwargs["display_name"] = display_name
        if email is not None:
            kwargs["email"] = email
        user = auth_client.update_user(user_id, **kwargs)
        self._logger.info("Updated Firebase user with UID: %s", user.uid)
        return user

    def generate_password_reset_link(self, tenant_id: str, email: str) -> str:
        """Generate a password reset link for an existing Firebase user."""
        auth_client = self._auth_clients.get_auth_client(tenant_id)
        return auth_client.generate_password_reset_link(email)

    def set_custom_claims(
        self,
        tenant_id: str,
        user_id: str,
        role: str,
        institution_id: Optional[str] = None,
    ) -> None:
        """Set custom claims (role + optional institutionId) on a Firebase user.

        The admin frontend reads role from token custom claims, so any role
        change must be mirrored here in addition to the Firestore access_roles doc.
        """
        claims: dict = {"role": role}
        if institution_id:
            claims["institutionId"] = institution_id
        auth_client = self._auth_clients.get_auth_client(tenant_id)
        auth_client.set_custom_user_claims(user_id, claims)
        self._logger.info("Set custom claims on user %s: %s", user_id, claims)

    def delete_user(self, tenant_id: str, user_id: str) -> None:
        """
        Delete a user from Firebase Authentication.

        :param tenant_id: The Firebase tenant ID.
        :param user_id: The user ID to delete.
        """
        auth_client = self._auth_clients.get_auth_client(tenant_id)
        auth_client.delete_user(user_id)
        self._logger.info("Deleted Firebase user with UID: %s", user_id)

    async def create_access_role(
        self,
        user_id: str,
        role: str,
        institution_id: Optional[str] = None,
    ) -> None:
        """
        Create an access role document in Firestore.

        :param user_id: The user ID (document ID).
        :param role: The role to assign.
        :param institution_id: Optional institution ID for an institution_staff role.
        """
        access_role_data = {
            "role": role,
            "enabled": True,
        }

        if institution_id:
            access_role_data["institutionId"] = institution_id

        await self._db.collection("access_roles").document(user_id).set(access_role_data)
        self._logger.info("Created access role for user: %s with role: %s", user_id, role)

    async def update_access_role(
        self,
        user_id: str,
        role: str,
        institution_id: Optional[str] = None,
    ) -> None:
        """
        Update an access role document in Firestore.

        :param user_id: The user ID (document ID).
        :param role: The new role to assign.
        :param institution_id: Optional institution ID for an institution_staff role.
        """
        access_role_data = {
            "role": role,
        }

        if institution_id:
            access_role_data["institutionId"] = institution_id
        else:
            # Remove institutionId if not provided (for role changes from institution_staff to admin)
            access_role_data["institutionId"] = DELETE_FIELD

        await self._db.collection("access_roles").document(user_id).update(access_role_data)
        self._logger.info("Updated access role for user: %s to role: %s", user_id, role)

    async def delete_access_role(self, user_id: str) -> None:
        """
        Delete an access role document from the Firestore.

        :param user_id: The user ID (document ID).
        """
        await self._db.collection("access_roles").document(user_id).delete()
        self._logger.info("Deleted access role for user: %s", user_id)


@cache
def get_firebase_service() -> FirebaseService:
    """
    Get a singleton instance of the Firebase service.

    This function is used as a FastAPI dependency.

    :return: FirebaseService instance.
    """
    return FirebaseService()
