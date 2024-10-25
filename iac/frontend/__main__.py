import os
import sys
import pulumi

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/frontend directory.
sys.path.insert(0, libs_dir)

from deploy_frontend import deploy_frontend

from lib import getconfig, parse_realm_env_name_from_stack, getstackref, load_dot_realm_env, getenv, get_deployment_id, \
    parse_artifacts_version


def main():
    _, _, stack_name = parse_realm_env_name_from_stack()

    # Load environment variables
    load_dot_realm_env(stack_name)

    # Get the config values
    location = getconfig("region", "gcp")
    pulumi.info(f'Using location:{location}')

    # get stack reference
    env_reference = pulumi.StackReference(f"tabiya-tech/compass-environment/{stack_name}")
    project = getstackref(env_reference, "project_id")

    # the artifacts version of the frontend build to deploy.
    artifacts_version = getenv("ARTIFACTS_VERSION")
    frontend_version = parse_artifacts_version(artifacts_version).frontend_version

    # the unique identifier of this running deployment.
    run_number = getenv("DEPLOYMENT_RUN_NUMBER")

    # the deployment id, used to know, which source folder to get artifacts from.
    deployment_id = get_deployment_id(deployment_number=run_number, deploy_version=frontend_version, stack_name=stack_name)

    # Deploy the frontend
    deploy_frontend(
        project=project,
        location=location,
        deployment_id=deployment_id
    )


if __name__ == "__main__":
    main()
