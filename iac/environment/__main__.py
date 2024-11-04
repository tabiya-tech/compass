import os
import sys

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/environment directory
sys.path.insert(0, libs_dir)

import pulumi
from lib.std_pulumi import getconfig, getenv
from create_new_environment import create_new_environment

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def main():
    environment = pulumi.get_stack()
    environment_name = f'compass {environment}'

    # Get the config values
    environment_type = getconfig("environment_type")
    pulumi.info(f'Creating environment:{environment} with name {environment_name} and type {environment_type}')

    # Get stack references
    org_reference = pulumi.StackReference("tabiya-tech/compass-organization/base")
    if environment_type == "prod":
        folder_id = org_reference.get_output("folder_prod_id")
    else:
        folder_id = org_reference.get_output("folder_dev_id")

    # Get the environment variables
    billing_account = getenv("GCP_BILLING_ACCOUNT")
    root_project = getenv("GCP_ROOT_PROJECT_NAME")

    # set up the environment/project
    create_new_environment(
        folder_id=folder_id,
        billing_account=billing_account,
        root_project=root_project,
        environment=environment,
        environment_name=environment_name,
        environment_type=environment_type
    )


if __name__ == "__main__":
    main()
