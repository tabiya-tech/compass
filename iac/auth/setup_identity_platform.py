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
from identity_platform import IdentityPlatform, NotificationConfigArgs, SendEmailArgs, DNSInfoArgs, VerifyEmailTemplateArgs


def _setup_google_signin(*,
                         basic_config: ProjectBaseConfig,
                         dns_zone_name: pulumi.Output[str],
                         auth_domain: pulumi.Output[str],
                         frontend_domain: pulumi.Output[str],
                         gcp_oauth_client_id: str,
                         gcp_oauth_client_secret: str,
                         dependencies: list[pulumi.Resource]):
    """
    Setting up the Firebase custom domain is required when offering google as an identity provider.
    The user should see a custom domain (the auth_domain apex) e.g. "Sign in to continue to tabiya.tech" in the google sign in page
    instead of the default firebase domain which contains the project id
    e.g. compass-demo-xyz.firebaseapp.com.

    This function depends on the identity platform setup as it needs the firebase site to be setup first.

    :param basic_config: The basic project configuration.
    :param dns_zone_name: The DNS zone name to add the CNAME record to.
    :param auth_domain: The domain name of the auth subdomain.
    :param frontend_domain: The domain name of the frontend.
    :param dependencies: The list of resources that this function depends on.
    :return:
    """

    # Enable Google Authentication
    google_idp_cfg = gcp.identityplatform.DefaultSupportedIdpConfig(
        get_resource_name(resource="google-idp", resource_type="config"),
        client_id=gcp_oauth_client_id,
        client_secret=gcp_oauth_client_secret,
        idp_id="google.com",
        enabled=True,
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

    # The issue:
    # When running `pulumi preview`, the `idp` resource does not yet exist.
    # However, `gcp.firebase.HostingSite.get("default")` tries to retrieve an existing resource immediately.
    # This causes an error during the preview phase because the Firebase Hosting Site depends on `idp`.

    # Solution:
    # - Use `apply()` to defer the call to `.get()`
    # - This ensures that the retrieval of `firebase_site` happens only after `idp` is created.
    firebase_site = pulumi.Output.all(basic_config.project, google_idp_cfg.id).apply(
        lambda args:
        # At this point the Identity Platform is already setup and the Auth domain is already verified.
        gcp.firebase.HostingSite.get(
            resource_name=get_resource_name(resource="firebase-site", resource_type="firebase-site"),
            id="default",
            project=args[0],
            site_id=args[0],
            opts=pulumi.ResourceOptions(provider=basic_config.provider)
        )
    )

    auth_site_rdata = firebase_site.default_url.apply(lambda s: s.replace("https://", "") + ".")
    auth_site_id = firebase_site.site_id

    # Set up the CNAME record for the auth subdomain to point to the firebase site.
    record_set = gcp.dns.RecordSet(
        get_resource_name(resource="auth", resource_type="record-set"),
        project=basic_config.project,
        # Add a dot at the end.
        name=auth_domain.apply(lambda s: s + "."),
        managed_zone=dns_zone_name,
        type="CNAME",
        ttl=300,
        rrdatas=[auth_site_rdata],
        opts=pulumi.ResourceOptions(provider=basic_config.provider)
    )

    # Set up the auth domain in firebase hosting and point it to the frontend domain.
    gcp.firebase.HostingCustomDomain(
        get_resource_name(resource="auth", resource_type="custom-domain"),
        args=gcp.firebase.HostingCustomDomainArgs(
            project=basic_config.project,
            site_id=auth_site_id,
            custom_domain=auth_domain,
            redirect_target=frontend_domain,
            wait_dns_verification=True
        ),
        opts=pulumi.ResourceOptions(provider=basic_config.provider, depends_on=dependencies + [record_set]),
    )


def _setup_email_templates_dns(basic_config: ProjectBaseConfig,
                               dns_zone_name: pulumi.Output[str],
                               domain_name: pulumi.Output[str],
                               dependencies: list[pulumi.Resource]) -> list[gcp.dns.RecordSet]:
    # Add the SPF, DKIM and firebase verification records
    # See https://firebase.google.com/docs/auth/email-custom-domain for more information and
    # https://console.firebase.google.com/project/_/authentication/emails for the setup in the firebase console.

    def _ensure_dkim_format(s: str) -> str:
        # Converts a domain name into a GCP-compatible DKIM record format
        # - Ensures subdomains with dashes (`-`) are correctly handled (`--`)
        # - Replaces dots (`.`) with dashes (`-`)
        return s.replace("-", "--").replace(".", "-")

    return [
        # Add the SPF and the firebase verification record
        gcp.dns.RecordSet(
            get_resource_name(resource="dns", resource_type="firebase-sdf-verification-record"),
            project=basic_config.project,
            name=domain_name.apply(lambda s: f"{s}."),
            managed_zone=dns_zone_name,
            type="TXT",
            ttl=300,
            rrdatas=['"v=spf1 include:_spf.firebasemail.com ~all"', basic_config.project.apply(lambda s: f'firebase={s}')],
            opts=pulumi.ResourceOptions(provider=basic_config.provider, depends_on=dependencies)
        ),

        # Add the DKIM records

        gcp.dns.RecordSet(
            get_resource_name(resource="dns", resource_type="dkim-record1"),
            project=basic_config.project,
            name=domain_name.apply(lambda s: f"firebase1._domainkey.{s}."),
            managed_zone=dns_zone_name,
            type="CNAME",
            ttl=300,
            rrdatas=[domain_name.apply(lambda s: f'mail-{_ensure_dkim_format(s)}.dkim1._domainkey.firebasemail.com.')],
            opts=pulumi.ResourceOptions(provider=basic_config.provider, depends_on=dependencies)
        ),
        gcp.dns.RecordSet(
            get_resource_name(resource="dns", resource_type="dkim-record2"),
            project=basic_config.project,
            name=domain_name.apply(lambda s: f"firebase2._domainkey.{s}."),
            managed_zone=dns_zone_name,
            type="CNAME",
            ttl=300,
            rrdatas=[domain_name.apply(lambda s: f'mail-{_ensure_dkim_format(s)}.dkim2._domainkey.firebasemail.com.')],
            opts=pulumi.ResourceOptions(provider=basic_config.provider, depends_on=dependencies)
        ),
    ]


def _setup_identity_platform(
        *,
        basic_config: ProjectBaseConfig,
        environment_type: pulumi.Output[str],
        auth_domain: pulumi.Output[str],
        frontend_domain: pulumi.Output[str],
        dependencies: list[pulumi.Resource]) -> IdentityPlatform:
    # for the development environment allow localhost
    def _get_authorized_domains(args) -> list[str]:
        _frontend_domain = args[0]
        _environment_type = args[1]
        _authorized_domains = [_frontend_domain]
        if _environment_type == EnvironmentTypes.DEV.value:
            # add more domains here depending on how the application is accessed.
            _authorized_domains.append("localhost")

        return _authorized_domains

    authorized_domains = pulumi.Output.all(frontend_domain, environment_type).apply(_get_authorized_domains)
    idp_config = IdentityPlatform(
        get_resource_name(resource="identity-platform", resource_type="default-config"),
        notification_config=NotificationConfigArgs(
            send_email=SendEmailArgs(
                callback_uri=auth_domain.apply(lambda s: f"https://{s}/__/auth/action"),
                dns_info=DNSInfoArgs(
                    custom_domain=frontend_domain,
                    use_custom_domain=True,
                ),
                verify_email_template=VerifyEmailTemplateArgs(
                    sender_local_part="noreply",
                    sender_display_name="Compass",
                    subject="Please verify your email address",
                ),

            )
        ),
        config=gcp.identityplatform.ConfigArgs(
            authorized_domains=authorized_domains,
            mfa=gcp.identityplatform.ConfigMfaArgs(
                state="DISABLED",
            ),
            sign_in=gcp.identityplatform.ConfigSignInArgs(
                # Accounts using the same email will be linked together, Otherwise we can't see the account identifier.
                allow_duplicate_emails=False,
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
                                    depends_on=dependencies,
                                    delete_before_replace=True)
    )

    # Get the api key from the client config
    api_key_value = idp_config.client.apply(lambda c: c.get("api_key"))
    pulumi.export("identity_platform_client_api_key", api_key_value)
    return idp_config


def deploy_auth(*,
                location: str,
                environment_type: pulumi.Output[str],
                project: pulumi.Output[str],
                dns_zone_name: pulumi.Output[str],
                domain_name: pulumi.Output[str],
                auth_domain: pulumi.Output[str],
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

    # Set up the DNS records for sending emails from the base domain of the environment e.g. demo.compass.tabiya.tech
    record_sets = _setup_email_templates_dns(
        basic_config=_basic_config,
        dns_zone_name=dns_zone_name,
        domain_name=domain_name,
        dependencies=[]
    )

    # Set up the Google Cloud Identity Platform that provides Firebase based authentications
    idp_cfg = _setup_identity_platform(
        basic_config=_basic_config,
        environment_type=environment_type,
        auth_domain=auth_domain,
        frontend_domain=frontend_domain,
        dependencies=record_sets
    )
    _setup_google_signin(
        basic_config=_basic_config,
        dns_zone_name=dns_zone_name,
        auth_domain=auth_domain,
        frontend_domain=frontend_domain,
        gcp_oauth_client_id=gcp_oauth_client_id,
        gcp_oauth_client_secret=gcp_oauth_client_secret,
        dependencies=[idp_cfg]  # Wait for the identity platform to be setup first
    )
