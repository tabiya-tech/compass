import sys
import os
import pulumi

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/backend directory.
sys.path.insert(0, libs_dir)

from deploy_backend import deploy_backend, BackendServiceConfig
from lib import getconfig, getstackref, getenv, parse_realm_env_name_from_stack, load_dot_realm_env, Version


def main():
    # The environment is the stack name
    _, environment_name, stack_name = parse_realm_env_name_from_stack()

    # Load environment variables
    load_dot_realm_env(stack_name)

    # Get the config values
    location = getconfig("region", "gcp")
    pulumi.info(f'Using location: {location}')

    cloudrun_max_instance_request_concurrency: int = int(getconfig("max_instance_request_concurrency", "cloudrun"))
    cloudrun_min_instance_count: int = int(getconfig("min_instance_count", "cloudrun"))
    cloudrun_max_instance_count: int = int(getconfig("max_instance_count", "cloudrun"))
    cloudrun_request_timeout: str = str(getconfig("request_timeout", "cloudrun"))
    cloudrun_memory_limit: str = getconfig("memory_limit", "cloudrun")
    cloudrun_cpu_limit: str = str(getconfig("cpu_limit", "cloudrun"))

    api_gateway_timeout: str = str(getconfig("timeout", "api_gateway"))

    # Get stack references
    env_reference = pulumi.StackReference(f"tabiya-tech/compass-environment/{stack_name}")
    docker_repository = getstackref(env_reference, "docker_repository")
    project = getstackref(env_reference, "project_id")
    project_number = getstackref(env_reference, "project_number")
    environment_type = getstackref(env_reference, "environment_type")

    backend_url = getstackref(env_reference, "backend_url")
    frontend_url = getstackref(env_reference, "frontend_url")

    # Get backend service configuration
    backend_service_cfg = BackendServiceConfig(
        taxonomy_mongodb_uri=getenv("TAXONOMY_MONGODB_URI", True),
        taxonomy_database_name=getenv("TAXONOMY_DATABASE_NAME"),
        taxonomy_model_id=getenv("TAXONOMY_MODEL_ID"),
        application_mongodb_uri=getenv("APPLICATION_MONGODB_URI", True),
        application_database_name=getenv("APPLICATION_DATABASE_NAME"),
        metrics_mongodb_uri=getenv("METRICS_MONGODB_URI", True),
        metrics_database_name=getenv("METRICS_DATABASE_NAME"),
        userdata_database_name=getenv("USERDATA_DATABASE_NAME"),
        userdata_mongodb_uri=getenv("USERDATA_MONGODB_URI", True),
        vertex_api_region=getenv("VERTEX_API_REGION", True),
        embeddings_service_name=getenv("EMBEDDINGS_SERVICE_NAME"),
        embeddings_model_name=getenv("EMBEDDINGS_MODEL_NAME"),
        target_environment_name=environment_name,
        target_environment_type=environment_type,
        backend_url=backend_url,
        frontend_url=frontend_url,
        sentry_dsn=getenv("BACKEND_SENTRY_DSN", True, False),
        sentry_config=getenv("BACKEND_SENTRY_CONFIG", True, False),
        enable_sentry=getenv("BACKEND_ENABLE_SENTRY"),
        enable_metrics=getenv("BACKEND_ENABLE_METRICS"),
        default_country_of_user=getenv("DEFAULT_COUNTRY_OF_USER"),
        gcp_oauth_client_id=getenv("GCP_OAUTH_CLIENT_ID"),

        cloudrun_max_instance_request_concurrency=cloudrun_max_instance_request_concurrency,
        cloudrun_min_instance_count=cloudrun_min_instance_count,
        cloudrun_max_instance_count=cloudrun_max_instance_count,
        cloudrun_request_timeout=cloudrun_request_timeout,
        cloudrun_memory_limit=cloudrun_memory_limit,
        cloudrun_cpu_limit=cloudrun_cpu_limit,
        api_gateway_timeout=api_gateway_timeout,

        features=getenv("BACKEND_FEATURES", True, False),
        experience_pipeline_config=getenv("BACKEND_EXPERIENCE_PIPELINE_CONFIG", False, False),
    )

    # version of the artifacts to deploy
    deployable_version = Version(
        git_branch_name=getenv("TARGET_GIT_BRANCH_NAME"),
        git_sha=getenv("TARGET_GIT_SHA")
    )

    # Deploy the backend
    deploy_backend(
        project=project,
        location=location,
        project_number=project_number,
        backend_service_cfg=backend_service_cfg,
        docker_repository=docker_repository,
        deployable_version=deployable_version,
    )


if __name__ == "__main__":
    main()
