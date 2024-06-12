import os
import pulumi
import pulumi_gcp as gcp
from dataclasses import dataclass


@dataclass
class ProjectBaseConfig:
    project: str
    location: str
    environment: str


REQUIRED_SERVICES = [
    # Firebase
    "firebasehosting.googleapis.com",
    "firebase.googleapis.com",
    # GCP Identity Platform
    "identitytoolkit.googleapis.com",
]


def _get_resource_name(environment: str, resource: str, type=None):
    if not type:
        return f"compass-{environment}-{resource}"

    return f"compass-{environment}-{type}-{resource}"


def _enable_services(basic_config: ProjectBaseConfig, services_to_enable: list[str]) -> list[gcp.projects.Service]:
    enabled_services = []
    for service in services_to_enable:
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
        )
        enabled_services.append(srv)
    return enabled_services


def _setup_identity_platform(*, basic_config: ProjectBaseConfig, frontend_domain: str, dependencies: list[pulumi.Resource]):
    # GCP OAuth clients cannot be created automatically, but must be created from the Google Cloud Console.
    gcp_oauth_client_id = os.getenv("GCP_OAUTH_CLIENT_ID")
    gcp_oauth_client_secret = os.getenv("GCP_OAUTH_CLIENT_SECRET")

    # for the development environment allow localhost
    _authorized_domains = [frontend_domain]
    if basic_config.environment == "dev":
        _authorized_domains.append("localhost")
        # add more domains here depending on how the application is accessed

    # Use name "default" as we may require to import this from GCP
    default = gcp.identityplatform.Config(
        "default",
        authorized_domains=_authorized_domains,
        mfa=gcp.identityplatform.ConfigMfaArgs(
            state="DISABLED",
        ),
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies)
    )

    pulumi.export("identity_platform_client_api_key", default.client.api_key)
    pulumi.export("identity_platform_client_firebase_subdomain", default.client.firebase_subdomain)

    # https://compass-dev-425015.firebaseapp.com/__/auth/handler
    # Enable Google Authentication
    gcp.identityplatform.DefaultSupportedIdpConfig(
        _get_resource_name(environment=basic_config.environment, resource="google_idp_config"),
        client_id=gcp_oauth_client_id,
        client_secret=gcp_oauth_client_secret,
        idp_id="google.com",
        enabled=True,
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies + [default]),
    )


def deploy_auth(project: str, location: str, environment: str, frontend_domain: str):
    _basic_config = ProjectBaseConfig(project=project, location=location, environment=environment)
    # Enable the required services
    dependencies = _enable_services(_basic_config, REQUIRED_SERVICES)

    # Setup Google Cloud Identity Platform that provides Firebase based authentications
    _setup_identity_platform(basic_config=_basic_config, frontend_domain=frontend_domain, dependencies=dependencies)
