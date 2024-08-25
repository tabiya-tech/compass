import base64
import os
from wsgiref.util import application_uri

import pulumi
import pulumi_docker as docker
import pulumi_gcp as gcp
import pulumiverse_time as time
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ProjectBaseConfig:
    project: str
    location: str
    environment: str


GCP_API_GATEWAY_CONFIG_FILE = "./config/gcp_api_gateway_config.yaml"

BASE_SERVICES = [
    # GCP Cloud APIs
    "cloudapis.googleapis.com",
    # GCP Cloud Billing
    "cloudbilling.googleapis.com",
    # Identity And Access Management - needed for creating Service Accounts
    "iam.googleapis.com",
    # GCP Service Control - Required by API Gateway
    "servicecontrol.googleapis.com",
    "servicemanagement.googleapis.com",
]

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


def _get_resource_name(environment: str, resource: str, type=None):
    if not type:
        return f"compass-{environment}-{resource}"

    return f"compass-{environment}-{type}-{resource}"


def _get_file_as_string(file: str):
    return Path(file).read_text()


def _enable_services(basic_config: ProjectBaseConfig) -> list[gcp.projects.Service]:
    # GCP APIs that must be enabled first in order to enable other GCP APIs
    initial_apis = []
    # GCP APIs that are required by the GCP services that Compass uses
    base_services = []
    # These are the actual services Compass requires, including CI/CD, etc.
    enabled_services = []

    # Service Usage API is used for enabling APIs
    # Pulumi cannot enable Service Usage API to a project directly as the Service Usage API
    # must be enabled to enable the API. This is a known limitation of Terraform.
    # The workaround is to have a separate project - here called "root_project" where the 
    # Service Usage API is enabled. We will call the root_project's Service Usage API to
    # enable the Service Usage API of the target project where the Compass will be deployed.

    config = pulumi.Config()
    root_project = config.require("gcp_root_project")

    gcp_provider = gcp.Provider(
        "gcp_provider", project=basic_config.project, billing_project=root_project, user_project_override=True
    )

    service_usage = gcp.projects.Service(
        _get_resource_name(environment=basic_config.environment, type="service", resource="serviceusage"),
        project=basic_config.project,
        service="serviceusage.googleapis.com",
        opts=pulumi.ResourceOptions(provider=gcp_provider, depends_on=[gcp_provider]),
        # Do not disable the service when the resource is destroyed
        # as it requires to disable the dependant services to successfully disable the service.
        # However, disabling the dependant services may render the project unusable.
        # For this reason, it is better to keep the service when the resource is destroyed.
        disable_dependent_services=False,
        disable_on_destroy=False,
    )

    initial_apis.append(service_usage)

    # Cloud Resource Manager must be enabled as second API
    cloud_resource_manager = gcp.projects.Service(
        _get_resource_name(environment=basic_config.environment, type="service", resource="cloudresourcemanager"),
        project=basic_config.project,
        service="cloudresourcemanager.googleapis.com",
        opts=pulumi.ResourceOptions(depends_on=[service_usage]),
        # Do not disable the service when the resource is destroyed
        # as it requires to disable the dependant services to successfully disable the service.
        # However, disabling the dependant services may render the project unusable.
        # For this reason, it is better to keep the service when the resource is destroyed.
        disable_dependent_services=False,
        disable_on_destroy=False,
    )

    initial_apis.append(cloud_resource_manager)

    # Compute API must be the 3rd API to be enabled
    # It takes a while for the compute engine API to be fully enabled. Without the sleep, enabling the other services
    # fail randomly as the compute engine API seems to be still disabled (although the previous step was successful)
    compute = gcp.projects.Service(
        _get_resource_name(environment=basic_config.environment, type="service", resource="compute"),
        project=basic_config.project,
        service="compute.googleapis.com",
        opts=pulumi.ResourceOptions(depends_on=[cloud_resource_manager]),
        # Do not disable the service when the resource is destroyed
        # as it requires to disable the dependant services to successfully disable the service.
        # However, disabling the dependant services may render the project unusable.
        # For this reason, it is better to keep the service when the resource is destroyed.
        disable_dependent_services=False,
        disable_on_destroy=False,
    )

    initial_apis.append(compute)

    sleep_for_a_while = time.Sleep(
        "wait120Seconds", create_duration="120s", opts=pulumi.ResourceOptions(depends_on=initial_apis)
    )

    for service in BASE_SERVICES:
        srv = gcp.projects.Service(
            _get_resource_name(environment=basic_config.environment, type="service", resource=service.split(".")[0]),
            project=basic_config.project,
            service=service,
            # Do not disable the service when the resource is destroyed
            # as it requires to disable the dependant services to successfully disable the service.
            # However, disabling the dependant services may render the project unusable.
            # For this reason, it is better to keep the service when the resource is destroyed.
            disable_dependent_services=False,
            disable_on_destroy=False,
            opts=pulumi.ResourceOptions(depends_on=initial_apis + [sleep_for_a_while]),
        )
        base_services.append(srv)

    opts = pulumi.ResourceOptions(depends_on=base_services + initial_apis)

    # Enable the necessary services
    for service in REQUIRED_SERVICES:
        srv = gcp.projects.Service(
            _get_resource_name(environment=basic_config.environment, type="service", resource=service.split(".")[0]),
            project=basic_config.project,
            service=service,
            opts=opts,
            # Do not disable the service when the resource is destroyed
            # as it requires to disable the dependant services to successfully disable the service.
            # However, disabling the dependant services may render the project unusable.
            # For this reason, it is better to keep the service when the resource is destroyed.
            disable_dependent_services=False,
            disable_on_destroy=False,
        )
        enabled_services.append(srv)

    return initial_apis + base_services + enabled_services


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
                       gcp_oauth_client_id: str,
                       dependencies: list[pulumi.Resource]
                       ):
    apigw_service_account = gcp.serviceaccount.Account(
        resource_name=_get_resource_name(environment=basic_config.environment, resource="api-gateway-sa"),
        # unclear why the resource name is not used here, something to do with account_id constraints? Link to docs?
        account_id=f"compassapigwsrvacct{basic_config.environment.replace('-', '')}",
        project=basic_config.project,
        display_name=f"Compass API Gateway {basic_config.environment} Service Account",
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )

    apigw_api = gcp.apigateway.Api(
        resource_name=_get_resource_name(environment=basic_config.environment, resource="api-gateway-api"),
        api_id=_get_resource_name(environment=basic_config.environment, resource="api-gateway-api"),
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )

    # The GCP API Gateway uses OpenAPI 2.0 yaml files for the configurations.
    # The yaml must be base64 encoded.
    apigw_config_yaml = _get_file_as_string(GCP_API_GATEWAY_CONFIG_FILE)
    apigw_config_yaml = pulumi.Output.format(apigw_config_yaml, basic_config.project, cloudrun.uri, gcp_oauth_client_id)

    apigw_config_yaml_b64encoded = apigw_config_yaml.apply(lambda yaml: base64.b64encode(yaml.encode()).decode())

    apigw_config = gcp.apigateway.ApiConfig(
        resource_name=_get_resource_name(environment=basic_config.environment, resource="api-gateway-config"),
        api=apigw_api.api_id,
        project=basic_config.project,
        openapi_documents=[
            gcp.apigateway.ApiConfigOpenapiDocumentArgs(
                document=gcp.apigateway.ApiConfigOpenapiDocumentDocumentArgs(
                    path=_get_resource_name(environment=basic_config.environment, resource="api-gateway-config.yaml"),
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
        resource_name=_get_resource_name(environment=basic_config.environment, resource="api-gateway"),
        api_config=apigw_config.id,
        display_name=f"Compass API Gateway {basic_config.environment}",
        gateway_id=_get_resource_name(environment=basic_config.environment, resource="api-gateway"),
        project=basic_config.project,
        region=basic_config.location,
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )

    # Only allow access (roles/run.invoker permission) to apigw_service_account
    # This prevents the service from being accessed directly from the internet
    gcp.cloudrun.IamBinding(
        resource_name=_get_resource_name(environment=basic_config.environment, resource="api-gateway-iam-access"),
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


"""
# The gcp.identityplatform cannot be disabled after it has been enabled for a GCP project.
# This code should work when it is run the first time for a new GCP project.
# However, if the pulumi stack is removed (pulumi destroy), this code will fail when the stack is re-created (pulumi up)
# as the identity platform has already been enabled for the project.
# The solution is to import the identity platform configs to the pulumi projects with the following command
# $ pulumi import gcp:identityplatform/config:Config default {{project}}
# where {{project}} is for example auth-poc-422113 or compass-dev-418218.
# After the resource has been imported to the pulumi stack, the code is able to update the configs again.
"""


def _create_repository(
        basic_config: ProjectBaseConfig, repository_name: str, dependencies: list[pulumi.Resource]
) -> gcp.artifactregistry.Repository:
    # Create a repository
    return gcp.artifactregistry.Repository(
        _get_resource_name(environment=basic_config.environment, resource="docker-repository"),
        project=basic_config.project,
        location=basic_config.location,
        format="DOCKER",
        repository_id=repository_name,
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )


def _build_and_push_image(fully_qualified_image_name: str, dependencies: list[pulumi.Resource]) -> docker.Image:
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
    APPLICATION_MONGODB_URI: str
    APPLICATION_DATABASE_NAME: str
    VERTEX_API_REGION: str
    TARGET_ENVIRONMENT: str
    BACKEND_URL: str
    FRONTEND_URL: str


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
        _get_resource_name(environment=basic_config.environment, resource="backend-sa"),
        account_id=_get_resource_name(environment=basic_config.environment, resource="backend-sa"),
        display_name="The dedicated service account for the Compass backend service",
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )

    # Assign the necessary roles to the service account for Vertex AI access
    gcp.projects.IAMBinding(
        _get_resource_name(environment=basic_config.environment, resource="ai-user-binding"),
        members=[service_account.email.apply(lambda email: f"serviceAccount:{email}")],
        role="roles/aiplatform.user",
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies),
    )

    # Deploy cloud run service

    service = gcp.cloudrunv2.Service(
        _get_resource_name(environment=basic_config.environment, resource="cloudrun-service"),
        name=_get_resource_name(environment=basic_config.environment, resource="cloudrun-service"),
        project=basic_config.project,
        location=basic_config.location,
        ingress="INGRESS_TRAFFIC_ALL",
        template=gcp.cloudrunv2.ServiceTemplateArgs(
            scaling=gcp.cloudrunv2.ServiceTemplateScalingArgs(
                min_instance_count=1,
                max_instance_count=1,
            ),
            containers=[
                gcp.cloudrunv2.ServiceTemplateContainerArgs(
                    image=fully_qualified_image_name,
                    envs=[
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="TAXONOMY_MONGODB_URI",
                                                                       value=backend_env_vars_cfg.TAXONOMY_MONGODB_URI),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="TAXONOMY_DATABASE_NAME",
                                                                       value=backend_env_vars_cfg.TAXONOMY_DATABASE_NAME),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="APPLICATION_MONGODB_URI",
                                                                       value=backend_env_vars_cfg.APPLICATION_MONGODB_URI),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="APPLICATION_DATABASE_NAME",
                                                                       value=backend_env_vars_cfg.APPLICATION_DATABASE_NAME),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="VERTEX_API_REGION",
                                                                       value=backend_env_vars_cfg.VERTEX_API_REGION),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="TARGET_ENVIRONMENT",
                                                                       value=backend_env_vars_cfg.TARGET_ENVIRONMENT),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="BACKEND_URL",
                                                                       value=backend_env_vars_cfg.BACKEND_URL),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(name="FRONTEND_URL",
                                                                       value=backend_env_vars_cfg.FRONTEND_URL),

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

    application_mongodb_uri = os.getenv("APPLICATION_MONGODB_URI")
    if not application_mongodb_uri:
        raise ValueError("APPLICATION_MONGODB_URI environment variable is not set")

    application_database_name = os.getenv("APPLICATION_DATABASE_NAME")
    if not application_database_name:
        raise ValueError("APPLICATION_DATABASE_NAME environment variable is not set")

    vertex_api_region = os.getenv("VERTEX_API_REGION")
    if not vertex_api_region:
        raise ValueError("VERTEX_API_REGION environment variable is not set")

    frontend_url = os.getenv("FRONTEND_URL")
    if not frontend_url:
        raise ValueError("FRONTEND_URL environment variable is not set")

    backend_url = os.getenv("BACKEND_URL")
    if not backend_url:
        raise ValueError("BACKEND_URL environment variable is not set")

    return BackendEnvVarsConfig(
        TAXONOMY_MONGODB_URI=taxonomy_mongodb_uri,
        TAXONOMY_DATABASE_NAME=taxonomy_database_name,
        APPLICATION_MONGODB_URI=application_mongodb_uri,
        APPLICATION_DATABASE_NAME=application_database_name,
        VERTEX_API_REGION=vertex_api_region,
        TARGET_ENVIRONMENT=environment,
        BACKEND_URL=backend_url,
        FRONTEND_URL=frontend_url,
    )


# export a function build_and_push_image that will be used in the main pulumi program
def deploy_backend(project: str, location: str, environment: str):
    basic_config = ProjectBaseConfig(project=project, location=location, environment=environment)

    # Enable the necessary services for building and pushing the image
    services = _enable_services(basic_config=basic_config)

    repository_name = _get_resource_name(environment=environment, resource="docker-repository")
    image_name = _get_resource_name(environment=environment, resource="backend")

    # Create an artifact repository
    repository = _create_repository(basic_config, repository_name, services)

    # Build and push image to gcr repository
    fully_qualified_image_name = _get_fully_qualified_image_name(basic_config, repository_name, image_name)
    image = _build_and_push_image(fully_qualified_image_name, [repository])

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
        gcp_oauth_client_id=os.getenv("GCP_OAUTH_CLIENT_ID"),
        dependencies=services + [cloud_run]
    )
