import os
import sys

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/auth directory
sys.path.insert(0, libs_dir)

import pulumi
from dotenv import load_dotenv
from setup_identity_platform import deploy_auth

from lib.std_pulumi import getenv, getconfig

# Load environment variables from .env file
load_dotenv()


def main():
    environment = pulumi.get_stack()

    # get the config values
    location = getconfig(name="region", config="gcp")

    # get stack references
    env_reference = pulumi.StackReference(f"tabiya-tech/compass-environment/{environment}")
    project = env_reference.get_output("project_id")

    # Get environment variables
    frontend_domain = getenv("FRONTEND_DOMAIN")
    gcp_oauth_client_id = getenv("GCP_OAUTH_CLIENT_ID")
    gcp_oauth_client_secret = getenv("GCP_OAUTH_CLIENT_SECRET")

    pulumi.info(f"Using Environment: {environment}")
    pulumi.info(f'Using location:{location}')

    # Deploy the auth
    deploy_auth(project, location, environment, frontend_domain, gcp_oauth_client_id, gcp_oauth_client_secret)


if __name__ == "__main__":
    main()
