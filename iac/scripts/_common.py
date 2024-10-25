import argparse
import os
import sys

import yaml

from typing import List, Mapping, Any
from dataclasses import dataclass

import pulumi.automation as auto
from google.cloud.secretmanager import SecretManagerServiceClient, AddSecretVersionRequest

from dotenv import dotenv_values

# Determine the absolute path to the 'iac' directory
iac_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, iac_dir)

from environment.env_types import EnvironmentTypes
from lib.std_pulumi import get_realm_and_env_name_from_stack, save_content_in_file, get_pulumi_stack_outputs


@dataclass
class StackConfigs:
    realm_name: str

    stack_name: str
    env_name: str
    env_type: str
    deployment_type: str

    environment: Mapping[str, Any]
    auth: Mapping[str, Any]
    backend: Mapping[str, Any]
    frontend: Mapping[str, Any]
    common: Mapping[str, Any]
    aws_ns: Mapping[str, Any]

    @staticmethod
    def from_dict(env_config_dict: dict) -> "StackConfigs":
        """
        Creates an Environment Config object from the yml config.
        If some of the fields in the config dict are not present, it will raise an error.

        :param env_config_dict: The environment configuration dictionary.
        :return:
        """

        # Please use ["key"] instead of .get("key") to avoid None values.
        # So that we ensure keys are available in the config dict, otherwise raise an error.

        _stack_name = env_config_dict["stack_name"]
        realm_name, env_name = get_realm_and_env_name_from_stack(_stack_name)
        environment_config = env_config_dict["environment"]["config"]

        return StackConfigs(
            realm_name=realm_name,
            stack_name=_stack_name,
            env_name=env_name,
            env_type=environment_config["environment_type"],
            deployment_type=environment_config["deployment_type"],
            environment=env_config_dict["environment"],
            auth=env_config_dict["auth"],
            backend=env_config_dict["backend"],
            frontend=env_config_dict["frontend"],
            common=env_config_dict["common"],
            aws_ns=env_config_dict["aws-ns"]
        )


# =======================
# Pulumi Actions
# =======================

def run_pulumi_up(stack_name: str, module: str):
    """
    Run pulumi up for the given stack and workspace.
    """
    print(f"Running pulumi up on stack: {stack_name}/{module}")
    stack_project_path = os.path.join(iac_dir, module)

    stack = auto.create_or_select_stack(
        work_dir=stack_project_path,
        stack_name=stack_name,
    )

    up_results = stack.up(
        color="always",
        on_output=print,
    )

    return up_results


def run_pulumi_destroy(stack_name: str, module: str):
    """
    Run pulumi destroy for the given stack and workspace.
    """

    print(f"Running pulumi destroy on stack: {stack_name}/{module}")
    stack_project_path = os.path.join(iac_dir, module)

    stack = auto.create_or_select_stack(
        work_dir=stack_project_path,
        stack_name=stack_name,
    )

    stack.destroy(
        color="always",
        remove=True,
        on_output=print,
    )


# =======================
# Files Actions
# =======================

def write_config_to_pulumi_yml_file(*, stack_name: str, module: str, content: Mapping[str, Any]):
    """
    Write the stack configuration to the pulumi yaml file (Pulumi.{stack_name}.yaml).
    """
    file_path = os.path.join(iac_dir, module, f"Pulumi.{stack_name}.yaml")
    with open(file_path, "w", encoding="utf-8") as file:
        yaml.dump(content, file, default_flow_style=False, allow_unicode=True)
    print(f"Pulumi config written to file: {file_path}")


def upsert_env_file_variable(env_file_path: str, variable_name: str, variable_value: str):
    """
    Upsert the variable value in the .env file.
    """

    current_values = dotenv_values(env_file_path)

    # keep the env file content
    with open(env_file_path, "r") as file:
        env_file_content = file.read()

    # if it is the same value do not change anything
    if current_values.get(variable_name) == variable_value:
        return

    # if the value is not there, set it
    if not current_values.get(variable_name):
        current_values[variable_name] = variable_value
        with open(env_file_path, "a") as file:
            file.write(f"{variable_name}={variable_value}\n")


    # if the value is different, update it
    else:
        env_file_content = env_file_content.replace(f"{variable_name}={current_values[variable_name]}",
                                                    f"{variable_name}={variable_value}")
        save_content_in_file(env_file_path, env_file_content)


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

    latest_secret_name = f"{secret_name}/versions/latest"
    secret_value = secret_manager_service.access_secret_version(
        name=latest_secret_name
    )

    return secret_value.payload.data.decode("utf-8")


def upload_environment_secrets_to_secret_manager(*, secret_name: str, env_file_path: str):
    # Upload the .env file to the secret manager of the environment's project.
    with open(env_file_path, "r", encoding="utf-8") as file:
        env_file_content = file.read()

    secrets_service = SecretManagerServiceClient()
    secrets_service.add_secret_version(request=AddSecretVersionRequest(
        parent=secret_name,
        payload={"data": env_file_content.encode("utf-8")}
    ))


# =======================
# Environment Stacks Config Actions
# =======================

def download_ream_environments_configs(realm_name: str) -> List[StackConfigs]:
    """
    Download the environments configurations for the realm from the realm's secrets.

    :param realm_name: The realm name
    :return: An array of environment configurations for the environments. If no environment configuration is found, an empty array is returned.
    """

    # get the realm environments configurations from the realm's secrets.
    realm_outputs = get_pulumi_stack_outputs(realm_name, "realm")
    stack_config_secret_output = realm_outputs["stack_config_secret"]
    stack_config_value = get_secret_latest_version(stack_config_secret_output.value)

    # convert the stack config value to a dictionary.
    realm_stacks_dict = yaml.safe_load(stack_config_value)

    # Create the stack objects from the realm stacks dict.
    environments = []
    for stack_dict in realm_stacks_dict["stacks"]:
        stack = StackConfigs.from_dict(stack_dict)
        environments.append(stack)

    return environments


def get_environment_stack_config(realm_name: str, env_name: str) -> StackConfigs:
    """
    Get the environment stack configurations for the given environment from the realm's secrets.

    :param realm_name: The realm name
    :param env_name:  The environment name to get the configuration for.
    :return: The environment configuration for the environment.
    """

    realm_environments_config = download_ream_environments_configs(realm_name)
    for environment in realm_environments_config:
        if environment.env_name == env_name:
            return environment

    raise ValueError(f"No environment config found for the environment {env_name} in the realm {realm_name}.")


def get_environment_stack_configs_by_env_type(realm_name: str, env_type: str) -> list[StackConfigs]:
    """
    Get the environments configurations by environment types from the realm's secrets.

    :param realm_name: The realm name
    :param env_type:  The environment type to use to filter the environments.
    :return: An array of environment configurations for the environments. If no environment configuration is found, an empty array is returned.
    """

    realm_environments_config = download_ream_environments_configs(realm_name)
    environments = []
    for environment in realm_environments_config:
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
