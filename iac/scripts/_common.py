import argparse
import os
import sys

import yaml

from typing import List, Mapping, Any

import pulumi.automation as auto
from google.cloud.secretmanager import SecretManagerServiceClient, AddSecretVersionRequest

# Determine the absolute path to the 'iac' directory
iac_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, iac_dir)

from environment.env_types import EnvironmentTypes
from lib.std_pulumi import get_pulumi_stack_outputs
from _types import IaCModules, StackConfigs


# =======================
# Pulumi Actions
# =======================

def run_pulumi_up(stack_name: str, module: IaCModules):
    """
    Run pulumi up for the given stack
    """

    print(f"Running pulumi up on stack: {stack_name}/{module.value}")

    stack_work_dir = os.path.join(iac_dir, module.value)

    stack = auto.create_or_select_stack(
        work_dir=stack_work_dir,
        stack_name=stack_name,
    )

    up_results = stack.up(
        color="always",
        on_output=print,
    )

    return up_results


def run_pulumi_destroy(stack_name: str, module: IaCModules):
    """
    Run pulumi destroy for the given stack
    """

    print(f"Running pulumi destroy on stack: {stack_name}/{module.value}")

    stack_work_dir = os.path.join(iac_dir, module.value)

    stack = auto.create_or_select_stack(
        work_dir=stack_work_dir,
        stack_name=stack_name,
    )

    destroy_result = stack.destroy(
        color="always",
        # remove the pulumi stack after destroying it, and delete the local yaml config file.
        remove=True,
        on_output=print,
    )

    return destroy_result


# =======================
# Files Actions
# =======================

def write_config_to_pulumi_yml_file(*, stack_name: str, module: IaCModules, content: Mapping[str, Any]):
    """
    Write the stack configuration to the pulumi yaml file (Pulumi.{stack_name}.yaml).
    """
    pulumi_yml_file_path = os.path.join(iac_dir, module.value, f"Pulumi.{stack_name}.yaml")
    with open(pulumi_yml_file_path, "w", encoding="utf-8") as file:
        yaml.dump(content, file, default_flow_style=False, allow_unicode=True)
    print(f"Pulumi config written to file: {pulumi_yml_file_path}")


# =======================
# Secrets Actions
# =======================

def get_secret_latest_version(secret_name: str) -> str:
    """
    Get the latest version of the secret from the secret manager.

    :param secret_name: The secret name
    :return:
    """
    secret_manager_service = SecretManagerServiceClient()

    latest_secret_version_name = f"{secret_name}/versions/latest"
    print("Getting the latest secret version: ", latest_secret_version_name)
    secret_value = secret_manager_service.access_secret_version(
        name=latest_secret_version_name
    )

    return secret_value.payload.data.decode("utf-8")


def upload_env_file_content_to_sm(*, secret_name: str, env_file_path: str):
    """
    Upload the .env file to the secret manager.
    """

    print(f"uploading the .env file to the secret manager... on secret: {secret_name} from file: {env_file_path}")

    # Upload the .env file to the secret manager of the environment's project.
    with open(env_file_path, "r", encoding="utf-8") as file:
        env_file_content = file.read()

    secrets_service = SecretManagerServiceClient()
    secrets_service.add_secret_version(request=AddSecretVersionRequest(
        parent=secret_name,
        payload={"data": env_file_content.encode("utf-8")}
    ))


# =======================
# Environment/Stack Configs Actions
# =======================

def download_ream_environments_configs(realm_name: str) -> List[StackConfigs]:
    """
    Download the realm -> environments -> stack configurations.

    :param realm_name: The realm name :return: An array of environment configurations for the environments. If no
                        environment configuration is found, an empty array is returned.
    """
    print(f"Downloading the realm {realm_name} environments configurations...")

    # get the realm environments configurations from the realm's secrets.
    realm_outputs = get_pulumi_stack_outputs(realm_name, "realm")
    stack_config_secret_output = realm_outputs["stack_config_secret"]
    latest_stack_config_value = get_secret_latest_version(stack_config_secret_output.value)

    # convert the stack config value to a dictionary.
    realm_stacks_cfgs_dict = yaml.safe_load(latest_stack_config_value)

    # Create the stack objects from the realm stacks dict.
    environments = []
    for stack_dict in realm_stacks_cfgs_dict["stacks"]:
        stack = StackConfigs.from_dict(stack_dict)
        environments.append(stack)

    return environments


def get_environment_stack_config(realm_name: str, environment_name: str) -> StackConfigs:
    """
    Get the environment stack configurations for the given environment from the realm's secrets.

    :param realm_name: The realm name
    :param environment_name:  The environment name to get the configuration for.
    :return: The environment configuration for the environment.
    """

    realm_environments_configs = download_ream_environments_configs(realm_name)
    for environment in realm_environments_configs:
        if environment.env_name == environment_name:
            return environment

    raise ValueError(f"No environment config found for the environment {environment_name} in the realm {realm_name}.")


def get_environment_stack_configs_by_env_type(realm_name: str, env_type: str) -> list[StackConfigs]:
    """
    Get the environments configurations by environment types from the realm's secrets.

    :param env_type: The environment type.
    :param realm_name: The realm name :param env_type:  The environment type to use to filter the environments.
    :return: An array of environment configurations for the environments. If no environment configuration is found,
             an empty array is returned.
    """

    realm_environments_configs = download_ream_environments_configs(realm_name)
    environments = []
    for environment in realm_environments_configs:
        if environment.env_type == env_type and environment.deployment_type == "auto":
            environments.append(environment)

    return environments


# =======================
# Adding arguments actions
# =======================

def add_select_environment_arguments(*, parser: argparse.ArgumentParser):
    """
    Adds the arguments to select only one environment on the parser.
    """

    parser.add_argument(
        "--realm-name",
        type=str,
        required=True,
        help="The realm name"
    )

    parser.add_argument(
        '--env-name',
        type=str,
        required=True,
        help="The environment name"
    )


def add_select_environments_arguments(*, parser: argparse.ArgumentParser):
    """
    Adds the arguments to select environments
        a) by environment name
        b) by environment type.
    """

    parser.add_argument(
        "--realm-name",
        type=str,
        required=True,
        help="The realm name"
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--env-name",
        type=str,
        default=None,
        nargs="?",  # allows the argument to be provided without a value, and it is set to None.
        help="The environment name"
    )

    group.add_argument(
        "--env-type",
        type=str,
        default=None,
        nargs="?",  # allows the argument to be provided without a value, and it is set to None.
        choices=[env_type.value for env_type in EnvironmentTypes],
        help="The environment type"
    )
