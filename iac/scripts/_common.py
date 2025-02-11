import argparse
import os
import sys

import yaml

from typing import List, Mapping, Any, Optional

import pulumi.automation as auto
from google.cloud.secretmanager import SecretManagerServiceClient, AccessSecretVersionResponse
from google.api_core.exceptions import NotFound, PermissionDenied
from google.cloud.resourcemanager import ProjectsClient


# Determine the absolute path to the 'iac' directory
iac_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, iac_dir)

from _types import IaCModules, StackConfigs
from environment.env_types import EnvironmentTypes
from lib import get_ref_name_and_sha_from_artifacts_version, MAIN_SECRET_VERSION, get_formatted_secret_id, \
    get_pulumi_stack_outputs


# =======================
# Pulumi Actions
# =======================

def run_pulumi_up(stack_name: str, module: IaCModules):
    """
    Run pulumi up for the given stack
    """

    print(f"Running pulumi up on stack: {stack_name}/{module.value} .....")

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

def _get_secret_value(full_project_name: str, secret_name: str) -> Optional[AccessSecretVersionResponse]:
    """
    Function to return optionally the secret value if it exists, otherwise None
    if the secret exists but no version available, the function will return None.

    :param full_project_name: The project name, in a format 'projects/{project id}'
    :param secret_name: The full secret name.
    :return:
    """

    secret_manager_service = SecretManagerServiceClient()
    secret_name = f"{full_project_name}/secrets/{secret_name}/versions/latest"
    print('info: getting the secret value:', secret_name)

    try:
        secret_value = secret_manager_service.access_secret_version(name=secret_name)
        return secret_value
    except NotFound as e:
        print(f"Failed to get the secret value: {secret_name}")
        print("warning: ", e.message)
        return None
    except PermissionDenied as e:
        print(f"Failed to get the secret value: {secret_name}")
        print("warning: ", e.message)
        return None


def get_versioned_secret_latest_value(secret_name: str, project_id: str, artifacts_version: Optional[str]) -> str:
    """
    Get the version of the secret from the secret manager based on the config version.
    This is a special case when we have a versioned secret.

    Given:
        given secret_name: 'foo'
        and project_id: 'bar-project-d' with project number 123
        and config version is  'bar'.

        The function will try to get the secret value for the
        'projects/123/secrets/foo.bar/versions/latest'.

    It will start by checking the full artifacts version,
    if no value present, it will try to get the secret value for the ref name only.
    If no value for the ref name, it will try to get the secret value for the main version.
    Otherwise, it will raise an error.

    :param project_id: The project id
    :param artifacts_version: The version of the artifacts.
    :param secret_name: The secret name.
    :return:
    """

    projects_service = ProjectsClient()
    # get the project number from the project id.
    project_number = projects_service.get_project(name=f"projects/{project_id}")

    # Check if the secret exists by using fully the config version.
    # This is the case when the full config version is provided
    # eg: main, <branch_tag_name>, <branch_tag_name>.<sha>.
    fully_qualified_secret_name = get_formatted_secret_id(secret_name, artifacts_version)
    secret_value = _get_secret_value(project_number.name, fully_qualified_secret_name)

    # The next step is to only get the ref name and see if at least we have a secret version for it.
    # Only find for ref name if ref name and sha exists, otherwise we have already done it in the previous step.
    ref_name, sha = get_ref_name_and_sha_from_artifacts_version(artifacts_version)
    if ref_name and sha and not secret_value:
        fully_qualified_secret_name = get_formatted_secret_id(secret_name, ref_name)
        secret_value = _get_secret_value(project_number.name, fully_qualified_secret_name)

    # if the ref name is not available, let us get the main version.
    if not secret_value:
        fully_qualified_secret_name = get_formatted_secret_id(secret_name, MAIN_SECRET_VERSION)
        secret_value = _get_secret_value(project_number.name, fully_qualified_secret_name)

        # at this time no secret value for the main version, so we raise an error, to stop the pipeline.
        if secret_value is None:
            raise ValueError(f"secret projects/{project_id} secrets/{secret_name}.* version/latest does not exist")

    return secret_value.payload.data.decode("utf-8")


# =======================
# Environment/Stack Configs Actions
# =======================

def download_realm_environments_configs(realm_name: str, config_version: Optional[str]) -> List[StackConfigs]:
    """
    Download the realm -> environments -> stack configurations.

    :param realm_name: The realm name :return: An array of environment configurations for the environments. If no
                        environment configuration is found, an empty array is returned.

    :param config_version: The config version to use to download the realm environments configurations,
                           simply same as the artifact version.
    """
    print(f"Downloading the realm {realm_name} environments configurations version:{config_version}...")

    # get the realm environments configurations from the realm's secrets.
    realm_outputs = get_pulumi_stack_outputs(realm_name, "realm")
    realm_root_project_id = realm_outputs["root_project_id"].value
    stack_configs = get_versioned_secret_latest_value("stack-config", realm_root_project_id, config_version)

    # convert the stack config value to a dictionary.
    realm_stacks_cfgs_dict = yaml.safe_load(stack_configs)

    # Create the stack objects from the realm stacks dict.
    environments = []
    for stack_dict in realm_stacks_cfgs_dict["stacks"]:
        stack = StackConfigs.from_dict(stack_dict)
        environments.append(stack)

    return environments


def get_environment_stack_config(realm_name: str, environment_name: str, config_version: Optional[str]) -> StackConfigs:
    """
    Get the environment stack configurations for the given environment from the realm's secrets.

    :param realm_name: The realm name
    :param environment_name:  The environment name to get the configuration for.
    :param config_version: The config version to use to download the realm environments configurations,
    :return: The environment configuration for the environment.
    """

    realm_environments_configs = download_realm_environments_configs(realm_name, config_version)
    for environment in realm_environments_configs:
        if environment.env_name == environment_name:
            return environment

    raise ValueError(f"No environment config found for the environment {environment_name} in the realm {realm_name}.")


def get_environment_stack_configs_by_env_type(
        realm_name: str,
        env_type: str,
        config_version: str) -> list[StackConfigs]:
    """
    Get the environments configurations by environment types from the realm's secrets.

    :param env_type: The environment type.
    :param realm_name: The realm name :param env_type:  The environment type to use to filter the environments.
    :param config_version: The config version to use to download the realm environments configurations,
    :return: An array of environment configurations for the environments. If no environment configuration is found,
             an empty array is returned.
    """

    realm_environments_configs = download_realm_environments_configs(realm_name, config_version)
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
