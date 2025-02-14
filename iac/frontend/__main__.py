import os
import sys
import pulumi


# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/frontend directory.
sys.path.insert(0, libs_dir)

from deploy_frontend import deploy_frontend
from scripts.formatters import construct_artifacts_version
from lib import getconfig, parse_realm_env_name_from_stack, getstackref, load_dot_realm_env, getenv, \
    construct_artifacts_dir, Version


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
    deployable_version = Version(
        git_branch_name=getenv("TARGET_GIT_BRANCH_NAME"),
        git_sha=getenv("TARGET_GIT_SHA")
    )

    generic_artifact_version = construct_artifacts_version(
        git_branch_name=deployable_version.git_branch_name,
        git_sha=deployable_version.git_sha
    )

    # the unique identifier of this running deployment.
    run_number = getenv("DEPLOYMENT_RUN_NUMBER")

    # the deployment id, used to know, which source folder to get artifacts from.

    artifacts_dir = construct_artifacts_dir(
        deployment_number=run_number,
        fully_qualified_version=generic_artifact_version,
        stack_name=stack_name
    )

    # Deploy the frontend
    deploy_frontend(
        project=project,
        location=location,
        artifacts_dir=artifacts_dir
    )


if __name__ == "__main__":
    main()
