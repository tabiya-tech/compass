"""
Script to create admin users in Firebase Authentication and Firestore.

Usage:
    # Dry run (preview changes without executing)
    python create_admin_user.py --name "John Doe" --email "john@example.com" --role admin --dry-run

    # Hot run (actually create the user)
    python create_admin_user.py --name "John Doe" --email "john@example.com" --role admin
    python create_admin_user.py --name "Jane Doe" --email "jane@example.com" --role institution_staff --institution-id "inst_123"

    # Create user under a tenant
    python create_admin_user.py --name "John Doe" --email "john@example.com" --role admin --tenant-id "tenant-abc123"

    # Specify project (required when tenant is in a different project than gcloud default)
    python create_admin_user.py --name "John Doe" --email "john@example.com" --role admin --tenant-id "tenant-abc123" --project-id "compass-dev-njila-awud7b7tl6gw"
"""

import argparse
import logging
import secrets
import string
from enum import Enum

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, tenant_mgt, auth

from pydantic import BaseModel

load_dotenv()

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class Role(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    INSTITUTION_STAFF = "institution_staff"


class Arguments(BaseModel):
    name: str
    email: str
    role: Role
    institution_id: str | None
    tenant_id: str
    project_id: str
    continue_url: str | None
    dry_run: bool


def generate_random_password(length: int = 32) -> str:
    """Generate a secure random password."""
    alphabet = string.ascii_letters + string.digits + string.punctuation
    password = "".join(secrets.choice(alphabet) for _ in range(length))
    logger.debug("Generated random password of length %d", length)
    return password


def get_auth_client(tenant_id: str):
    """Get the appropriate auth client based on the tenant."""
    return tenant_mgt.auth_for_tenant(tenant_id)


def create_firebase_user(name: str, email: str, password: str, tenant_id: str, dry_run: bool) -> str:
    """Create a user in Firebase Authentication."""
    if dry_run:
        logger.info("[DRY RUN] Would create Firebase user:")
        logger.info("[DRY RUN]   Email: %s", email)
        logger.info("[DRY RUN]   Display Name: %s", name)
        logger.info("[DRY RUN]   Email Verified: False")
        logger.info("[DRY RUN]   Disabled: False")
        if tenant_id:
            logger.info("[DRY RUN]   Tenant ID: %s", tenant_id)
        return "dry-run-user-id"

    logger.info("Creating Firebase user for email: %s", email)
    if tenant_id:
        logger.info("Creating user under tenant: %s", tenant_id)

    auth_client = get_auth_client(tenant_id)

    user = auth_client.create_user(
        email=email,
        email_verified=True,
        password=password,
        display_name=name,
        disabled=False
    )

    logger.info("Successfully created Firebase user with UID: %s", user.uid)
    return user.uid


def send_password_reset_email(email: str, tenant_id: str | None, continue_url: str | None, dry_run: bool) -> None:
    """Generate a password reset link for the user."""
    if dry_run:
        logger.info("[DRY RUN] Would generate password reset link for: %s", email)
        if tenant_id:
            logger.info("[DRY RUN]   Tenant ID: %s", tenant_id)
        return

    logger.info("Generating password reset link for: %s", email)

    action_code_settings = auth.ActionCodeSettings(url=continue_url) if continue_url else None

    auth_client = get_auth_client(tenant_id)
    link = auth_client.generate_password_reset_link(email, action_code_settings=action_code_settings)

    logger.info("Password reset link generated successfully")
    logger.info("Send this link to the user: %s", link)


def set_custom_claims(user_id: str, role: Role, institution_id: str | None, tenant_id: str, dry_run: bool) -> None:
    """Set custom claims on the Firebase user to encode role and institution."""
    claims: dict = {"role": role.value}
    if role == Role.INSTITUTION_STAFF and institution_id:
        claims["institutionId"] = institution_id

    if dry_run:
        logger.info("[DRY RUN] Would set custom claims on user '%s':", user_id)
        for key, value in claims.items():
            logger.info("[DRY RUN]   %s: %s", key, value)
        return

    logger.info("Setting custom claims for user: %s", user_id)
    auth_client = get_auth_client(tenant_id)
    auth_client.set_custom_user_claims(user_id, claims)
    logger.info("Successfully set custom claims")


def create_admin_user(args: Arguments) -> None:
    """Main function to create an admin user."""
    if args.dry_run:
        logger.info("=" * 50)
        logger.info("DRY RUN MODE - No changes will be made")
        logger.info("=" * 50)

    logger.info("Starting admin user creation process")
    logger.info("Name: %s, Email: %s, Role: %s", args.name, args.email, args.role.value)

    if args.role == Role.INSTITUTION_STAFF:
        logger.info("Institution ID: %s", args.institution_id)

    if args.tenant_id:
        logger.info("Tenant ID: %s", args.tenant_id)

    # Generate a random password
    password = generate_random_password()

    # Create the Firebase user
    user_id = create_firebase_user(args.name, args.email, password, args.tenant_id, args.dry_run)

    # Set custom claims on the Firebase user
    set_custom_claims(user_id, args.role, args.institution_id, args.tenant_id, args.dry_run)

    # Send password reset email
    send_password_reset_email(args.email, args.tenant_id, args.continue_url, args.dry_run)

    if args.dry_run:
        logger.info("=" * 50)
        logger.info("DRY RUN COMPLETE - Run without --dry-run to apply changes")
        logger.info("=" * 50)
    else:
        logger.info("Admin user creation completed successfully")
        logger.info("User ID: %s", user_id)


def parse_args() -> Arguments:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Create an admin user in Firebase Authentication and Firestore."
    )

    parser.add_argument(
        "--name",
        required=True,
        type=str,
        help="The display name of the user"
    )

    parser.add_argument(
        "--email",
        required=True,
        type=str,
        help="The email address of the user"
    )

    parser.add_argument(
        "--role",
        required=True,
        type=str,
        choices=[r.value for r in Role],
        help="The role of the user (admin or institution_staff)"
    )

    parser.add_argument(
        "--institution-id",
        required=False,
        type=str,
        help="The institution ID (required for institution_staff role)"
    )

    parser.add_argument(
        "--tenant-id",
        required=True,
        type=str,
        help="The Firebase tenant ID to create the user under"
    )

    parser.add_argument(
        "--project-id",
        required=True,
        type=str,
        help="The GCP project ID where the tenant exists (usually the Compass environment project)"
    )

    parser.add_argument(
        "--continue-url",
        required=False,
        type=str,
        help="URL to redirect to after password reset (e.g. https://admin.njila.ai)"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without actually creating the user"
    )

    parsed = parser.parse_args()

    role = Role(parsed.role)

    # Validate institution_id requirement
    if role == Role.INSTITUTION_STAFF and not parsed.institution_id:
        parser.error("--institution-id is required when role is institution_staff")

    if role == Role.SUPER_ADMIN and parsed.institution_id:
        parser.error("--institution-id must not be provided when role is super_admin")

    if role == Role.ADMIN and parsed.institution_id:
        logger.warning("Institution ID provided but role is %s, ignoring institution ID", role.value)

    return Arguments(
        name=parsed.name,
        email=parsed.email,
        role=role,
        institution_id=parsed.institution_id if role == Role.INSTITUTION_STAFF else None,
        tenant_id=parsed.tenant_id,
        project_id=parsed.project_id,
        continue_url=parsed.continue_url,
        dry_run=parsed.dry_run
    )


def main() -> None:
    """Entry point for the script."""
    try:
        args = parse_args()

        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, options={"projectId": args.project_id})
        authed = cred.get_credential()
        cred_desc = getattr(authed, "service_account_email", None) or "user credentials"
        logger.debug("Firebase Admin SDK initialized with credentials %s", cred_desc)

        create_admin_user(args)
    except  firebase_admin._auth_utils.InsufficientPermissionError as e:
        logger.error("Insufficient permission to create admin user: %s", e)
        raise
    except Exception as e:
        logger.error("Failed to create admin user: %s", e)
        raise

if __name__ == "__main__":
    main()
