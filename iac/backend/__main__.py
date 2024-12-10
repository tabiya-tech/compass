import sys
import os

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/common directory
sys.path.insert(0, libs_dir)

import pulumi
from deploy_backend import deploy_backend
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def main():
    # Get the config values
    config = pulumi.Config("gcp")
    location = config.require("region")
    pulumi.info(f'Using location:{location}')
    environment = pulumi.get_stack()
    pulumi.info(f"Using Environment: {environment}")

    env_reference = pulumi.StackReference(f"tabiya-tech/compass-environment/{environment}")
    project = env_reference.get_output("project_id")

    # Deploy the backend
    deploy_backend(project, location, environment)


if __name__ == "__main__":
    main()
