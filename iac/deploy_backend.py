import os
import uuid

import pulumi
import pulumi_docker as docker
import pulumi_gcp as gcp


def _enable_services(project: str, services_to_enable: list[str]) -> list[gcp.projects.Service]:
    # return an array of services to be enabled
    enabled_services = []

    # Enable the necessary services
    for service in services_to_enable:
        srv = gcp.projects.Service("enabled_services_{0}".format(service.split('.')[0]),
                                   project=project,
                                   service=service)
        enabled_services.append(srv)

    return enabled_services


def _create_repository(project: str, location: str, repository_name: str,
                       dependencies: list[pulumi.Resource]) -> gcp.artifactregistry.Repository:
    # Create a repository
    return gcp.artifactregistry.Repository("docker-repository",
                                           project=project,
                                           location=location,
                                           format="DOCKER",
                                           repository_id=repository_name,
                                           opts=pulumi.ResourceOptions(depends_on=dependencies)
                                           )


def _build_and_push_image(fully_qualified_image_name: str, dependencies: list[pulumi.Resource]) -> docker.Image:
    # Build and push image to gcr repository
    image = docker.Image("compass-image",
                         image_name=fully_qualified_image_name,
                         build=docker.DockerBuildArgs(context="../backend", platform="linux/amd64"),
                         registry=None,  # use gcloud for authentication.
                         opts=pulumi.ResourceOptions(depends_on=dependencies)
                         )

    # Digest exported so it's easy to match updates happening in cloud run project
    pulumi.export("digest", image.image_name)
    return image


def _get_fully_qualified_image_name(project: str, location: str, repository_name: str, image_name: str, label: str):
    return f'{location}-docker.pkg.dev/{project}/{repository_name}/{image_name}:{label}'


# Deploy cloud run service
# See https://cloud.google.com/run/docs/overview/what-is-cloud-run for more information
def _deploy_cloud_run_service(project: str, location: str, fully_qualified_image_name: str,
                              dependencies: list[pulumi.Resource]):
    # See https://cloud.google.com/run/docs/securing/service-identity#per-service-identity for more information
    # Create a service account for the Cloud Run service
    service_account = gcp.serviceaccount.Account('compass-backend-service-account',
                                                 account_id='compass-backend-service',
                                                 display_name=
                                                 'The dedicated service account for the Compass backend service',
                                                 project=project,
                                                 )

    # Assign the necessary roles to the service account for Vertex AI access
    gcp.projects.IAMBinding('ai-user-binding',
                            members=[
                                service_account.email.apply(lambda email: f'serviceAccount:{email}')],
                            role='roles/aiplatform.user',
                            project=project,
                            )

    # Deploy cloud run service
    mongodb_uri = os.getenv("MONGO_URI")
    if not mongodb_uri:
        raise ValueError("MONGO_URI environment variable is not set")
    service = gcp.cloudrunv2.Service("default",
                                     name="compass-service",
                                     project=project,
                                     location=location,
                                     ingress="INGRESS_TRAFFIC_ALL",
                                     template=gcp.cloudrunv2.ServiceTemplateArgs(
                                         containers=[gcp.cloudrunv2.ServiceTemplateContainerArgs(
                                             image=fully_qualified_image_name,
                                             envs=[
                                                 gcp.cloudrunv2.ServiceTemplateContainerEnvArgs(
                                                     name="MONGO_URI",
                                                     value=mongodb_uri
                                                 ),
                                                 # Add more environment variables here
                                             ]
                                         )],
                                         service_account=service_account.email,
                                     ),
                                     opts=pulumi.ResourceOptions(depends_on=dependencies)
                                     )
    pulumi.export('cloud_run_url', service.uri)

    # Allow public to access the service without authentication
    # https://cloud.google.com/run/docs/authenticating/public
    return gcp.cloudrun.IamBinding("public-access",
                                   project=project,
                                   location=location,
                                   service=service.name,
                                   role="roles/run.invoker",
                                   members=["allUsers"],
                                   opts=pulumi.ResourceOptions(depends_on=dependencies)
                                   )


# export a function build_and_push_image that will be used in the main pulumi program
def deploy_backend(project: str, location: str):
    # Get the configuration values from the stack
    config = pulumi.Config()
    repository_name = config.require("backend_repository_name")
    pulumi.info(f'Using backend_repository:{repository_name}')
    image_name = config.require("backend_image_name")
    pulumi.info(f"Using backend_image_name: {image_name}")

    # Enable the necessary services for building and pushing the image
    required_services = ["artifactregistry.googleapis.com",
                         "cloudbuild.googleapis.com",
                         "run.googleapis.com",
                         # Required for listing regions
                         "compute.googleapis.com",
                         # Required for VertexAI see https://cloud.google.com/vertex-ai/docs/start/cloud-environment
                         "aiplatform.googleapis.com",
                         "cloudresourcemanager.googleapis.com"
                         ]
    services = _enable_services(project, required_services)

    # Create an artifact repository
    repository = _create_repository(project, location, repository_name, services)

    # Build and push image to gcr repository
    label = uuid.uuid4().hex[:6].upper()
    fully_qualified_image_name = _get_fully_qualified_image_name(project, location, repository_name,
                                                                 image_name, label)
    image = _build_and_push_image(fully_qualified_image_name, [repository])

    # Deploy the image as a cloud run service
    _deploy_cloud_run_service(project, location, fully_qualified_image_name, [image])
