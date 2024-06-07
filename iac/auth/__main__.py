import os

import pulumi
from dotenv import load_dotenv
from setup_identity_platform import deploy_auth

# Load environment variables from .env file
load_dotenv()

def main():
    # Get the config values
    config = pulumi.Config("gcp")
    project = config.require("project")
    pulumi.info(f'Using project:{project}')
    location = config.require("region")
    pulumi.info(f'Using location:{location}')
    environment = pulumi.get_stack()
    pulumi.info(f"Using Environment: {environment}")

    # Get frontend domain from envs
    frontend_domain = os.getenv("FRONTEND_DOMAIN")
    if not frontend_domain:
        raise ValueError("environment variable FRONTEND_DOMAIN is required")

    # Deploy the auth
    deploy_auth(project, location, environment, frontend_domain)

if __name__ == "__main__":
    main()
