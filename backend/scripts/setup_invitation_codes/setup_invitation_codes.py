#!/usr/bin/env python3
import argparse
import logging
import os
import json
import asyncio

from motor.motor_asyncio import AsyncIOMotorClient

from app.invitations.repository import UserInvitationRepository
from app.invitations.types import UserInvitation

logger = logging.getLogger(__name__)


async def main(input_file: str):
    # ensure that in a current directory, a file named given.json with a list of invitation codes.
    with open(os.path.join(input_file)) as f:
        given = json.load(f)

    # validate the json file.
    invitation_codes = []
    for item in given:
        invitation_codes.append(UserInvitation(
            **item,
            id="",  # id is not required in the sample.
        ))

    # connect to the database
    mongo_uri = os.getenv("INVITATION_CODES_MONGODB_URI")
    if mongo_uri is None:  # noqa
        raise ValueError("The MongoDB URI is not set in the environment variables (INVITATION_CODES_MONGODB_URI)")

    database_name = os.getenv("INVITATION_CODES_DB_NAME")
    if database_name is None:  # noqa
        raise ValueError("The database name is not set in the environment variables (INVITATION_CODES_DB_NAME)")

    # Connect to MongoDB
    client = AsyncIOMotorClient(mongo_uri, tlsAllowInvalidCertificates=True)
    db = client.get_database(database_name)
    repository = UserInvitationRepository(db)

    for invitation_code in invitation_codes:
        await repository.upsert_invitation_code(invitation_code)
        logger.info(f"Saved invitation code: {invitation_code.invitation_code}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="set up invitation codes from a JSON file")

    parser.add_argument(
        "--input-file",
        type=str,
        required=True,
        help="The path to the JSON file with invitation codes, (absolute or relative to the current working directory)",
    )

    args = parser.parse_args()
    asyncio.run(main(input_file=args.input_file))
