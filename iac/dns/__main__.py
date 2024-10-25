import os
import sys

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/common directory.
sys.path.insert(0, libs_dir)

import pulumi
from deploy_dns import deploy_dns

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

    # Deploy common
    deploy_dns(
        project=project,
        location=location,
        domain_name=domain_name,
    )


if __name__ == "__main__":
    main()
