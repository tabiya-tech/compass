import os
import sys

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/organisation directory
sys.path.insert(0, libs_dir)

from create_organizational_base import create_organizational_base
from dotenv import load_dotenv
from lib.std_pulumi import getenv, getconfig

# Load environment variables from .env file
load_dotenv()


def main():
    # Get the environment variables
    organization_id = getenv("GCP_ORGANISATION_ID")
    root_project_id = getenv("GCP_ROOT_PROJECT_ID")
    customer_id = getenv("CUSTOMER_ID")

    # Get the config values
    region = getconfig("region")

    # Create the organizational base
    create_organizational_base(
        organization_id=organization_id,
        root_project_id=root_project_id,
        region=region,
        customer_id=customer_id
    )


if __name__ == "__main__":
    main()
