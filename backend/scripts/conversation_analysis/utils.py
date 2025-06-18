import argparse
import json
import os
from datetime import datetime

import pandas as pd
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClient

from scripts.conversation_analysis.constants import SCRIPT_DIR, DEMOGRAPHICS_FILE_NAME, DEPLOYMENTS_FILE_NAME

# Load the demographics file
DEMOGRAPHIC_FILE = os.path.join(SCRIPT_DIR, DEMOGRAPHICS_FILE_NAME)
demographic_df = pd.read_csv(DEMOGRAPHIC_FILE)


def _valid_datetime(datetime_str: str):
    try:
        return datetime.strptime(datetime_str, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise argparse.ArgumentTypeError(f"Invalid date: '{datetime_str}'. Expected format: YYYY-MM-DD HH:MM:SS")


def _get_db_connection(mongodb_uri: str, database_name: str) -> AsyncIOMotorDatabase:
    client = AsyncIOMotorClient(mongodb_uri, tlsAllowInvalidCertificates=True)
    return client.get_database(database_name)


def _load_demographics_from_file() -> dict:
    """
    Load demographics from a JSON file.

    :param file_path: Path to the JSON file containing demographics.
    :return: Dictionary with demographics data.
    """
    print(f"Loading demographics from {DEMOGRAPHIC_FILE}...")
    # Convert to a map of user_id → full row as dict (excluding index)
    demographic_map = {
        str(row["user_id"]): row.drop(labels=["user_id"]).to_dict()
        for _, row in demographic_df.iterrows()
    }

    return demographic_map


def _load_deployments_from_file() -> list[tuple[datetime, str]]:
    """
    Load deployments from a JSON file.
    :return: Dictionary with deployments data.
    """
    # Load deployments file
    print(f"Loading deployments from {os.path.join(SCRIPT_DIR, DEPLOYMENTS_FILE_NAME)}...")
    with open(os.path.join(SCRIPT_DIR, DEPLOYMENTS_FILE_NAME), "r") as f:
        raw_deployments = json.load(f)
    deployments = [
        (datetime.fromisoformat(raw_deployments[i]), raw_deployments[i + 1])
        for i in range(0, len(raw_deployments), 2)
    ]
    deployments.sort(key=lambda x: x[0])
    if not deployments:
        raise ValueError("No deployments found in deployments.json")
    else:
        print(f"Found {len(deployments)} deployments in deployments.json.")
        return deployments
