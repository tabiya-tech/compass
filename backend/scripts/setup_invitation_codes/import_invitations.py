#!/usr/bin/env python3

import os
import json
import asyncio
import logging
import argparse
from datetime import timezone, datetime
from textwrap import dedent

from motor.motor_asyncio import AsyncIOMotorClient
from pydantic_settings import BaseSettings

from app.invitations import UserInvitation, InvitationType, UserInvitationRepository
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement

logger = logging.getLogger(__name__)


class ScriptSettings(BaseSettings):
    mongodb_uri: str
    db_name: str

    class Config:
        env_prefix = "INVITATION_CODES_"


async def import_invitations(repository: UserInvitationRepository, invitations_dicts: list[dict]):
    logger.info("Importing the invitations in the database.......")

    # Validate the JSON file contents to match the UserInvitation schema.
    invitations = []
    for invitation_dict in invitations_dicts:
        invitations.append(UserInvitation(
            invitation_code=invitation_dict.get("invitation_code"),
            remaining_usage=invitation_dict.get("remaining_usage"),
            allowed_usage=invitation_dict.get("allowed_usage"),

            # Convert all user dates to the UTC timezone
            valid_from=datetime.fromisoformat(invitation_dict.get("valid_from")).astimezone(tz=timezone.utc),
            valid_until=datetime.fromisoformat(invitation_dict.get("valid_until")).astimezone(tz=timezone.utc),

            # Lookup by value
            invitation_type=InvitationType(invitation_dict.get("invitation_type")),
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement(
                invitation_dict.get("sensitive_personal_data_requirement"))
        ))

    # upsert the invitation codes
    await repository.upsert_many_invitations(invitations)

    logger.info(f"Successfully imported {len(invitations)} invitation codes.")


async def _main(input_file: str):
    # 1. Import the JSON input file.
    with open(os.path.join(input_file)) as f:
        invitations_dicts = json.load(f)

    # 2. Connect to the database
    settings = ScriptSettings()  # type: ignore
    client = AsyncIOMotorClient(settings.mongodb_uri, tlsAllowInvalidCertificates=True)
    db = client.get_database(settings.db_name)
    repository = UserInvitationRepository(db)

    # 3. Import the invitation codes
    try:
        await import_invitations(repository, invitations_dicts)
    except Exception as e:
        logger.exception(e)
        logger.error(f"An error occurred while importing the invitation codes: {e}")
    finally:
        # 5. Close the database connection
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        formatter_class=argparse.RawTextHelpFormatter,
        description="Import invitations from a JSON file",
        epilog=dedent(f"""
        Considerations:
           - Environment variables: {ScriptSettings.Config.env_prefix}MONGODB_URI and {ScriptSettings.Config.env_prefix}DB_NAME are required.
           - The json file with the invitation codes should be an array of objects (see the sample.json file for an example and below for the format). 
           - If an invitation from the json file already exists in the database (the invitation is identified by it's code), the script will overwrite it.
           - The dates should in ISO 8601 format with timezones. You can use any timezone, if none is provided UTC will be assumed.
           Use the following JSON format for the input file:
           [
              {{
                "allowed_usage": The total capacity of users allowed to use this invitation code, e.g. 1000,
                "remaining_usage": The remaining capacity of users allowed to use this invitation code, typically the same as allowed_usage , .g. 1000,
                "invitation_code": The invitation code to be used by the user, e.g. "login-1",
                "invitation_type": "LOGIN" for a login code or "REGISTER" for a registration code,
                "sensitive_personal_data_requirement": The sensitivity of the personal data required for the user to use this invitation code, e.g. "NOT_AVAILABLE" | "REQUIRED" | "NOT_REQUIRED"
                "valid_from": The date and time when the invitation code becomes valid in ISO 8601 format e.g. "2025-01-01T00:00:00.000Z",
                "valid_until": The date and time after which the invitation code becomes invalid in ISO 8601 format e.g. "2026-01-01T00:00:00.000Z"
              }},
            ]
        """),
    )
    #
    parser.add_argument(
        "--input-file",
        type=str,
        required=True,
        help="The path to the JSON file with invitation codes, (absolute or relative to the current working directory)",
    )

    args = parser.parse_args()
    asyncio.run(_main(input_file=args.input_file))
