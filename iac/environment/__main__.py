import os
import sys

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/common directory
sys.path.insert(0, libs_dir)

import pulumi
from create_new_environment import create_new_environment
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def main():
    # Get the config values
    config = pulumi.Config()
    environment = config.require("environment")
    environment_name = config.require("environment_name")
    environment_type = config.require("environment_type")
    billing_account = config.require("gcp_billing_account")
    root_project = config.require("gcp_root_project")

    pulumi.info(f'Creating environment:{environment} with name {environment_name} and type {environment_type}')

    org_reference = pulumi.StackReference("tabiya-tech/compass-organization/base")

    if environment_type == "production":
        folder_id = org_reference.get_output("folder_prod_id")
    else:
        folder_id = org_reference.get_output("folder_dev_id")

    # Deploy the aws ns
    create_new_environment(folder_id, billing_account, root_project, environment, environment_name, environment_type)


if __name__ == "__main__":
    main()
