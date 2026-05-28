"""
Script to generate a password reset link for an existing admin user.

Usage:
    python generate_password_reset_link.py --email "john@example.com" --tenant-id "tenant-abc123" --project-id "compass-dev-njila-awud7b7tl6gw" --continue-url "https://admin.njila.ai"
"""

import argparse
import logging

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, tenant_mgt, auth

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate a password reset link for an existing Firebase user."
    )
    parser.add_argument("--email", required=True, type=str, help="The email address of the user")
    parser.add_argument("--tenant-id", required=True, type=str, help="The Firebase tenant ID")
    parser.add_argument("--project-id", required=True, type=str, help="The GCP project ID")
    parser.add_argument("--continue-url", required=False, type=str, help="URL to redirect to after password reset (e.g. https://admin.njila.ai)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, options={"projectId": args.project_id})

    action_code_settings = auth.ActionCodeSettings(url=args.continue_url) if args.continue_url else None

    auth_client = tenant_mgt.auth_for_tenant(args.tenant_id)
    link = auth_client.generate_password_reset_link(args.email, action_code_settings=action_code_settings)

    logger.info("Password reset link generated for: %s", args.email)
    print(f"\nPassword reset link:\n{link}\n")


if __name__ == "__main__":
    main()
