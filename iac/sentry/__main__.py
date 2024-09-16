import os
import pulumi
from create_sentry_project import create_sentry_project
from dotenv import load_dotenv


# Load environment variables from .env file
load_dotenv()

def main():
    # Get the config values
    config = pulumi.Config("sen")
    project = config.require("project_name")
    pulumi.info(f'Using project:{project}')
    sentry_auth_token = os.getenv("SENTRY_AUTH_TOKEN")
    auth_token_preview = sentry_auth_token[:5] + '*' * (len(sentry_auth_token) - 5) if sentry_auth_token else None
    pulumi.info(f'Using auth_token:{auth_token_preview}')
    organization = config.require("organization")
    team = config.require("team")

    # Create the sentry project
    create_sentry_project(organization, team, sentry_auth_token, project)


if __name__ == "__main__":
    main()
