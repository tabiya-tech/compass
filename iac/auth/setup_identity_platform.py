import pulumi
import pulumi_gcp as gcp
from environment.env_types import EnvironmentTypes

# Determine the absolute path to the 'iac' directory
import os
import sys

libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/auth directory
sys.path.insert(0, libs_dir)

from lib import get_resource_name, ProjectBaseConfig, get_project_base_config
from identity_platform import IdentityPlatform


def _setup_identity_platform(
        *,
        basic_config: ProjectBaseConfig,
        environment_type: pulumi.Output[EnvironmentTypes],
        frontend_domain: pulumi.Output[str],
        gcp_oauth_client_id: str,
        gcp_oauth_client_secret: str):
    # for the development environment allow localhost
    def _get_authorized_domains(args) -> list[str]:
        _frontend_domain = args[0]
        _environment_type = args[1]
        _authorized_domains = [_frontend_domain]
        if _environment_type == EnvironmentTypes.DEV:
            # add more domains here depending on how the application is accessed.
            _authorized_domains.append("localhost")

        return _authorized_domains

    authorized_domains = pulumi.Output.all(frontend_domain, environment_type).apply(_get_authorized_domains)
    idp_config = IdentityPlatform(
        get_resource_name(resource="identity-platform", resource_type="default-config"),
        config=gcp.identityplatform.ConfigArgs(
            authorized_domains=authorized_domains,
            mfa=gcp.identityplatform.ConfigMfaArgs(
                state="DISABLED",
            ),
            sign_in=gcp.identityplatform.ConfigSignInArgs(
                allow_duplicate_emails=True,
                anonymous=gcp.identityplatform.ConfigSignInAnonymousArgs(
                    enabled=True,
                ),
                email=gcp.identityplatform.ConfigSignInEmailArgs(
                    enabled=True,
                    password_required=True
                ),
            ),
        ),
        opts=pulumi.ResourceOptions(provider=basic_config.provider,
                                    delete_before_replace=True,
                                    aliases=[pulumi.Alias(name="identity-platform-config")],
                                    )

    )
    pulumi.export("identity_platform_client_api_key", idp_config.client.apply(lambda c: c.get("api_key")))
    pulumi.export("identity_platform_client_firebase_subdomain", idp_config.client.apply(lambda c: c.get("firebase_subdomain")))
    # Enable Google Authentication
    gcp.identityplatform.DefaultSupportedIdpConfig(
        get_resource_name(resource="google-idp", resource_type="config"),
        client_id=gcp_oauth_client_id,
        client_secret=gcp_oauth_client_secret,
        idp_id="google.com",
        enabled=True,
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=[idp_config], provider=basic_config.provider),
    )


def deploy_auth(*,
                location: str,
                environment_type: pulumi.Output[EnvironmentTypes],
                project: pulumi.Output[str],
                frontend_domain: pulumi.Output[str],
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
    _basic_config = get_project_base_config(
        project=project,
        location=location,
    )

    # Setup Google Cloud Identity Platform that provides Firebase based authentications
    _setup_identity_platform(
        basic_config=_basic_config,
        environment_type=environment_type,
        frontend_domain=frontend_domain,
        gcp_oauth_client_id=gcp_oauth_client_id,
        gcp_oauth_client_secret=gcp_oauth_client_secret
    )
