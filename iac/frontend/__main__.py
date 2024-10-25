import os
import sys

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/frontend directory
sys.path.insert(0, libs_dir)

import pulumi
from deploy_frontend import deploy_frontend
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from lib.std_pulumi import getconfig


def main():
    environment = pulumi.get_stack()
    pulumi.info(f"Using Environment: {environment}")

    # Get the config values
    location = getconfig("region", "gcp")
    pulumi.info(f'Using location:{location}')

    # get stack reference
    env_reference = pulumi.StackReference(f"tabiya-tech/compass-environment/{environment}")
    project = env_reference.get_output("project_id")

    # Deploy the frontend
    deploy_frontend(project, location, environment)


if __name__ == "__main__":
    main()
