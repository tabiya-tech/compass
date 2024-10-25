import os
import sys

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/auth directory
sys.path.insert(0, libs_dir)

import pulumi
from setup_identity_platform import deploy_auth

from lib.std_pulumi import load_dot_realm_env, getenv, getstackref, getconfig, parse_realm_env_name_from_stack


def main():
    _, _, stack_name = parse_realm_env_name_from_stack()
    # Load environment variables
    load_dot_realm_env(stack_name)

    # get the config values
    location = getconfig(name="region", config="gcp")

    # Get stack reference for environment
    env_reference = pulumi.StackReference(f"tabiya-tech/compass-environment/{stack_name}")
    environment_type = getstackref(env_reference, "environment_type")
    project_id = getstackref(env_reference, "project_id")
    domain_name = getstackref(env_reference, "domain_name")
    auth_domain = getstackref(env_reference, "auth_domain")
    frontend_domain = getstackref(env_reference, "frontend_domain")

    # Get stack reference for dns
    dns_stack_ref = pulumi.StackReference(f"tabiya-tech/compass-dns/{stack_name}")
    dns_zone_name = getstackref(dns_stack_ref, "dns_zone_name")

    # Get environment variables
    # Secrets are not stored in the pulumi state file but in the .env file
    gcp_oauth_client_id = getenv("GCP_OAUTH_CLIENT_ID")
    gcp_oauth_client_secret = getenv("GCP_OAUTH_CLIENT_SECRET", secret=True)

    # Deploy the auth
    deploy_auth(
        location=location,
        environment_type=environment_type,
        project=project_id,
        dns_zone_name=dns_zone_name,
        domain_name=domain_name,
        auth_domain=auth_domain,
        frontend_domain=frontend_domain,
        gcp_oauth_client_id=gcp_oauth_client_id,
        gcp_oauth_client_secret=gcp_oauth_client_secret
    )


if __name__ == "__main__":
    main()
