import argparse
import json
import os
from datetime import datetime

import pandas as pd
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClient

# Global variables to store file paths
DEMOGRAPHIC_FILE = None
VERSIONS_FILE = None
demographic_df = None


def _valid_datetime(datetime_str: str):
    try:
        return datetime.strptime(datetime_str, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise argparse.ArgumentTypeError(f"Invalid date: '{datetime_str}'. Expected format: YYYY-MM-DD HH:MM:SS")


def _get_db_connection(mongodb_uri: str, database_name: str) -> AsyncIOMotorDatabase:
    client = AsyncIOMotorClient(mongodb_uri, tlsAllowInvalidCertificates=True)
    return client.get_database(database_name)


def initialize_files(demographics_file: str, versions_file: str) -> None:
    """
    Initialize the file paths for demographics and versions files.

    :param demographics_file: Path to demographics CSV file
    :param versions_file: Path to versions JSON file
    """
    global DEMOGRAPHIC_FILE, VERSIONS_FILE, demographic_df
    
    DEMOGRAPHIC_FILE = demographics_file
    VERSIONS_FILE = versions_file
    
    # Load demographics file
    if not os.path.exists(DEMOGRAPHIC_FILE):
        raise FileNotFoundError(f"Demographics file not found at {DEMOGRAPHIC_FILE}")
    demographic_df = pd.read_csv(DEMOGRAPHIC_FILE)


def _load_demographics_from_file() -> dict:
    """
    Load demographics from a CSV file.
    :return: Dictionary with demographics data.
    """
    if demographic_df is None:
        raise RuntimeError("Demographics file not initialized. Call initialize_files() first.")

    print(f"Loading demographics from {DEMOGRAPHIC_FILE}...")
    # Convert to a map of user_id → full row as dict (excluding index)
    demographic_map = {
        str(row["user_id"]): row.drop(labels=["user_id"]).to_dict()
        for _, row in demographic_df.iterrows()
    }

    return demographic_map


def _load_versions_from_file() -> list[tuple[datetime, str]]:
    """
    Load versions from a JSON file.
    :return: List of tuples containing deployment date and label.
    """
    if VERSIONS_FILE is None:
        raise RuntimeError("Versions file not initialized. Call initialize_files() first.")

    # Load versions file
    print(f"Loading versions from {VERSIONS_FILE}...")
    if not os.path.exists(VERSIONS_FILE):
        raise FileNotFoundError(f"Versions file not found at {VERSIONS_FILE}")

    with open(VERSIONS_FILE, "r") as f:
        raw_versions = json.load(f)
    versions = [
        (datetime.fromisoformat(raw_versions[i]), raw_versions[i + 1])
        for i in range(0, len(raw_versions), 2)
    ]
    versions.sort(key=lambda x: x[0])
    if not versions:
        raise ValueError("No versions found in versions.json")
    else:
        print(f"Found {len(versions)} versions in versions.json.")
        return versions
