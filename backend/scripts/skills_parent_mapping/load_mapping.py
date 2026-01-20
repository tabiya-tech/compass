#!/usr/bin/env python3
"""Load skill parent mappings from a CSV into the taxonomy MongoDB.

Usage:
    poetry run python scripts/skills_parent_mapping/load_mapping.py --csv /path/to/skills_with_parent.csv
"""
import argparse
import asyncio
import csv
import logging
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from features.skills_granularity.constants import (
    SKILL_PARENT_MAPPING_COLLECTION,
    CHILD_SKILL_ID_FIELD,
    PARENT_ID_FIELD,
    PARENT_LABEL_FIELD,
    PARENT_OBJECT_TYPE_FIELD,
    UPDATED_AT_FIELD,
    SOURCE_FILE_FIELD,
)

REQUIRED_COLUMNS = {"ID", "PARENTID", "PARENTOBJECTTYPE", "PARENTLABEL"}


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Load skill parent mappings from a CSV into MongoDB.")
    parser.add_argument("--csv", required=True, help="Path to the CSV file with parent mappings.")
    return parser.parse_args()


async def _load_mapping(*, csv_path: str, mongodb_uri: str, database_name: str) -> None:
    client = AsyncIOMotorClient(mongodb_uri, tlsAllowInvalidCertificates=True)
    db = client.get_database(database_name)
    collection = db.get_collection(SKILL_PARENT_MAPPING_COLLECTION)

    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    with open(csv_path, mode="r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if reader.fieldnames is None:
            raise ValueError("CSV file has no headers.")

        missing = REQUIRED_COLUMNS.difference({name.strip() for name in reader.fieldnames})
        if missing:
            raise ValueError(f"CSV missing required columns: {', '.join(sorted(missing))}")

        now = datetime.now(timezone.utc)
        source_file = os.path.basename(csv_path)
        documents: list[dict[str, str]] = []
        skipped = 0

        for row in reader:
            child_skill_id = (row.get("ID") or "").strip()
            parent_id = (row.get("PARENTID") or "").strip()
            parent_type = (row.get("PARENTOBJECTTYPE") or "").strip()
            parent_label = (row.get("PARENTLABEL") or "").strip()

            if not child_skill_id or not parent_id or not parent_type or not parent_label:
                skipped += 1
                continue

            documents.append({
                CHILD_SKILL_ID_FIELD: child_skill_id,
                PARENT_ID_FIELD: parent_id,
                PARENT_OBJECT_TYPE_FIELD: parent_type,
                PARENT_LABEL_FIELD: parent_label,
                UPDATED_AT_FIELD: now,
                SOURCE_FILE_FIELD: source_file,
            })

    await collection.delete_many({})
    await collection.create_index([(CHILD_SKILL_ID_FIELD, 1)], unique=True)

    if documents:
        await collection.insert_many(documents)

    logging.info("Inserted %d mappings (skipped %d rows).", len(documents), skipped)
    client.close()


def main() -> None:
    load_dotenv()
    logging.basicConfig(level=logging.INFO)

    args = _parse_args()
    mongodb_uri = os.getenv("APPLICATION_MONGODB_URI")
    database_name = os.getenv("APPLICATION_DATABASE_NAME")

    if not mongodb_uri:
        raise ValueError("APPLICATION_MONGODB_URI is required")
    if not database_name:
        raise ValueError("APPLICATION_DATABASE_NAME is required")

    asyncio.run(_load_mapping(csv_path=args.csv, mongodb_uri=mongodb_uri, database_name=database_name))


if __name__ == "__main__":
    main()
