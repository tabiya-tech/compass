import sys
import os

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/backend directory.
sys.path.insert(0, libs_dir)

from dataclasses import dataclass


"""
Add this class at the top of the module
so that line `from deploy_backend import deploy_backend` is going to find the class in the module
Otherwise it is going to fail because BackendEnvVarsConfig is not defined yet
"""
@dataclass
class BackendEnvVarsConfig:
    """
    Environment variables for the backend service
    See the backend service for more information on the environment variables.
    """
    TAXONOMY_MONGODB_URI: str
    TAXONOMY_DATABASE_NAME: str
    TAXONOMY_MODEL_ID: str
    APPLICATION_MONGODB_URI: str
    APPLICATION_DATABASE_NAME: str
    USERDATA_MONGODB_URI: str
    USERDATA_DATABASE_NAME: str
    VERTEX_API_REGION: str
    TARGET_ENVIRONMENT: str
    BACKEND_URL: str
    FRONTEND_URL: str
    SENTRY_BACKEND_DSN: str
    ENABLE_SENTRY: str
    ROOT_PROJECT_ID: str
    GCP_OAUTH_CLIENT_ID: str
    GITHUB_SHA: str
    GITHUB_REF_NAME: str
    GITHUB_RUN_NUMBER: str


import pulumi
from deploy_backend import deploy_backend
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from lib.std_pulumi import getconfig, getenv


def _get_backend_env_vars(environment: str):
    taxonomy_mongodb_uri = getenv("TAXONOMY_MONGODB_URI")
    taxonomy_database_name = getenv("TAXONOMY_DATABASE_NAME")
    taxonomy_model_id = getenv("TAXONOMY_MODEL_ID")
    application_mongodb_uri = getenv("APPLICATION_MONGODB_URI")
    application_database_name = getenv("APPLICATION_DATABASE_NAME")
    userdata_database_name = getenv("USERDATA_DATABASE_NAME")
    userdata_mongodb_uri = getenv("USERDATA_MONGODB_URI")
    vertex_api_region = getenv("VERTEX_API_REGION")
    frontend_url = getenv("FRONTEND_URL")
    backend_url = getenv("BACKEND_URL")
    sentry_backend_dsn = getenv("SENTRY_BACKEND_DSN")
    enable_sentry = getenv("ENABLE_SENTRY")
    root_project_id = getenv("GCP_ROOT_PROJECT_ID")
    gcp_oauth_client_id = getenv("GCP_OAUTH_CLIENT_ID")
    commit_hash = getenv("GITHUB_SHA")
    branch_name = getenv("GITHUB_REF_NAME")
    run_number = getenv("GITHUB_RUN_NUMBER")

    return BackendEnvVarsConfig(
        TAXONOMY_MONGODB_URI=taxonomy_mongodb_uri,
        TAXONOMY_DATABASE_NAME=taxonomy_database_name,
        TAXONOMY_MODEL_ID=taxonomy_model_id,
        APPLICATION_MONGODB_URI=application_mongodb_uri,
        APPLICATION_DATABASE_NAME=application_database_name,
        USERDATA_DATABASE_NAME=userdata_database_name,
        USERDATA_MONGODB_URI=userdata_mongodb_uri,
        VERTEX_API_REGION=vertex_api_region,
        TARGET_ENVIRONMENT=environment,
        BACKEND_URL=backend_url,
        FRONTEND_URL=frontend_url,
        SENTRY_BACKEND_DSN=sentry_backend_dsn,
        ENABLE_SENTRY=enable_sentry,
        ROOT_PROJECT_ID=root_project_id,
        GCP_OAUTH_CLIENT_ID=gcp_oauth_client_id,
        GITHUB_SHA=commit_hash,
        GITHUB_REF_NAME=branch_name,
        GITHUB_RUN_NUMBER=run_number
    )


def main():
    environment = pulumi.get_stack()
    pulumi.info(f"Using Environment: {environment}")

    # Get the config values
    location = getconfig("region", "gcp")
    pulumi.info(f'Using location: {location}')

    # Get stack references
    env_reference = pulumi.StackReference(f"tabiya-tech/compass-environment/{environment}")
    project = env_reference.get_output("project_id")
    project_number = env_reference.get_output("project_number")
    environment_type = env_reference.get_output("environment_type")

    # get environment variables for the backend service
    env_vars = _get_backend_env_vars(environment)

    # Deploy the backend
    deploy_backend(
        project=project,
        location=location,
        environment=environment,
        project_number=project_number,
        environment_type=environment_type,
        env_vars=env_vars
    )


if __name__ == "__main__":
    main()
