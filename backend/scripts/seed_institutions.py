#!/usr/bin/env python3
"""
Seed the institutions collection from institutions-programmes.json.

Usage:
    APPLICATION_MONGODB_URI=<uri> APPLICATION_DATABASE_NAME=<db> poetry run python scripts/seed_institutions.py [path/to/institutions-programmes.json]

The script uses the same APPLICATION_MONGODB_URI / APPLICATION_DATABASE_NAME env vars as the main
application (set in your .env file or environment).

NaN values produced by the Python JSON serialiser are replaced with null before parsing.
"""

import asyncio
import json
import logging
import os
import re
import sys

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

# Load .env from the backend directory (parent of scripts/)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

COLLECTION_NAME = "institutions"


def _load_data(path: str) -> list[dict]:
    """Load JSON, replacing Python-style NaN with null."""
    with open(path, "r", encoding="utf-8") as fh:
        raw = fh.read()
    # NaN is not valid JSON; replace bare NaN tokens with null
    cleaned = re.sub(r"\bNaN\b", "null", raw)
    return json.loads(cleaned)


async def seed(json_path: str):
    mongodb_uri = os.environ.get("APPLICATION_MONGODB_URI")
    db_name = os.environ.get("APPLICATION_DATABASE_NAME")

    if not mongodb_uri:
        raise ValueError("APPLICATION_MONGODB_URI environment variable is not set")
    if not db_name:
        raise ValueError("APPLICATION_DATABASE_NAME environment variable is not set")

    logger.info("Loading data from %s", json_path)
    institutions = _load_data(json_path)
    logger.info("Loaded %d institution records", len(institutions))

    client = AsyncIOMotorClient(mongodb_uri, tlsAllowInvalidCertificates=True)
    try:
        collection = client[db_name][COLLECTION_NAME]

        # Drop existing documents so re-running is idempotent
        deleted = await collection.delete_many({})
        logger.info("Cleared %d existing documents", deleted.deleted_count)

        if institutions:
            result = await collection.insert_many(institutions, ordered=False)
            logger.info("Inserted %d documents into '%s'", len(result.inserted_ids), COLLECTION_NAME)
        else:
            logger.warning("No records to insert")
    finally:
        client.close()


if __name__ == "__main__":
    default_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "institutions-programmes.json"
    )
    json_file = sys.argv[1] if len(sys.argv) > 1 else default_path
    asyncio.run(seed(json_file))
