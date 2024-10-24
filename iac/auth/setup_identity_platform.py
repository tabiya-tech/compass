import os
import pulumi
import pulumi_gcp as gcp
from lib.std_pulumi import get_resource_name, ProjectBaseConfig, get_project_base_config, enable_services

REQUIRED_SERVICES = [
    # Firebase
    "firebasehosting.googleapis.com",
    "firebase.googleapis.com",
    # GCP Identity Platform
    "identitytoolkit.googleapis.com",
]

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
        sign_in=gcp.identityplatform.ConfigSignInArgs(
            allow_duplicate_emails=False,
            anonymous=gcp.identityplatform.ConfigSignInAnonymousArgs(
                enabled=True,
            ),
            email=gcp.identityplatform.ConfigSignInEmailArgs(
                enabled=True,
                password_required=True
            ),
        ),
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider)
    )

    pulumi.export("identity_platform_client_api_key", default.client.api_key.unsecret(default.client.api_key))
    pulumi.export("identity_platform_client_firebase_subdomain", default.client.firebase_subdomain.unsecret(default.client.firebase_subdomain))

    # https://compass-dev-425015.firebaseapp.com/__/auth/handler
    # Enable Google Authentication
    gcp.identityplatform.DefaultSupportedIdpConfig(
        get_resource_name(environment=basic_config.environment, resource="google_idp_config"),
        client_id=gcp_oauth_client_id,
        client_secret=gcp_oauth_client_secret,
        idp_id="google.com",
        enabled=True,
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies + [default], provider=basic_config.provider),
    )


def deploy_auth(project: str, location: str, environment: str, frontend_domain: str):
    _basic_config = get_project_base_config(project=project, location=location, environment=environment)
    # Enable the required services
    dependencies = enable_services(_basic_config, REQUIRED_SERVICES)

    # Setup Google Cloud Identity Platform that provides Firebase based authentications
    _setup_identity_platform(basic_config=_basic_config, frontend_domain=frontend_domain, dependencies=dependencies)
