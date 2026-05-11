#!/usr/bin/env python3
"""
Seed the programme_skills collection from the institutions collection.

For each unique programme name found across all institutions, calls the running
backend's /search/skills endpoint and stores the top-k results in the
programme_skills collection of the application database.

Idempotent: re-running will overwrite existing documents.

The institutions collection must already be seeded before running this script.
See seed_institutions.py.

Usage:
    APPLICATION_MONGODB_URI=<uri> APPLICATION_DATABASE_NAME=<db> \\
    poetry run python scripts/seed_programme_skills.py \\
        --backend-url https://api.example.com \\
        [--top-k 5] \\
        [--delay 0.1] \\
        [--api-key <key>] \\
        [--dry-run]

Environment variables:
    APPLICATION_MONGODB_URI      MongoDB connection URI (required)
    APPLICATION_DATABASE_NAME    Database name (required)
    BACKEND_API_KEY              Value for x-api-key header (default: local-dev)

Arguments:
    --backend-url                Base URL of the running backend (required)
"""

import argparse
import asyncio
import logging
import os
import sys

import httpx
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

INSTITUTIONS_COLLECTION = "institutions"
PROGRAMME_SKILLS_COLLECTION = "programme_skills"
DEFAULT_TOP_K = 5
DEFAULT_DELAY = 0.1  # seconds between requests to avoid hammering the backend


async def load_unique_programme_names(collection) -> list[str]:
    """Extract unique programme names from the institutions collection."""
    pipeline = [
        {"$unwind": "$programmes"},
        {"$group": {"_id": "$programmes.name"}},
        {"$sort": {"_id": 1}},
    ]
    names = []
    async for doc in collection.aggregate(pipeline):
        name = doc["_id"]
        if name and str(name).strip():
            names.append(str(name).strip())
    return names


async def fetch_skills(
    client: httpx.AsyncClient,
    backend_url: str,
    programme_name: str,
    top_k: int,
    api_key: str,
) -> list[dict]:
    """Call /search/skills and return the skill dicts (without score/description)."""
    try:
        resp = await client.get(
            f"{backend_url}/search/skills",
            params={"query": programme_name, "top_k": top_k},
            headers={"x-api-key": api_key},
            timeout=30.0,
        )
        resp.raise_for_status()
        skills = resp.json().get("skills", [])
        # Store fields useful for display and future deduplication.
        # Drop 'score' (ephemeral) and 'description' (large, not needed in sidebar).
        return [
            {
                "UUID": s.get("UUID", ""),
                "originUUID": s.get("originUUID", ""),
                "preferredLabel": s.get("preferredLabel", ""),
                "altLabels": s.get("altLabels", []),
                "skillType": s.get("skillType", ""),
                "modelId": s.get("modelId", ""),
            }
            for s in skills
            if s.get("preferredLabel")
        ]
    except Exception as exc:
        logger.warning("Failed to fetch skills for %r: %s", programme_name, exc)
        return []


async def seed(backend_url: str, top_k: int, delay: float, api_key: str, dry_run: bool) -> int:
    mongodb_uri = os.environ.get("APPLICATION_MONGODB_URI")
    db_name = os.environ.get("APPLICATION_DATABASE_NAME")

    if not mongodb_uri:
        raise ValueError("APPLICATION_MONGODB_URI environment variable is not set")
    if not db_name:
        raise ValueError("APPLICATION_DATABASE_NAME environment variable is not set")

    client = AsyncIOMotorClient(mongodb_uri, tlsAllowInvalidCertificates=True)
    try:
        db = client[db_name]
        institutions_col = db[INSTITUTIONS_COLLECTION]
        programme_skills_col = db[PROGRAMME_SKILLS_COLLECTION]

        logger.info("Loading unique programme names from '%s' collection …", INSTITUTIONS_COLLECTION)
        names = await load_unique_programme_names(institutions_col)
        if not names:
            logger.error(
                "No programme names found in '%s'. "
                "Have you run seed_institutions.py first?",
                INSTITUTIONS_COLLECTION,
            )
            return 1
        logger.info("Found %d unique programme names", len(names))

        if dry_run:
            logger.info("Dry run — no writes will be performed. Programmes found:")
            for name in names:
                logger.info("  %s", name)
            return 0

        # Ensure unique index on programme_name for fast lookup + idempotency
        await programme_skills_col.create_index([("programme_name", 1)], unique=True)

        ok = failed = 0
        async with httpx.AsyncClient() as http:
            for i, name in enumerate(names, 1):
                skills = await fetch_skills(http, backend_url, name, top_k, api_key)
                doc = {"programme_name": name, "skills": skills}
                await programme_skills_col.replace_one({"programme_name": name}, doc, upsert=True)

                if skills:
                    ok += 1
                    logger.info("[%d/%d] %-60s → %d skills", i, len(names), name, len(skills))
                else:
                    failed += 1
                    logger.warning("[%d/%d] %-60s → no skills returned", i, len(names), name)

                if delay and i < len(names):
                    await asyncio.sleep(delay)

        logger.info("Done. %d succeeded, %d with no skills.", ok, failed)
        return 0 if failed == 0 else 1
    finally:
        client.close()


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed programme_skills collection from the institutions collection.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--backend-url",
        required=True,
        help="Base URL of the running backend (e.g. https://api.example.com)",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=DEFAULT_TOP_K,
        help=f"Number of skills to fetch per programme (default: {DEFAULT_TOP_K})",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help=f"Seconds to sleep between requests (default: {DEFAULT_DELAY})",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("BACKEND_API_KEY", "local-dev"),
        help="Value for x-api-key header (env: BACKEND_API_KEY, default: local-dev)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print programme names that would be processed without writing to the DB or calling the backend",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    exit_code = asyncio.run(seed(args.backend_url, args.top_k, args.delay, args.api_key, args.dry_run))
    sys.exit(exit_code)
