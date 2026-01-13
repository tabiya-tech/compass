import base64
from dataclasses import dataclass
from typing import Optional

import pulumi
import pulumi_gcp as gcp

from pulumi import Output

from backend._construct_api_gateway_cfg import construct_api_gateway_cfg
from lib import ProjectBaseConfig, get_resource_name, get_project_base_config, Version
from scripts.formatters import construct_docker_tag
from backend.cv_bucket import _create_cv_upload_bucket, _grant_cloud_run_sa_access_to_cv_bucket

api_gateway_config_file_name = "api_gateway_config.yaml"


@dataclass(frozen=True)
class BackendServiceConfig:
    """
    Environment variables for the backend service
    See the backend service for more information on the environment variables.
    """
    taxonomy_mongodb_uri: str
    taxonomy_database_name: str
    taxonomy_model_id: str
    application_mongodb_uri: str
    application_database_name: str
    metrics_mongodb_uri: str
    metrics_database_name: str
    userdata_mongodb_uri: str
    userdata_database_name: str
    vertex_api_region: str
    embeddings_service_name: str
    embeddings_model_name: str
    target_environment_name: str
    target_environment_type: str | pulumi.Output[str]
    backend_url: str | pulumi.Output[str]
    frontend_url: str | pulumi.Output[str]
    sentry_dsn: str
    sentry_config: Optional[str]
    enable_sentry: str
    enable_metrics: str
    supported_languages: str
    default_country_of_user: str
    gcp_oauth_client_id: str
    cloudrun_max_instance_request_concurrency: int
    cloudrun_min_instance_count: int
    cloudrun_max_instance_count: int
    cloudrun_request_timeout: str
    cloudrun_memory_limit: str
    cloudrun_cpu_limit: str
    api_gateway_timeout: str
    features: Optional[str]
    experience_pipeline_config: Optional[str]
    cv_max_uploads_per_user: Optional[str]
    cv_rate_limit_per_minute: Optional[str]
    sec_token: Optional[str]
    default_locale: str


"""
# Set up GCP API Gateway.
# The API Gateway will route the requests to the Brújula Cloudrun instance. Additionally, it will verify the incoming 
# JWT tokens and add a new header x-apigateway-api-userinfo that will contain the JWT claims.
# The Brújula Cloudrun instance is publicly accessible over internet, otherwise it cannot be behind API Gateway.
# To prevent direct calls to the Brújula Cloudrun instance, the Cloudrun instance will require GCP IAM based 
# authentication. A service account with 'roles/run.invoker' permission is created for the API Gateway 
# which will allow it to call the Cloudrun instance.
"""


def _setup_api_gateway(*,
                       basic_config: ProjectBaseConfig,
                       cloudrun: gcp.cloudrunv2.Service,
                       backend_service_cfg: BackendServiceConfig,
                       dependencies: list[pulumi.Resource],
                       artifacts_version: Version):
    apigw_service_account = gcp.serviceaccount.Account(
        resource_name=get_resource_name(resource="api-gateway", resource_type="sa"),
        account_id="api-gateway-sa",
        project=basic_config.project,
        display_name="API Gateway Service Account",
        create_ignore_already_exists=True,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    apigw_api = gcp.apigateway.Api(
        resource_name=get_resource_name(resource="api-gateway", resource_type="api"),
        api_id="backend-api-gateway-api",
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    # The GCP API Gateway uses OpenAPI 2.0 yaml files for the configurations.
    # The yaml must be base64 encoded.
    apigw_config_yml_string = cloudrun.uri.apply(
        lambda cloudrun_url: construct_api_gateway_cfg(cloud_run_url=cloudrun_url,
                                                       expected_version=artifacts_version))

    # update the yaml with the correct values
    # we are not using pulumi.Output.format because with path variables they are encapsulated in {}
    # which causes issues with pulumi.Output.format to throw because we want to keep them as {path variable}.
    apigw_config_yaml = pulumi.Output.all(basic_config.project, cloudrun.uri, apigw_config_yml_string).apply(
        lambda args:
        args[2]
        # project ID
        .replace('__PROJECT_ID__', args[0])

        # cloud run uri
        .replace('__BACKEND_URI__', args[1])

        # replace the backend api gateway timeout.
        .replace("__API_GATEWAY_TIMEOUT__", backend_service_cfg.api_gateway_timeout)

        # replace the environment name in the api gateway config
        .replace("__ENVIRONMENT_NAME__", backend_service_cfg.target_environment_name)
    )

    apigw_config_yaml_b64encoded = apigw_config_yaml.apply(lambda yaml: base64.b64encode(yaml.encode()).decode())

    apigw_config = gcp.apigateway.ApiConfig(
        resource_name=get_resource_name(resource="api-gateway", resource_type="api-config"),
        api=apigw_api.api_id,
        project=basic_config.project,
        openapi_documents=[
            gcp.apigateway.ApiConfigOpenapiDocumentArgs(
                document=gcp.apigateway.ApiConfigOpenapiDocumentDocumentArgs(
                    # this is the file name used in the API Gateway
                    # This is typically the path of the file when it is uploaded.
                    path=api_gateway_config_file_name,
                    contents=apigw_config_yaml_b64encoded,
                ),
            )
        ],
        gateway_config=gcp.apigateway.ApiConfigGatewayConfigArgs(
            backend_config=gcp.apigateway.ApiConfigGatewayConfigBackendConfigArgs(
                google_service_account=apigw_service_account.email
            )
        ),
        opts=pulumi.ResourceOptions(provider=basic_config.provider)
    )

    api_gateway = gcp.apigateway.Gateway(
        resource_name=get_resource_name(resource="api-gateway"),
        api_config=apigw_config.id,
        display_name="Backend API Gateway",
        gateway_id="backend-api-gateway",
        project=basic_config.project,
        region=basic_config.location,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    # Only allow access (roles/run.invoker permission) to apigw_service_account
    # This prevents the service from being accessed directly from the internet
    gcp.cloudrun.IamMember(
        resource_name=get_resource_name(resource="api-gateway-sa", resource_type="iam-member"),
        project=basic_config.project,
        location=basic_config.location,
        service=cloudrun.name,
        role="roles/run.invoker",
        member=apigw_service_account.email.apply(lambda email: f"serviceAccount:{email}"),
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )
    # Enable the private service access for the API Gateway
    gcp.projects.Service(
        get_resource_name(resource="compass-backend-api", resource_type="service"),
        project=basic_config.project,
        service=apigw_api.managed_service,
        opts=pulumi.ResourceOptions(depends_on=[api_gateway], provider=basic_config.provider)
    )

    pulumi.export("apigateway_url", api_gateway.default_hostname.apply(lambda hostname: f"https://{hostname}"))
    pulumi.export("apigateway_id", api_gateway.gateway_id)
    return api_gateway


def _grant_docker_repository_access_to_project_service_account(
        basic_config: ProjectBaseConfig,
        project_number: pulumi.Output[str],
        docker_project_id: pulumi.Output[str],
        docker_repository_name: pulumi.Output[str],
) -> gcp.artifactregistry.RepositoryIamMember:
    # allow the current environment to read from the docker repository
    return gcp.artifactregistry.RepositoryIamMember(
        resource_name=get_resource_name(resource="project-sa-repository-reader", resource_type="iam-member"),
        project=docker_project_id,
        location=basic_config.location,
        repository=docker_repository_name,
        role="roles/artifactregistry.reader",
        member=project_number.apply(
            lambda _project_number:
            f"serviceAccount:service-{_project_number}@serverless-robot-prod.iam.gserviceaccount.com"),
        opts=pulumi.ResourceOptions(provider=basic_config.provider),
    )


def _get_fully_qualified_image_name(
        docker_repository: pulumi.Output[gcp.artifactregistry.Repository],
        tag: str
) -> pulumi.Output[str]:

    def _get_self_link(repository_info):
        # Get the latest docker image with this tag.
        # Given the actual tag may be assigned to another image, we need to get the latest image with this tag.
        # The `self_link` is the fully qualified image name. with the sha.
        # ref: https://www.pulumi.com/registry/packages/gcp/api-docs/artifactregistry/getdockerimage/#self_link_python
        repository_project_id = repository_info.get("project")
        repository_location = repository_info.get("location")
        repository_name = repository_info.get("name")

        image = gcp.artifactregistry.get_docker_image(
            image_name=f"backend:{tag}",
            location=repository_location,
            # The last part of the repository name to fetch from.
            # see: https://www.pulumi.com/registry/packages/gcp/api-docs/artifactregistry/getdockerimage/#repository_id_python
            # we are using the repository.get("name") to get the repository name because it is the one that returns the last part.
            # Using repository.get("id") would return the full name of the repository.
            repository_id=repository_name,
            project=repository_project_id
        )

        pulumi.info("Deploying image with the link: "+ image.self_link)

        return image.self_link

    return docker_repository.apply(_get_self_link)


# Deploy cloud run service
# See https://cloud.google.com/run/docs/overview/what-is-cloud-run for more information
def _deploy_cloud_run_service(
        *,
        basic_config: ProjectBaseConfig,
        fully_qualified_image_name: Output[str],
        backend_service_cfg: BackendServiceConfig,
        dependencies: list[pulumi.Resource],
        cv_bucket_name: Output[str],
):
    # See https://cloud.google.com/run/docs/securing/service-identity#per-service-identity for more information
    # Create a service account for the Cloud Run service
    service_account = gcp.serviceaccount.Account(
        get_resource_name(resource="backend", resource_type="sa"),

        account_id="backend-sa",
        display_name="The dedicated service account for the Brújula backend service",
        create_ignore_already_exists=True,
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    # Assign the necessary roles to the service account for Vertex AI access.
    iam_member = gcp.projects.IAMMember(
        get_resource_name(resource="backend-sa", resource_type="ai-user-binding"),
        member=service_account.email.apply(lambda email: f"serviceAccount:{email}"),
        role="roles/aiplatform.user",
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies + [service_account], provider=basic_config.provider),
    )

    # Deploy cloud run service
    service = gcp.cloudrunv2.Service(
        get_resource_name(resource="cloudrun", resource_type="service"),
        name="cloudrun-service",
        project=basic_config.project,
        location=basic_config.location,
        ingress="INGRESS_TRAFFIC_ALL",
        template=gcp.cloudrunv2.ServiceTemplateArgs(
            # Set max concurrency per instance
            max_instance_request_concurrency=backend_service_cfg.cloudrun_max_instance_request_concurrency,
            timeout=backend_service_cfg.cloudrun_request_timeout,
            execution_environment='EXECUTION_ENVIRONMENT_GEN2',  # Set the execution environment to second generation
            scaling=gcp.cloudrunv2.ServiceTemplateScalingArgs(
                min_instance_count=backend_service_cfg.cloudrun_min_instance_count,
                max_instance_count=backend_service_cfg.cloudrun_max_instance_count,
            ),
            containers=[
                gcp.cloudrunv2.ServiceTemplateContainerArgs(
                    resources=gcp.cloudrunv2.ServiceTemplateContainerResourcesArgs(
                        limits={
                            'memory': backend_service_cfg.cloudrun_memory_limit,
                            'cpu': backend_service_cfg.cloudrun_cpu_limit,
                        },
                    ),
                    image=fully_qualified_image_name,
                    envs=[
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="TAXONOMY_MONGODB_URI",
                            value=backend_service_cfg.taxonomy_mongodb_uri),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="TAXONOMY_DATABASE_NAME",
                            value=backend_service_cfg.taxonomy_database_name),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="TAXONOMY_MODEL_ID",
                            value=backend_service_cfg.taxonomy_model_id),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="APPLICATION_MONGODB_URI",
                            value=backend_service_cfg.application_mongodb_uri),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="APPLICATION_DATABASE_NAME",
                            value=backend_service_cfg.application_database_name),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="METRICS_MONGODB_URI",
                            value=backend_service_cfg.metrics_mongodb_uri),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="METRICS_DATABASE_NAME",
                            value=backend_service_cfg.metrics_database_name),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="USERDATA_MONGODB_URI",
                            value=backend_service_cfg.userdata_mongodb_uri),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="USERDATA_DATABASE_NAME",
                            value=backend_service_cfg.userdata_database_name),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="VERTEX_API_REGION",
                            value=backend_service_cfg.vertex_api_region),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="EMBEDDINGS_SERVICE_NAME",
                            value=backend_service_cfg.embeddings_service_name),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="EMBEDDINGS_MODEL_NAME",
                            value=backend_service_cfg.embeddings_model_name),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="TARGET_ENVIRONMENT_NAME",
                            value=backend_service_cfg.target_environment_name),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="TARGET_ENVIRONMENT_TYPE",
                            value=backend_service_cfg.target_environment_type),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="BACKEND_URL",
                            value=backend_service_cfg.backend_url),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="FRONTEND_URL",
                            value=backend_service_cfg.frontend_url),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="BACKEND_SENTRY_DSN",
                            value=backend_service_cfg.sentry_dsn),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="BACKEND_SENTRY_CONFIG",
                            value=backend_service_cfg.sentry_config),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="BACKEND_ENABLE_SENTRY",
                            value=backend_service_cfg.enable_sentry),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="BACKEND_ENABLE_METRICS",
                            value=backend_service_cfg.enable_metrics),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="DEFAULT_COUNTRY_OF_USER",
                            value=backend_service_cfg.default_country_of_user),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="BACKEND_FEATURES",
                            value=backend_service_cfg.features),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="BACKEND_EXPERIENCE_PIPELINE_CONFIG",
                            value=backend_service_cfg.experience_pipeline_config),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="BACKEND_CV_STORAGE_BUCKET",
                            value=cv_bucket_name,
                        ),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="BACKEND_CV_MAX_UPLOADS_PER_USER",
                            value=backend_service_cfg.cv_max_uploads_per_user),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="BACKEND_CV_RATE_LIMIT_PER_MINUTE",
                            value=backend_service_cfg.cv_rate_limit_per_minute),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="SEC_TOKEN",
                            value=backend_service_cfg.sec_token),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="BACKEND_DEFAULT_LOCALE",
                            value=backend_service_cfg.default_locale),
                        gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                            name="BACKEND_SUPPORTED_LANGUAGES",
                            value=backend_service_cfg.supported_languages)
                        # Add more environment variables here
                    ],
                )
            ],
            service_account=service_account.email,
        ),
        opts=pulumi.ResourceOptions(depends_on=dependencies + [iam_member], provider=basic_config.provider),
    )
    pulumi.export("cloud_run_url", service.uri)
    return service, service_account


# export a function build_and_push_image that will be used in the main pulumi program
def deploy_backend(
        *,
        location: str,
        project: str | Output[str],
        project_number: Output[str],
        backend_service_cfg: BackendServiceConfig,
        docker_repository: pulumi.Output[gcp.artifactregistry.Repository],
        deployable_version: Version,
):
    """
    Deploy the backend infrastructure
    """
    basic_config = get_project_base_config(project=project, location=location)
    docker_tag = construct_docker_tag(
        git_branch_name=deployable_version.git_branch_name,
        git_sha=deployable_version.git_sha
    )

    # grant the project service account access to the docker repository so that it can pull images
    membership = _grant_docker_repository_access_to_project_service_account(
        basic_config,
        project_number,
        docker_repository.apply(lambda repo: repo.get("project")),
        docker_repository.apply(lambda repo: repo.get("name"))
    )

    # get fully qualified image name
    fully_qualified_image_name = _get_fully_qualified_image_name(
        docker_repository=docker_repository,
        tag=docker_tag
    )

    # Create a private GCS bucket for CV uploads using helper
    cv_bucket = _create_cv_upload_bucket(basic_config=basic_config)

    # Deploy the image as a cloud run service
    cloud_run, cloud_run_sa = _deploy_cloud_run_service(
        basic_config=basic_config,
        fully_qualified_image_name=fully_qualified_image_name,
        backend_service_cfg=backend_service_cfg,
        dependencies=[membership, cv_bucket],
        cv_bucket_name=cv_bucket.name,
    )

    # Grant Cloud Run service account access to the bucket
    _grant_cloud_run_sa_access_to_cv_bucket(
        basic_config=basic_config,
        bucket=cv_bucket,
        service_account=cloud_run_sa,
    )

    _api_gateway = _setup_api_gateway(
        basic_config=basic_config,
        cloudrun=cloud_run,
        artifacts_version=deployable_version,
        backend_service_cfg=backend_service_cfg,
        dependencies=[cloud_run]
    )
