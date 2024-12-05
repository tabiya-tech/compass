import base64

import pulumi
import pulumi_docker as docker
import pulumi_gcp as gcp

from pulumi import Output

from lib.std_pulumi import ProjectBaseConfig, get_resource_name, get_project_base_config, get_file_as_string

from __main__ import BackendEnvVarsConfig

GCP_API_GATEWAY_CONFIG_FILE = "./config/gcp_api_gateway_config.yaml"


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
        resource_name=get_resource_name(resource="api-gateway", resource_type="sa"),
        # unclear why the resource name is not used here, something to do with account_id constraints? Link to docs?
        account_id=f"compassapigwsrvacct{basic_config.environment.replace('-', '')}",
        project=basic_config.project,
        display_name=f"Compass API Gateway {basic_config.environment} Service Account",
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
    apigw_config_yaml = get_file_as_string(GCP_API_GATEWAY_CONFIG_FILE)
    apigw_config_yaml = pulumi.Output.format(apigw_config_yaml, basic_config.project, cloudrun.uri, gcp_oauth_client_id)

    apigw_config_yaml_b64encoded = apigw_config_yaml.apply(lambda yaml: base64.b64encode(yaml.encode()).decode())

    apigw_config = gcp.apigateway.ApiConfig(
        resource_name=get_resource_name(resource="api-gateway", resource_type="api-config"),
        api=apigw_api.api_id,
        project=basic_config.project,
        openapi_documents=[
            gcp.apigateway.ApiConfigOpenapiDocumentArgs(
                document=gcp.apigateway.ApiConfigOpenapiDocumentDocumentArgs(
                    path=get_resource_name(resource="api-gateway", resource_type="config.yaml"),
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
        display_name=f"Compass API Gateway {basic_config.environment}",
        gateway_id="backend-api-gateway",
        project=basic_config.project,
        region=basic_config.location,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    # Only allow access (roles/run.invoker permission) to apigw_service_account
    # This prevents the service from being accessed directly from the internet
    gcp.cloudrun.IamBinding(
        resource_name=get_resource_name(resource="api-gateway-sa", resource_type="iam-binding"),
        project=basic_config.project,
        location=basic_config.location,
        service=cloudrun.name,
        role="roles/run.invoker",
        members=[apigw_service_account.email.apply(lambda email: f"serviceAccount:{email}")],
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    pulumi.export("apigateway_url", api_gateway.default_hostname.apply(lambda hostname: f"https://{hostname}"))
    pulumi.export("apigateway_id", api_gateway.gateway_id)
    return api_gateway


def _get_repository(
        basic_config: ProjectBaseConfig,
        project_number: pulumi.Output[str],
        root_project_id: str
) -> pulumi.Output[gcp.artifactregistry.Repository]:
    # get the root repository from the organization
    # we are using one repository for all the environments
    # that is why we can not create it here we do get the root one
    organization_reference = pulumi.StackReference("tabiya-tech/compass-organization/base")
    repository = organization_reference.get_output("repository")

    # allow the current environment to read and write to the repository
    gcp.artifactregistry.RepositoryIamMember(
        resource_name=get_resource_name(resource="docker-repository", resource_type="read-write-iam"),
        project=root_project_id,
        location=basic_config.location,
        repository=repository.apply(lambda repo: repo.get("name")),
        # you can read, write and delete the images to the repository
        role="roles/artifactregistry.repoAdmin",
        member=project_number.apply(lambda _project_number: f"serviceAccount:service-{_project_number}@serverless-robot-prod.iam.gserviceaccount.com"),
        opts=pulumi.ResourceOptions(provider=basic_config.provider),
    )

    return repository

def _build_and_push_image(fully_qualified_image_name: pulumi.Output[str], dependencies: list[pulumi.Resource], basic_config: ProjectBaseConfig) -> docker.Image:
    # Build and push image to gcr repository
    image = docker.Image(
        get_resource_name(resource="backend", resource_type="image"),
        image_name=fully_qualified_image_name,
        build=docker.DockerBuildArgs(context="../../backend", platform="linux/amd64"),
        registry=None,  # use gcloud for authentication.
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    # Digest exported so it's easy to match updates happening in cloud run project
    pulumi.export("digest", image.image_name)
    return image


def _get_fully_qualified_image_name(
        basic_config: ProjectBaseConfig,
        _repository: pulumi.Output[gcp.artifactregistry.Repository],
        image_name: str,
        environment_type: Output[str],
        env_vars: BackendEnvVarsConfig
) -> pulumi.Output[str]:
    def _get_name(values):
        repository_info, _environment_type = values

        commit_hash = env_vars.GITHUB_SHA

        # replace / with __ to avoid issues with docker image names, tags shouldn't have / in them,
        # and we have to replace - with _ because we might want to differentiate between branches and tags same with hashes
        branch_name = env_vars.GITHUB_REF_NAME.replace("/", "__").replace("-", "_")

        run_number = env_vars.GITHUB_RUN_NUMBER

        repository_name = repository_info.get("name")

        if _environment_type == "dev":
            label = f"{branch_name}-{commit_hash}"
        else:
            label = f"{branch_name}-b{run_number}"

        name = f"{basic_config.location}-docker.pkg.dev/{env_vars.ROOT_PROJECT_ID}/{repository_name}/{image_name}-{_environment_type}:{label}"

        pulumi.info("using image name: " + name)

        return name

    return Output.all(_repository, environment_type).apply(_get_name)

# Deploy cloud run service

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
        get_resource_name(resource="backend-sa", resource_type="sa"),
        account_id="backend-sa",
        display_name="The dedicated service account for the Compass backend service",
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    # Assign the necessary roles to the service account for Vertex AI access
    gcp.projects.IAMBinding(
        get_resource_name(resource="backend-sa", resource_type="ai-user-binding"),
        members=[service_account.email.apply(lambda email: f"serviceAccount:{email}")],
        role="roles/aiplatform.user",
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    # Deploy cloud run service

    service = gcp.cloudrunv2.Service(
        get_resource_name(resource="cloudrun", resource_type="service"),
        name="cloudrun-service",
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
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )
    pulumi.export("cloud_run_url", service.uri)
    return service

# export a function build_and_push_image that will be used in the main pulumi program
def deploy_backend(project: str, location: str, environment: str, project_number: Output[str], environment_type: Output[str], env_vars: BackendEnvVarsConfig):
    basic_config = get_project_base_config(project=project, location=location, environment=environment)

    image_name = "backend"

    # Get the repository from the organisation/root-project
    repository = _get_repository(basic_config, project_number, env_vars.ROOT_PROJECT_ID)

    # Build and push image to gcr repository
    fully_qualified_image_name = _get_fully_qualified_image_name(
        basic_config,
        repository,
        image_name,
        environment_type,
        env_vars
    )
    image = _build_and_push_image(fully_qualified_image_name, [], basic_config)

    # Deploy the image as a cloud run service
    cloud_run = _deploy_cloud_run_service(
        basic_config=basic_config,
        fully_qualified_image_name=fully_qualified_image_name.apply(lambda value: value),
        backend_env_vars_cfg=env_vars,
        dependencies=[image],
    )

    _api_gateway = _setup_api_gateway(
        basic_config=basic_config,
        cloudrun=cloud_run,
        gcp_oauth_client_id=env_vars.GCP_OAUTH_CLIENT_ID,
        dependencies=[cloud_run]
    )
