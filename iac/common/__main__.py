import json
import os
import sys

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/common directory.
sys.path.insert(0, libs_dir)

import pulumi
from deploy_common import deploy_common

from lib.std_pulumi import getconfig, getstackref, parse_realm_env_name_from_stack, load_dot_realm_env


def main():
    _, _, stack_name = parse_realm_env_name_from_stack()

    # Load environment variables.
    load_dot_realm_env(stack_name)

    # Get the config values
    location = getconfig("region", "gcp")

    # Get stack reference for environment
    env_reference = pulumi.StackReference(f"tabiya-tech/compass-environment/{stack_name}")
    project = getstackref(env_reference, "project_id")

    frontend_domain = getstackref(env_reference, "frontend_domain")
    frontend_url = getstackref(env_reference, "frontend_url")
    backend_url = getstackref(env_reference, "backend_url")
    admin_frontend_domain = getstackref(env_reference, "admin_frontend_domain")
    admin_frontend_url = getstackref(env_reference, "admin_frontend_url")

    # Optional extra custom domain aliases for the frontend and admin frontend (JSON arrays).
    # e.g. FRONTEND_CUSTOM_DOMAINS='["njila.ai"]'
    _extra_frontend = os.getenv("FRONTEND_CUSTOM_DOMAINS")
    _extra_admin = os.getenv("ADMIN_FRONTEND_CUSTOM_DOMAINS")
    frontend_domains = [frontend_domain] + (json.loads(_extra_frontend) if _extra_frontend else [])
    admin_frontend_domains = [admin_frontend_domain] + (json.loads(_extra_admin) if _extra_admin else [])

    # Get stack reference for dns
    dns_stack_ref = pulumi.StackReference(f"tabiya-tech/compass-dns/{stack_name}")
    dns_zone_name = getstackref(dns_stack_ref, "dns_zone_name")

    # Get stack reference for frontend
    frontend_stack_ref = pulumi.StackReference(f"tabiya-tech/compass-frontend/{stack_name}")
    frontend_bucket_name = getstackref(frontend_stack_ref, "bucket_name")
    frontend_bucket_name.apply(lambda name: print(f"Using frontend bucket name: {name}"))

    # Get stack reference for admin frontend
    admin_frontend_stack_ref = pulumi.StackReference(f"tabiya-tech/compass-admin-frontend/{stack_name}")
    admin_frontend_bucket_name = getstackref(admin_frontend_stack_ref, "bucket_name")
    admin_frontend_bucket_name.apply(lambda name: print(f"Using admin frontend bucket name: {name}"))

    # Get stack reference for backend
    backend_stack_ref = pulumi.StackReference(f"tabiya-tech/compass-backend/{stack_name}")
    api_gateway_id = getstackref(backend_stack_ref, "apigateway_id")
    api_gateway_id.apply(lambda _id: print(f"Using API gateway id: {_id}"))

    # Deploy common
    deploy_common(
        project=project,
        location=location,
        dns_zone_name=dns_zone_name,
        frontend_domains=frontend_domains,
        frontend_bucket_name=frontend_bucket_name,
        frontend_url=frontend_url,
        backend_url=backend_url,
        api_gateway_id=api_gateway_id,
        admin_frontend_domains=admin_frontend_domains,
        admin_frontend_url=admin_frontend_url,
        admin_frontend_bucket_name=admin_frontend_bucket_name)


if __name__ == "__main__":
    main()
