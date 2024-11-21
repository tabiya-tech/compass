import base64
import os

import pulumi
import pulumi_docker as docker
import pulumi_gcp as gcp
from dataclasses import dataclass

from lib.std_pulumi import get_resource_name, ProjectBaseConfig, get_project_base_config, get_file_as_string, enable_services

GCP_API_GATEWAY_CONFIG_FILE = "./config/gcp_api_gateway_config.yaml"

REQUIRED_SERVICES = [
    # Required for VertexAI see https://cloud.google.com/vertex-ai/docs/start/cloud-environment
    "aiplatform.googleapis.com",
    # GCP API Gateway
    "apigateway.googleapis.com",
    # Docker image registry
    "artifactregistry.googleapis.com",
    # GCP Cloud Build
    "cloudbuild.googleapis.com",
    # Cloud Data Loss Prevention - Required for de-identifying data
    "dlp.googleapis.com",
    # GCP Cloud Run
    "run.googleapis.com",
]

"""
# Set up GCP API Gateway.
# The API Gateway will route the requests to the Compass Cloudrun instance. Additionally, it will verify the incoming JWT tokens
# and add a new header x-apigateway-api-userinfo that will contain the JWT claims.
# The Compass Cloudrun instance is publicly accessible over internet, otherwise it cannot be behind API Gateway.
# To prevent direct calls to the Compass Cloudrun instance, the Cloudrun instance will require GCP IAM based authentication.
# A service account with 'roles/run.invoker' permission is created for the API Gateway which will allow it to call the Cloudrun instance.
"""


def _setup_api_gateway(*,
                       basic_config: ProjectBaseConfig,
                       cloudrun: gcp.cloudrunv2.Service,
                       dependencies: list[pulumi.Resource]
                       ):
    apigw_service_account = gcp.serviceaccount.Account(
        resource_name=get_resource_name(environment=basic_config.environment, resource="api-gateway-sa"),
        # unclear why the resource name is not used here, something to do with account_id constraints? Link to docs?
        account_id=f"compassapigwsrvacct{basic_config.environment.replace('-', '')}",
        project=basic_config.project,
        display_name=f"Compass API Gateway {basic_config.environment} Service Account",
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )

    apigw_api = gcp.apigateway.Api(
        resource_name=get_resource_name(environment=basic_config.environment, resource="api-gateway-api"),
        api_id=get_resource_name(environment=basic_config.environment, resource="api-gateway-api"),
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )

    # The GCP API Gateway uses OpenAPI 2.0 yaml files for the configurations.
    # The yaml must be base64 encoded.
    apigw_config_yml_string = get_file_as_string(GCP_API_GATEWAY_CONFIG_FILE)

    # update the yaml with the correct values
    # we are not using pulumi.Output.format because with path variables they are encapsulated in {}
    # which causes issues with pulumi.Output.format to throw because we want to keep them as {path variable}.
    apigw_config_yaml = pulumi.Output.all(basic_config.project, cloudrun.uri).apply(
        lambda args:
        apigw_config_yml_string
        # project ID
        .replace('__PROJECT_ID__', args[0])

        # cloud run uri
        .replace('__BACKEND_URI__', args[1])
    )

    apigw_config_yaml_b64encoded = apigw_config_yaml.apply(lambda yaml: base64.b64encode(yaml.encode()).decode())

    apigw_config = gcp.apigateway.ApiConfig(
        resource_name=get_resource_name(environment=basic_config.environment, resource="api-gateway-config"),
        api=apigw_api.api_id,
        project=basic_config.project,
        openapi_documents=[
            gcp.apigateway.ApiConfigOpenapiDocumentArgs(
                document=gcp.apigateway.ApiConfigOpenapiDocumentDocumentArgs(
                    path=get_resource_name(environment=basic_config.environment, resource="api-gateway-config.yaml"),
                    contents=apigw_config_yaml_b64encoded,
                ),
            )
        ],
        gateway_config=gcp.apigateway.ApiConfigGatewayConfigArgs(
            backend_config=gcp.apigateway.ApiConfigGatewayConfigBackendConfigArgs(
                google_service_account=apigw_service_account.email
            )
        ),
    )

    apigw_gateway = gcp.apigateway.Gateway(
        resource_name=get_resource_name(environment=basic_config.environment, resource="api-gateway"),
        api_config=apigw_config.id,
        display_name=f"Compass API Gateway {basic_config.environment}",
        gateway_id=get_resource_name(environment=basic_config.environment, resource="api-gateway"),
        project=basic_config.project,
        region=basic_config.location,
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )

    # Only allow access (roles/run.invoker permission) to apigw_service_account
    # This prevents the service from being accessed directly from the internet
    gcp.cloudrun.IamBinding(
        resource_name=get_resource_name(environment=basic_config.environment, resource="api-gateway-iam-access"),
        project=basic_config.project,
        location=basic_config.location,
        service=cloudrun.name,
        role="roles/run.invoker",
        members=[apigw_service_account.email.apply(lambda email: f"serviceAccount:{email}")],
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )

    pulumi.export("apigateway_url", apigw_gateway.default_hostname.apply(lambda hostname: f"https://{hostname}"))
    pulumi.export("apigateway_id", apigw_gateway.gateway_id)
    return apigw_gateway


def _create_repository(
        basic_config: ProjectBaseConfig, repository_name: str, dependencies: list[pulumi.Resource]
) -> gcp.artifactregistry.Repository:
    # Create a repository
    return gcp.artifactregistry.Repository(
        get_resource_name(environment=basic_config.environment, resource="docker-repository"),
        project=basic_config.project,
        location=basic_config.location,
        format="DOCKER",
        repository_id=repository_name,
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )


def _build_and_push_image(fully_qualified_image_name: str, dependencies: list[pulumi.Resource], _provider: pulumi.ProviderResource) -> docker.Image:
    # Build and push image to gcr repository
    image = docker.Image(
        "compass-image",
        image_name=fully_qualified_image_name,
        build=docker.DockerBuildArgs(context="../../backend", platform="linux/amd64"),
        registry=None,  # use gcloud for authentication.
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )

    # Digest exported so it's easy to match updates happening in cloud run project
    pulumi.export("digest", image.image_name)
    return image


def _get_fully_qualified_image_name(basic_config: ProjectBaseConfig, repository_name: str, image_name: str):
    label = os.getenv("GITHUB_SHA")
    return f"{basic_config.location}-docker.pkg.dev/{basic_config.project}/{repository_name}/{image_name}:{label}"


# Deploy cloud run service

@dataclass
class BackendEnvVarsConfig:
    """
    Environment variables for the backend service
    See the backend service for more information on the environment variables
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


# See https://cloud.google.com/run/docs/overview/what-is-cloud-run for more information
def _deploy_cloud_run_service(
        *,
        basic_config: ProjectBaseConfig,
        fully_qualified_image_name: str,
        backend_env_vars_cfg: BackendEnvVarsConfig,
        dependencies: list[pulumi.Resource],
):
    # See https://cloud.google.com/run/docs/securing/service-identity#per-service-identity for more information
    # Create a service account for the Cloud Run service
    service_account = gcp.serviceaccount.Account(
        get_resource_name(environment=basic_config.environment, resource="backend-sa"),
        account_id=get_resource_name(environment=basic_config.environment, resource="backend-sa"),
        display_name="The dedicated service account for the Compass backend service",
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )

    # Assign the necessary roles to the service account for Vertex AI access
    gcp.projects.IAMBinding(
        get_resource_name(environment=basic_config.environment, resource="ai-user-binding"),
        members=[service_account.email.apply(lambda email: f"serviceAccount:{email}")],
        role="roles/aiplatform.user",
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )

    # Deploy cloud run service

    service = gcp.cloudrunv2.Service(
        get_resource_name(environment=basic_config.environment, resource="cloudrun-service"),
        name=get_resource_name(environment=basic_config.environment, resource="cloudrun-service"),
        project=basic_config.project,
        location=basic_config.location,
        ingress="INGRESS_TRAFFIC_ALL",
        template=gcp.cloudrunv2.ServiceTemplateArgs(
            max_instance_request_concurrency=10,  # Set max concurrency per instance
            execution_environment='EXECUTION_ENVIRONMENT_GEN2',  # Set the execution environment to second generation
            scaling=gcp.cloudrunv2.ServiceTemplateScalingArgs(
                min_instance_count=2,
                max_instance_count=10,
            ),
            containers=[
                gcp.cloudrunv2.ServiceTemplateContainerArgs(
                    resources=gcp.cloudrunv2.ServiceTemplateContainerResourcesArgs(
                        limits={
                            'memory': '1Gi',  # Set memory limit to 1 GB
                            'cpu': '2',  # Set CPU limit to 2
                        },
                    ),
                    image=fully_qualified_image_name,
                    envs=[
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="TAXONOMY_MONGODB_URI",
                                                                       value=backend_env_vars_cfg.TAXONOMY_MONGODB_URI),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="TAXONOMY_DATABASE_NAME",
                                                                       value=backend_env_vars_cfg.TAXONOMY_DATABASE_NAME),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="TAXONOMY_MODEL_ID",
                                                                       value=backend_env_vars_cfg.TAXONOMY_MODEL_ID),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="APPLICATION_MONGODB_URI",
                                                                       value=backend_env_vars_cfg.APPLICATION_MONGODB_URI),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="APPLICATION_DATABASE_NAME",
                                                                       value=backend_env_vars_cfg.APPLICATION_DATABASE_NAME),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="USERDATA_MONGODB_URI",
                                                                       value=backend_env_vars_cfg.USERDATA_MONGODB_URI),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="USERDATA_DATABASE_NAME",
                                                                       value=backend_env_vars_cfg.USERDATA_DATABASE_NAME),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="VERTEX_API_REGION",
                                                                       value=backend_env_vars_cfg.VERTEX_API_REGION),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="TARGET_ENVIRONMENT",
                                                                       value=backend_env_vars_cfg.TARGET_ENVIRONMENT),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="BACKEND_URL",
                                                                       value=backend_env_vars_cfg.BACKEND_URL),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="FRONTEND_URL",
                                                                       value=backend_env_vars_cfg.FRONTEND_URL),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="SENTRY_BACKEND_DSN",
                                                                       value=backend_env_vars_cfg.SENTRY_BACKEND_DSN),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="ENABLE_SENTRY",
                                                                          value=backend_env_vars_cfg.ENABLE_SENTRY),

                        # Add more environment variables here
                    ],
                )
            ],
            service_account=service_account.email,
        ),
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )
    pulumi.export("cloud_run_url", service.uri)
    return service


def _get_backend_env_vars(environment: str):
    taxonomy_mongodb_uri = os.getenv("TAXONOMY_MONGODB_URI")
    if not taxonomy_mongodb_uri:
        raise ValueError("TAXONOMY_MONGODB_URI environment variable is not set")

    taxonomy_database_name = os.getenv("TAXONOMY_DATABASE_NAME")
    if not taxonomy_database_name:
        raise ValueError("TAXONOMY_DATABASE_NAME environment variable is not set")

    taxonomy_model_id = os.getenv("TAXONOMY_MODEL_ID")
    if not taxonomy_model_id:
        raise ValueError("TAXONOMY_MODEL_ID environment variable is not set")

    application_mongodb_uri = os.getenv("APPLICATION_MONGODB_URI")
    if not application_mongodb_uri:
        raise ValueError("APPLICATION_MONGODB_URI environment variable is not set")

    application_database_name = os.getenv("APPLICATION_DATABASE_NAME")
    if not application_database_name:
        raise ValueError("APPLICATION_DATABASE_NAME environment variable is not set")

    userdata_mongodb_uri = os.getenv("USERDATA_MONGODB_URI")
    if not userdata_mongodb_uri:
        raise ValueError("USERDATA_MONGODB_URI environment variable is not set")

    userdata_database_name = os.getenv("USERDATA_DATABASE_NAME")
    if not userdata_database_name:
        raise ValueError("USERDATA_DATABASE_NAME environment variable is not set")

    vertex_api_region = os.getenv("VERTEX_API_REGION")
    if not vertex_api_region:
        raise ValueError("VERTEX_API_REGION environment variable is not set")

    frontend_url = os.getenv("FRONTEND_URL")
    if not frontend_url:
        raise ValueError("FRONTEND_URL environment variable is not set")

    backend_url = os.getenv("BACKEND_URL")
    if not backend_url:
        raise ValueError("BACKEND_URL environment variable is not set")

    sentry_backend_dsn = os.getenv("SENTRY_BACKEND_DSN")
    if not sentry_backend_dsn:
        raise ValueError("SENTRY_BACKEND_DSN environment variable is not set")

    enable_sentry = os.getenv("ENABLE_SENTRY")
    if not enable_sentry:
        raise ValueError("ENABLE_SENTRY environment variable is not set")

    return BackendEnvVarsConfig(
        TAXONOMY_MONGODB_URI=taxonomy_mongodb_uri,
        TAXONOMY_DATABASE_NAME=taxonomy_database_name,
        TAXONOMY_MODEL_ID=taxonomy_model_id,
        APPLICATION_MONGODB_URI=application_mongodb_uri,
        APPLICATION_DATABASE_NAME=application_database_name,
        USERDATA_MONGODB_URI=userdata_mongodb_uri,
        USERDATA_DATABASE_NAME=userdata_database_name,
        VERTEX_API_REGION=vertex_api_region,
        TARGET_ENVIRONMENT=environment,
        BACKEND_URL=backend_url,
        FRONTEND_URL=frontend_url,
        SENTRY_BACKEND_DSN=sentry_backend_dsn,
        ENABLE_SENTRY=enable_sentry
    )


# export a function build_and_push_image that will be used in the main pulumi program
def deploy_backend(project: str, location: str, environment: str):

    basic_config = get_project_base_config(project=project, location=location, environment=environment)

    # Enable the necessary services for building and pushing the image
    services = enable_services(basic_config=basic_config, service_names=REQUIRED_SERVICES)

    repository_name = get_resource_name(environment=environment, resource="docker-repository")
    image_name = get_resource_name(environment=environment, resource="backend")

    # Create an artifact repository
    repository = _create_repository(basic_config, repository_name, services)

    # Build and push image to gcr repository
    fully_qualified_image_name = _get_fully_qualified_image_name(basic_config, repository_name, image_name)
    image = _build_and_push_image(fully_qualified_image_name, [repository], basic_config.provider)

    # Deploy the image as a cloud run service
    cloud_run = _deploy_cloud_run_service(
        basic_config=basic_config,
        fully_qualified_image_name=fully_qualified_image_name,
        backend_env_vars_cfg=_get_backend_env_vars(environment),
        dependencies=services + [image],
    )

    api_gateway = _setup_api_gateway(
        basic_config=basic_config,
        cloudrun=cloud_run,
        dependencies=services + [cloud_run]
    )
