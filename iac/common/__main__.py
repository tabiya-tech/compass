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

    domain_name = getstackref(env_reference, "domain_name")
    frontend_domain = getstackref(env_reference, "frontend_domain")
    frontend_url = getstackref(env_reference, "frontend_url")
    backend_url = getstackref(env_reference, "backend_url")
    auth_domain = getstackref(env_reference, "auth_domain")

    # Get stack reference for frontend
    frontend_stack_ref = pulumi.StackReference(f"tabiya-tech/compass-frontend/{stack_name}")
    frontend_bucket_name = getstackref(frontend_stack_ref, "bucket_name")
    frontend_bucket_name.apply(lambda name: print(f"Using frontend bucket name: {name}"))

    # Get stack reference for backend
    backend_stack_ref = pulumi.StackReference(f"tabiya-tech/compass-backend/{stack_name}")
    api_gateway_id = getstackref(backend_stack_ref, "apigateway_id")
    api_gateway_id.apply(lambda _id: print(f"Using API gateway id: {_id}"))

    # Get the stack references for the auth.
    auth_stack_ref = pulumi.StackReference(f"tabiya-tech/compass-auth/{stack_name}")
    auth_site_url = auth_stack_ref.get_output("auth_site_url")
    auth_site_id = auth_stack_ref.get_output("auth_site_id")

    # Deploy common
    deploy_common(
        project=project,
        location=location,
        domain_name=domain_name,
        frontend_domain=frontend_domain,
        frontend_bucket_name=frontend_bucket_name,
        frontend_url=frontend_url,
        backend_url=backend_url,
        api_gateway_id=api_gateway_id,
        auth_domain=auth_domain,
        auth_site_id=auth_site_id,
        auth_site_url=auth_site_url)


if __name__ == "__main__":
    main()
