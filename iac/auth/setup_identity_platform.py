import pulumi
import pulumi_gcp as gcp
from lib.std_pulumi import get_resource_name, ProjectBaseConfig, get_project_base_config

"""
# The gcp.identityplatform cannot be disabled after it has been enabled for a GCP project.
# This code should work when it is run the first time for a new GCP project.
# However, if the pulumi stack is removed (pulumi destroy), this code will fail when the stack is re-created (pulumi up)
# as the identity platform has already been enabled for the project.
# The solution is to import the identity platform configs to the pulumi projects with the following command
# $ pulumi import gcp:identityplatform/config:Config identity-platform-config {{project}}
# where {{project}} is for example auth-poc-422113 or compass-dev-418218.
# After the resource has been imported to the pulumi stack, the code is able to update the configs again.
"""


def _setup_identity_platform(
        *,
        basic_config: ProjectBaseConfig,
        frontend_domain: str,
        gcp_oauth_client_id: str,
        gcp_oauth_client_secret: str):

    # for the development environment allow localhost
    _authorized_domains = [frontend_domain]
    if basic_config.environment == "dev":
        _authorized_domains.append("localhost")
        # add more domains here depending on how the application is accessed

    default = gcp.identityplatform.Config(
        get_resource_name(resource="identity-platform", resource_type="config"),
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
        opts=pulumi.ResourceOptions(provider=basic_config.provider)
    )

    pulumi.export("identity_platform_client_api_key", default.client.api_key.unsecret(default.client.api_key))
    pulumi.export(
        "identity_platform_client_firebase_subdomain",
        default.client.firebase_subdomain.unsecret(default.client.firebase_subdomain)
    )

    # https://compass-dev-425015.firebaseapp.com/__/auth/handler
    # Enable Google Authentication
    gcp.identityplatform.DefaultSupportedIdpConfig(
        get_resource_name(resource="google-idp", resource_type="config"),
        client_id=gcp_oauth_client_id,
        client_secret=gcp_oauth_client_secret,
        idp_id="google.com",
        enabled=True,
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=[default], provider=basic_config.provider),
    )


def deploy_auth(
        project: str,
        location: str,
        environment: str,
        frontend_domain: str,
        gcp_oauth_client_id: str,
        gcp_oauth_client_secret: str):
    """
    Deploy the Identity Platform for the project.

    Note: This function does not set up the "OAuth consent screen", it should be set up separately in the GCP console.
    And the auth_client_id and auth_client_secret should be passed to this function.

    — Enable Google Authentication
    — Enable Email/Password Authentication
    — Enable Anonymous Authentication
    """
    _basic_config = get_project_base_config(project=project, location=location, environment=environment)

    # Setup Google Cloud Identity Platform that provides Firebase based authentications
    _setup_identity_platform(
        basic_config=_basic_config,
        frontend_domain=frontend_domain,
        gcp_oauth_client_id=gcp_oauth_client_id,
        gcp_oauth_client_secret=gcp_oauth_client_secret
    )
