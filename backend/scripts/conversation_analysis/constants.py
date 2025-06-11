import os

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Define paths relative to the script directory
DEFAULT_EXPORTS_DIR = os.path.join(SCRIPT_DIR, "exports")

# Constants
DEPLOYMENTS_FILE_NAME = "deployments.json"
DEMOGRAPHICS_FILE_NAME = "pseudonymized.csv"
BATCH_SIZE = 100
