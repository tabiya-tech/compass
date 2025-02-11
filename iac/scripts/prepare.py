#!/usr/bin/env python3

import os
import sys
import argparse
import uuid

# Determine the absolute path to the 'iac' directory
iac_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, iac_folder)

from _types import IaCModules
from lib import get_pulumi_stack_outputs, ENV_VARS_SECRET_ID
from backend.prepare_backend import download_backend_config
from frontend.prepare_frontend import download_frontend_bundle

from _common import add_select_environments_arguments, \
    get_environment_stack_config, get_environment_stack_configs_by_env_type, get_versioned_secret_latest_value, \
    write_config_to_pulumi_yml_file, StackConfigs


def _download_artifacts_and_config(_realm_name: str, _artifacts_version: str, _deployment_number: str):
    """
    Download the necessary configurations and artifacts.
    """

    download_frontend_bundle(
        realm_name=_realm_name,
        artifacts_version=_artifacts_version,
        deployment_number=_deployment_number
    )

    download_backend_config(
        realm_name=_realm_name,
        artifacts_version=_artifacts_version,
        deployment_number=_deployment_number
    )


def _prepare_env_file(stack_name: str, deployment_run_number: str, artifacts_version: str):
    environment_outputs = get_pulumi_stack_outputs(stack_name, "environment")
    env_file_content = get_versioned_secret_latest_value(
        ENV_VARS_SECRET_ID,
        environment_outputs["project_id"].value,
        artifacts_version)

    # add environment variables to prepare the deployment.
    env_file_content += f"\nARTIFACTS_VERSION={artifacts_version}"
    env_file_content += f"\nDEPLOYMENT_RUN_NUMBER={deployment_run_number}"

    env_file_path = os.path.join(iac_folder, f".env.{stack_name}")
    with open(env_file_path, "w", encoding="utf-8") as file:
        file.write(env_file_content)
    print(f"Environment vars written to file: {env_file_path}")


def _prepare_environment_deployment(*,
                                    env_config: StackConfigs,
                                    deployment_run_number: str,
                                    artifacts_version: str):
    """
    Prepares the deployment of an environment
     -> creating the required yaml files for the environment in the sub iac-projects,
     -> and the .env file for the environment.
    """

    print(f"Preparing environment: {env_config.stack_name}")

    # 1. Get .env file for the environment and save it in the environment files directory.
    _prepare_env_file(env_config.stack_name, deployment_run_number, artifacts_version)

    # 2. Save the modules yaml configs.
    write_config_to_pulumi_yml_file(
        stack_name=env_config.stack_name,
        module=IaCModules.AUTH,
        content=env_config.auth)

    write_config_to_pulumi_yml_file(
        stack_name=env_config.stack_name,
        module=IaCModules.BACKEND,
        content=env_config.backend)

    write_config_to_pulumi_yml_file(
        stack_name=env_config.stack_name,
        module=IaCModules.FRONTEND,
        content=env_config.frontend)

    write_config_to_pulumi_yml_file(
        stack_name=env_config.stack_name,
        module=IaCModules.COMMON,
        content=env_config.common)

    write_config_to_pulumi_yml_file(
        stack_name=env_config.stack_name,
        module=IaCModules.AWS_NS,
        content=env_config.aws_ns)

    print(f"Environment deployment prepared: {env_config.stack_name}")


def _main(args):
    # get all the required stacks to prepare matching the criteria.
    realm_name = args.realm_name
    environment_name = args.env_name
    environment_type = args.env_type
    artifacts_version = args.artifacts_version

    # randomly get a deployment number
    # this is used if we have two parallel deployments
    # and the download artifacts and configurations, needs to be able to differentiate between the two
    # otherwise it would be very complicated to know if an ongoing download or not.
    deployment_number = uuid.uuid4().__str__()

    print(f"=== Preparing the deployment of version: {artifacts_version}, deployment number: {deployment_number}")

    # Flow 1: prepare the deployment of an environment by realm name and environment name
    #          this happens if env_name was provided. (manual preparing)
    if environment_name is not None:
        # 1.1 Get the environment stack configuration
        target_environment_config = get_environment_stack_config(
            realm_name=realm_name,
            environment_name=environment_name,
            config_version=artifacts_version,
        )

        # 1.2 download the artifacts and configurations for the environment
        _download_artifacts_and_config(realm_name, artifacts_version, deployment_number)

        # 1.3 prepare the deployment of the environment
        _prepare_environment_deployment(
            env_config=target_environment_config,
            deployment_run_number=deployment_number,
            artifacts_version=artifacts_version)

    # Flow 2: prepare the deployment of environments by realm name and environment type.
    #         This happens in the pipeline when we want to prepare all the environments of a certain type.
    if environment_type is not None:
        # 2.1 Get the target environments, all the environments of the given type in the realm.
        target_environments = get_environment_stack_configs_by_env_type(
            realm_name=realm_name,
            env_type=environment_type,
            config_version=artifacts_version)

        if len(target_environments) == 0:
            print(f"No environments found for realm: {realm_name} and env_type: {environment_type}")

        # 2.2 download the artifacts and configurations for the environments
        # given that we are deploying one artifact version, the download is done once.
        _download_artifacts_and_config(realm_name, artifacts_version, deployment_number)

        # 2.3 prepare the deployment of each environment in the target list.
        for env_config in target_environments:
            _prepare_environment_deployment(
                env_config=env_config,
                deployment_run_number=deployment_number,
                artifacts_version=artifacts_version)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Prepares deployment of environment(s)"
    )

    # add the arguments to select multiple environments
    # a) by realm name and environment name
    # b) by realm name and environment type.
    add_select_environments_arguments(parser=parser)
    # TODO change to --branch-name --git-sha
    #   help="The branch name or git sha of the artifacts to deploy. They are used to form the artifacts version."
    #   " which is <branch-name>.<git-sha> when some characters have been excaped to comly to naming convetions in the artifacts regiostry"
    parser.add_argument(
        "--artifacts-version",
        type=str,
        required=True,
        help="The artifacts version (hash or tag) to deploy. "
             "This will also be useful when we try to know which config to download when preparing the deployment.")

    _main(parser.parse_args())
