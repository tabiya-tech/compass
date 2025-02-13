#!/usr/bin/env python3

import os
import sys
import uuid
import yaml
import argparse

from dotenv import dotenv_values

# Determine the absolute path to the 'iac' directory
iac_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, iac_folder)


from backend.prepare_backend import download_backend_config
from frontend.prepare_frontend import download_frontend_bundle

from _types import IaCModules, Environment
from lib import get_pulumi_stack_outputs, MAIN_SECRET_VERSION, construct_version_from_branch_and_sha, \
    construct_artifacts_dir, download_generic_artifacts_file, get_file_as_string, \
    format_version_to_comply_with_artifacts_version
from _common import add_select_environments_arguments, get_realm_environment_by_env_type, \
    write_config_to_pulumi_yml_file, get_realm_environment, get_environment_stack_configurations, \
    get_environment_environment_variables, compare_dict_keys


base_templates_dir = os.path.join(iac_folder, "templates")
templates_dir = os.path.join(iac_folder, "scripts", "_tmp")


def _download_templates(*,
                        realm_name: str,
                        deployment_number: str,
                        artifacts_version: str) -> None:
    """
    Download the templates necessary for this configuration.
    """
    formatted_artifacts_version = format_version_to_comply_with_artifacts_version(artifacts_version)
    realm_outputs = get_pulumi_stack_outputs(stack_name=realm_name, module="realm")
    realm_generic_repository = realm_outputs["generic_repository"].value

    current_templates_dir = construct_artifacts_dir(
        deployment_number=deployment_number,
        artifacts_version=formatted_artifacts_version)

    # artifacts dir, the folder to store the templates files.
    artifacts_destination_dir = os.path.join(templates_dir, current_templates_dir)
    os.makedirs(artifacts_destination_dir, exist_ok=False)

    download_generic_artifacts_file(
        repository=realm_generic_repository,
        output_dir=artifacts_destination_dir,
        version=formatted_artifacts_version,
        file_name="env.template",
    )

    download_generic_artifacts_file(
        repository=realm_generic_repository,
        output_dir=artifacts_destination_dir,
        version=formatted_artifacts_version,
        file_name="stack_config.template.yml",
    )


def _download_artifacts_and_config(_realm_name: str, _artifacts_version: str, _deployment_number: str):
    """
    Download the necessary configurations and artifacts.
    """

    _download_templates(
        realm_name=_realm_name,
        artifacts_version=_artifacts_version,
        deployment_number=_deployment_number)

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
    env_file_content = get_environment_environment_variables(stack_name, artifacts_version)

    # add environment variables to prepare the deployment.
    env_file_content += f"\nARTIFACTS_VERSION={artifacts_version}"
    env_file_content += f"\nDEPLOYMENT_RUN_NUMBER={deployment_run_number}"

    env_file_path = os.path.join(iac_folder, f".env.{stack_name}")
    with open(env_file_path, "w", encoding="utf-8") as file:
        file.write(env_file_content)

    print(f"Environment vars written to file: {env_file_path}")

    return env_file_path


def _prepare_environment_deployment(*,
                                    environment: Environment,
                                    deployment_run_number: str,
                                    artifacts_version: str):
    """
    Prepares the deployment of an environment
     -> creating the required yaml files for the environment in the sub iac-projects,
     -> and the .env file for the environment.
    """

    print(f"Preparing environment: {environment.stack_name}")

    # 1. Download the configs/Environment variables
    print("1. Downloading the configurations and environment variables")
    stack_configs = get_environment_stack_configurations(environment, artifacts_version)
    env_file_path = _prepare_env_file(environment.stack_name, deployment_run_number, artifacts_version)

    # 2. Compare the configs with the templates.

    env_vars_template = dotenv_values(os.path.join(base_templates_dir, "env.template"))

    env_vars_template["DEPLOYMENT_RUN_NUMBER"] = deployment_run_number
    env_vars_template["ARTIFACTS_VERSION"] = artifacts_version

    stack_config_template_value = get_file_as_string(os.path.join(base_templates_dir, "stack_config.template.yml"))
    stack_config_template = yaml.safe_load(stack_config_template_value)

    if not compare_dict_keys(stack_config_template, stack_configs.raw_config):
        raise ValueError("The stack config template does not match the stack config.")

    if not compare_dict_keys(env_vars_template, dotenv_values(env_file_path)):
        raise ValueError("The env vars template does not match the env vars.")

    # 2. Save the modules yaml configs.
    write_config_to_pulumi_yml_file(
        stack_name=environment.stack_name,
        module=IaCModules.ENVIRONMENT,
        content=stack_configs.environment.config)

    write_config_to_pulumi_yml_file(
        stack_name=environment.stack_name,
        module=IaCModules.AUTH,
        content=stack_configs.auth)

    write_config_to_pulumi_yml_file(
        stack_name=environment.stack_name,
        module=IaCModules.BACKEND,
        content=stack_configs.backend)

    write_config_to_pulumi_yml_file(
        stack_name=environment.stack_name,
        module=IaCModules.FRONTEND,
        content=stack_configs.frontend)

    write_config_to_pulumi_yml_file(
        stack_name=environment.stack_name,
        module=IaCModules.COMMON,
        content=stack_configs.common)

    write_config_to_pulumi_yml_file(
        stack_name=environment.stack_name,
        module=IaCModules.AWS_NS,
        content=stack_configs.aws_ns)

    print(f"Environment deployment prepared: {environment.stack_name}")


def _main(args):
    # get all the required stacks to prepare matching the criteria.
    realm_name = args.realm_name
    environment_name = args.env_name
    environment_type = args.env_type

    target_version = construct_version_from_branch_and_sha(args.target_git_branch, args.target_git_sha)

    # randomly get a deployment number
    # this is used if we have two parallel deployments
    # and the download artifacts and configurations, needs to be able to differentiate between the two
    # otherwise it would be very complicated to know if an ongoing download or not.
    deployment_number = uuid.uuid4().__str__()

    print(f"Preparing the deployment of version: {target_version}, deployment number: {deployment_number}")

    # Flow 1: prepare the deployment of an environment by realm name and environment name
    #          this happens if env_name was provided. (manual preparing)
    if environment_name is not None:
        # 1.1 Get the environment stack configuration
        target_environment = get_realm_environment(
            realm_name=realm_name,
            environment_name=environment_name)

        # 1.2 download the artifacts and configurations for the environment
        _download_artifacts_and_config(realm_name, target_version, deployment_number)

        # 1.3 prepare the deployment of the environment
        _prepare_environment_deployment(
            environment=target_environment,
            deployment_run_number=deployment_number,
            artifacts_version=target_version)

    # Flow 2: prepare the deployment of environments by realm name and environment type.
    #         This happens in the pipeline when we want to prepare all the environments of a certain type.
    if environment_type is not None:
        # 2.1 Get the target environments, all the environments of the given type in the realm.
        target_environments = get_realm_environment_by_env_type(
            realm_name=realm_name,
            env_type=environment_type)

        if len(target_environments) == 0:
            print(f"No environments found for realm: {realm_name} and env_type: {environment_type}")

        # 2.2 download the artifacts and configurations for the environments
        # given that we are deploying one artifact version, the download is done once.
        _download_artifacts_and_config(realm_name, target_version, deployment_number)

        # 2.3 prepare the deployment of each environment in the target list.
        for environment in target_environments:
            _prepare_environment_deployment(
                environment=environment,
                deployment_run_number=deployment_number,
                artifacts_version=target_version)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Prepares deployment of environment(s)"
    )

    # add the arguments to select multiple environments
    # a) by realm name and environment name
    # b) by realm name and environment type.
    add_select_environments_arguments(parser=parser)

    version_group = parser.add_argument_group(
        title="Artifacts/Configuration version",
        description="The inputs will be used to construct artifacts/config version ie: <branch-name>.<git-sha>. "
                    "Where some characters have been escaped to comply to naming conventions in the artifacts "
                    "repositories and secret IDs")

    version_group.add_argument(
        "--target-git-branch",
        type=str,
        required=True,
        default=MAIN_SECRET_VERSION,
        help=f"The target branch name. Default: {MAIN_SECRET_VERSION}"
    )

    version_group.add_argument(
        "--target-git-sha",
        type=str,
        required=True,
        help="The target git sha"
    )

    _main(parser.parse_args())
