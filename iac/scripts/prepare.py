#!/usr/bin/env python3

import os
import sys
import uuid
import datetime
from textwrap import dedent

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

from environment.env_types import EnvironmentTypes
from _types import IaCModules, Environment, StackConfigs
from scripts.formatters import construct_artifacts_version
from lib import get_pulumi_stack_outputs, MAIN_SECRET_VERSION, construct_artifacts_dir, \
    download_generic_artifacts_file, get_file_as_string, Version
from _common import add_select_environments_arguments, write_config_to_pulumi_yaml_file, \
    get_environment_stack_configurations, get_environment_environment_variables, compare_dict_keys, find_environments


base_templates_dir = os.path.join(iac_folder, "templates")
templates_dir = os.path.join(iac_folder, "scripts", "_tmp")
environment_variables_added_by_the_script = ["DEPLOYMENT_RUN_NUMBER", "TARGET_GIT_BRANCH_NAME",
                                             "TARGET_GIT_SHA", "PREPARE_TIME", "ENV_VARS_SECRETS_PATH",
                                             "STACK_CONFIG_SECRET_PATH"]


def _download_templates(*,
                        realm_name: str,
                        deployment_number: str,
                        version: Version) -> None:
    """
    Download the templates necessary for this configuration.
    """
    formatted_artifacts_version = construct_artifacts_version(
        git_branch_name=version.git_branch_name,
        git_sha=version.git_sha
    )

    realm_outputs = get_pulumi_stack_outputs(stack_name=realm_name, module="realm")
    realm_generic_repository = realm_outputs["generic_repository"].value

    current_templates_dir = construct_artifacts_dir(
        deployment_number=deployment_number,
        fully_qualified_version=formatted_artifacts_version)

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
        file_name="stack_config.template.yaml",
    )


def _download_artifacts_and_config(_realm_name: str, _artifacts_version: Version, _deployment_number: str):
    """
    Download the necessary configurations and artifacts.
    """

    _download_templates(
        realm_name=_realm_name,
        version=_artifacts_version,
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


def _prepare_env_file(
        stack_name: str,
        deployment_run_number: str,
        artifacts_version: Version):
    env_file_content_secret = get_environment_environment_variables(stack_name, artifacts_version)
    stack_configs_secret = get_environment_stack_configurations(stack_name, artifacts_version)

    # add environment variables to prepare the deployment.
    env_file_content = env_file_content_secret.value
    env_file_content += dedent(f'''\n
        ######################
        # Added by prepare.py
        ######################
        TARGET_GIT_BRANCH_NAME={artifacts_version.git_branch_name}
        TARGET_GIT_SHA={artifacts_version.git_sha}
        DEPLOYMENT_RUN_NUMBER={deployment_run_number}
        
        # Configurations used details.
        PREPARE_TIME={datetime.datetime.now(tz=datetime.timezone.utc).isoformat()}
        ENV_VARS_SECRETS_PATH={env_file_content_secret.name}
        STACK_CONFIG_SECRET_PATH={stack_configs_secret.name}
        ''')
    env_file_path = os.path.join(iac_folder, f".env.{stack_name}")
    with open(env_file_path, "w", encoding="utf-8") as file:
        file.write(env_file_content)

    print(f"Environment vars written to file: {env_file_path}")

    return env_file_path


def _prepare_environment_deployment(*,
                                    environment: Environment,
                                    deployment_run_number: str,
                                    artifacts_version: Version):
    """
    Prepares the deployment of an environment
     -> creating the required yaml files for the environment in the sub iac-projects,
     -> and the .env file for the environment.
    """

    print(f"info: Preparing environment: {environment.stack_name}")

    # 1. Download the configs/Environment variables
    print("info: Downloading the configurations and environment variables")
    stack_configs_secret = get_environment_stack_configurations(environment.stack_name, artifacts_version)
    stack_configs = StackConfigs.from_dict(environment, yaml.safe_load(stack_configs_secret.value))

    env_file_path = _prepare_env_file(
        environment.stack_name,
        deployment_run_number,
        artifacts_version,
    )

    # 2. Compare the configs with the templates.

    env_vars_template = dotenv_values(os.path.join(base_templates_dir, "env.template"))

    # Remove keys that are added by prepare.py
    env_values = dotenv_values(env_file_path)
    for key in environment_variables_added_by_the_script:
        env_values.pop(key)

    stack_config_template_value = get_file_as_string(os.path.join(base_templates_dir, "stack_config.template.yaml"))
    stack_config_template = yaml.safe_load(stack_config_template_value)

    if not compare_dict_keys(stack_config_template, stack_configs.raw_config):
        raise ValueError("The stack config template does not match the stack config.")
    else:
        print("info: stack config template matches the stack config.")

    if not compare_dict_keys(env_vars_template, env_values):
        raise ValueError("The env vars template does not match the env vars.")
    else:
        print("info: env vars template matches the env vars.")

    # 2. Save the modules yaml configs.
    write_config_to_pulumi_yaml_file(
        stack_name=environment.stack_name,
        module=IaCModules.ENVIRONMENT,
        content=stack_configs.environment.config)

    write_config_to_pulumi_yaml_file(
        stack_name=environment.stack_name,
        module=IaCModules.DNS,
        content=stack_configs.dns)

    write_config_to_pulumi_yaml_file(
        stack_name=environment.stack_name,
        module=IaCModules.AUTH,
        content=stack_configs.auth)

    write_config_to_pulumi_yaml_file(
        stack_name=environment.stack_name,
        module=IaCModules.BACKEND,
        content=stack_configs.backend)

    write_config_to_pulumi_yaml_file(
        stack_name=environment.stack_name,
        module=IaCModules.FRONTEND,
        content=stack_configs.frontend)

    write_config_to_pulumi_yaml_file(
        stack_name=environment.stack_name,
        module=IaCModules.COMMON,
        content=stack_configs.common)

    print(f"Environment deployment prepared: {environment.stack_name}")


def _main(*, realm_name: str, env_name: str, env_type: EnvironmentTypes, target_git_branch: str, target_git_sha: str):
    # get all the required stacks to prepare matching the criteria.

    # Get the environments that match the selection criteria.
    targeted_environments: list[Environment] = find_environments(realm_name=realm_name,
                                                                 environment_name=env_name,
                                                                 environment_type=env_type)

    if len(targeted_environments) == 0:
        print(f"error: No environments found to prepare for the given selection criteria "
              f"environment_name: {realm_name}, environment_type: {env_name} "
              f"in realm: {env_type}")
        exit(1)

    # Download the artifacts and configurations for version to be deployed.
    target_version = Version(
        git_branch_name=target_git_branch,
        git_sha=target_git_sha
    )
    # Generate a random deployment id and store it in the environment variables.
    # This ensures the relevant artifacts and configurations are downloaded
    # and prepared for the correct deployment run, if different deployments occur concurrently,
    deployment_number = uuid.uuid4().__str__()

    print(f"Preparing the deployment of version: {target_version}, deployment number: {deployment_number}")
    _download_artifacts_and_config(realm_name, target_version, deployment_number)

    # 2.3 prepare the deployment of each environment in the target list.
    for environment in targeted_environments:
        _prepare_environment_deployment(
            environment=environment,
            deployment_run_number=deployment_number,
            artifacts_version=target_version)


if __name__ == "__main__":
    # enable_debugger(5678)
    parser = argparse.ArgumentParser(
        formatter_class=argparse.RawTextHelpFormatter,
        description="Prepares deployment of environment(s)"
    )

    # add the arguments to select multiple environments
    # a) by realm name and environment name
    # b) by realm name and environment type.
    add_select_environments_arguments(parser=parser)

    version_group = parser.add_argument_group(
        title="Artifacts/Configuration version",
        description="- The inputs will be used to construct artifacts/config version ie: <branch-name>.<git-sha>.\n"
                    "- Where some characters have been escaped to comply to naming conventions in the artifacts "
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
    args = parser.parse_args()
    _main(realm_name=args.realm_name,
          env_name=args.env_name,
          env_type=args.env_type,
          target_git_branch=args.target_git_branch,
          target_git_sha=args.target_git_sha)
