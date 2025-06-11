import argparse
import json
import os
from datetime import datetime

import pandas as pd
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClient

from scripts.conversation_analysis.constants import SCRIPT_DIR, DEMOGRAPHICS_FILE_NAME, DEPLOYMENTS_FILE_NAME

# Global variables to store file paths
DEMOGRAPHIC_FILE = None
DEPLOYMENTS_FILE = None
demographic_df = None


def _valid_datetime(datetime_str: str):
    try:
        return datetime.strptime(datetime_str, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        raise argparse.ArgumentTypeError(f"Invalid date: '{datetime_str}'. Expected format: YYYY-MM-DD HH:MM:SS")


def _get_db_connection(mongodb_uri: str, database_name: str) -> AsyncIOMotorDatabase:
    client = AsyncIOMotorClient(mongodb_uri, tlsAllowInvalidCertificates=True)
    return client.get_database(database_name)


def initialize_files(demographics_file: str, deployments_file: str) -> None:
    """
    Initialize the file paths for demographics and deployments files.

    :param demographics_file: Path to demographics CSV file
    :param deployments_file: Path to deployments JSON file
    """
    global DEMOGRAPHIC_FILE, DEPLOYMENTS_FILE, demographic_df
    
    DEMOGRAPHIC_FILE = demographics_file
    DEPLOYMENTS_FILE = deployments_file
    
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


def _load_deployments_from_file() -> list[tuple[datetime, str]]:
    """
    Load deployments from a JSON file.
    :return: List of tuples containing deployment date and label.
    """
    if DEPLOYMENTS_FILE is None:
        raise RuntimeError("Deployments file not initialized. Call initialize_files() first.")

    # Load deployments file
    print(f"Loading deployments from {DEPLOYMENTS_FILE}...")
    if not os.path.exists(DEPLOYMENTS_FILE):
        raise FileNotFoundError(f"Deployments file not found at {DEPLOYMENTS_FILE}")

    with open(DEPLOYMENTS_FILE, "r") as f:
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
