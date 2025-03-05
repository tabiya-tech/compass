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

from _types import IaCModules, StackConfigs, Environment, DeploymentType, Secret
from environment.env_types import EnvironmentTypes
from lib import MAIN_SECRET_VERSION, get_pulumi_stack_outputs, STACK_CONFIG_SECRET_PREFIX, \
    ENV_VARS_SECRET_PREFIX, Version
from scripts.formatters import construct_secret_id


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

def write_config_to_pulumi_yaml_file(*, stack_name: str, module: IaCModules, content: Mapping[str, Any]):
    """
    Write the stack configuration to the pulumi yaml file (Pulumi.{stack_name}.yaml).
    """
    pulumi_yaml_file_path = os.path.join(iac_dir, module.value, f"Pulumi.{stack_name}.yaml")
    with open(pulumi_yaml_file_path, "w", encoding="utf-8") as file:
        yaml.dump(content, file, default_flow_style=False, allow_unicode=True)
    print(f"Pulumi config written to file: {pulumi_yaml_file_path}")


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

    secret_name = f"{full_project_name}/secrets/{secret_name}"
    try:
        secret_value = _get_latest_secret_value(secret_name)
        print(f"info: Successfully got the secret value: {secret_name}")
        return secret_value
    except NotFound as e:
        print(f"Failed to get the secret value: {secret_name}")
        print("warning: ", e.message)
        return None
    except PermissionDenied as e:
        print(f"Failed to get the secret value: {secret_name}")
        print("warning: ", e.message)
        return None


def _get_latest_secret_value(secret_name: str) -> AccessSecretVersionResponse:
    secret_manager_service = SecretManagerServiceClient()
    secret = secret_manager_service.access_secret_version(
        name=f"{secret_name}/versions/latest"
    )
    return secret


def get_versioned_secret_latest_value(secret_name: str, project_id: str, artifacts_version: Version) -> Secret:
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

    :return: The secret object
    """

    projects_service = ProjectsClient()
    # get the project number from the project id.
    project_number = projects_service.get_project(name=f"projects/{project_id}")

    # Check if the secret exists by using fully the config version.
    # This is the case when the full config version is provided
    # eg: main, <branch_tag_name>, <branch_tag_name>.<sha>.
    fully_qualified_secret_name = construct_secret_id(
        prefix=secret_name,
        git_branch_name=artifacts_version.git_branch_name,
        git_sha=artifacts_version.git_sha
    )

    secret_value = _get_secret_value(project_number.name, fully_qualified_secret_name)

    # The next step is to only get the ref name and see if at least we have a secret version for it.
    # Only find for ref name if ref name and sha exists, otherwise we have already done it in the previous step.
    if artifacts_version.git_branch_name and artifacts_version.git_sha and not secret_value:
        fully_qualified_secret_name = construct_secret_id(
            prefix=secret_name,
            git_branch_name=artifacts_version.git_branch_name,
        )
        secret_value = _get_secret_value(project_number.name, fully_qualified_secret_name)

    # if the ref name is not available, let us get the main version.
    if not secret_value:
        fully_qualified_secret_name = construct_secret_id(
            prefix=secret_name,
            git_branch_name=MAIN_SECRET_VERSION,
        )

        secret_value = _get_secret_value(project_number.name, fully_qualified_secret_name)

        # at this time no secret value for the main version, so we raise an error, to stop the pipeline.
        if secret_value is None:
            raise ValueError(f"secret projects/{project_id} secrets/{secret_name}.* version/latest does not exist")

    return Secret(
        value=secret_value.payload.data.decode("utf-8"),
        name=secret_value.name
    )


# =======================
# Environment/Stack Configs Actions
# =======================

def get_environments_in_realm(realm_name: str) -> List[Environment]:
    """
    Gets the environments in a realm.

    :param realm_name: The realm name
    :return: An array of environments in the current realm name.
    """

    print(f"Fetching the environments under the realm:{realm_name}")

    # get the realm environments configurations from the realm's secrets.
    realm_outputs = get_pulumi_stack_outputs(realm_name, IaCModules.REALM.value)
    realm_config_secret = realm_outputs["environments_config_secret_name"].value
    realm_environments_config = _get_latest_secret_value(realm_config_secret)
    decoded_realm_environments_config = realm_environments_config.payload.data.decode("utf-8")

    # convert the stack config value to a dictionary.
    realm_environments_config_dict = yaml.safe_load(decoded_realm_environments_config)

    # Create the environments objects from the realm environment config dict
    # Each environment should have a matching pattern to the "Environments" type.

    realm_environments = []
    for environment_dict in realm_environments_config_dict["environments"]:
        environment = Environment.from_dict(realm_name, environment_dict)
        realm_environments.append(environment)

    return realm_environments


def get_realm_environment(realm_name: str, environment_name: str):
    """
    Get the environment by realm name and environment name.
    :param realm_name: The realm name
    :param environment_name: The environment name
    :return: The environment object if found, otherwise None.
    """

    environments = get_environments_in_realm(realm_name)

    for environment in environments:
        if environment.environment_name == environment_name:
            return environment

    return None


def get_environment_stack_configurations(stack_name: str, version: Version) -> Secret:
    """
    Gets the stacks configurations for a given environment.
    """

    environment_stack_outputs = get_pulumi_stack_outputs(stack_name, IaCModules.ENVIRONMENT.value)
    environment_project_id = environment_stack_outputs["project_id"].value
    stack_configs_secret = get_versioned_secret_latest_value(
        STACK_CONFIG_SECRET_PREFIX, environment_project_id, version)

    return stack_configs_secret


def get_environment_environment_variables(stack_name: str, version: Version) -> Secret:
    """
    Get the environment variables for the given environment.
    """

    environment_stack_outputs = get_pulumi_stack_outputs(stack_name, IaCModules.ENVIRONMENT.value)
    environment_project_id = environment_stack_outputs["project_id"].value

    env_vars_secret = get_versioned_secret_latest_value(
        ENV_VARS_SECRET_PREFIX, environment_project_id, version)

    return env_vars_secret


def _get_realm_environment_by_env_type(
        realm_name: str,
        env_type: EnvironmentTypes) -> list[Environment]:
    """
    Get the environments by environment type from the realm's secrets.
    :param realm_name: The realm name
    :param env_type: The environment type
    :return: The list of environments that match the environment type, if any. Otherwise, an empty list.
    """

    realm_environments = get_environments_in_realm(realm_name)

    target_environments = []
    for environment in realm_environments:
        if environment.environment_type == env_type and environment.deployment_type == DeploymentType.AUTO:
            target_environments.append(environment)

    return target_environments


def find_environments(*,
                      realm_name: str,
                      environment_name: str | None,
                      environment_type: EnvironmentTypes | None) -> list[Environment]:
    """
    Find the environments that match the selection criteria.
    :param realm_name: The realm name
    :param environment_name: The environment name
    :param environment_type: The environment type
    :return: The list of environments that match the selection criteria, if any. Otherwise, an empty list.
    """

    # Get the environments that match the selection criteria.
    targeted_environments: list[Environment] = []

    if environment_name is not None:
        # Prepare the deployment of an environment by realm name and environment name
        found_environment = get_realm_environment(
            realm_name=realm_name,
            environment_name=environment_name)
        if found_environment is not None:
            targeted_environments.append(found_environment)
        else:
            print(f"warning: No environment found for realm: {realm_name} and env_name: {environment_name}")

    if environment_type is not None:
        # Prepare the deployment of environments by realm name and environment type
        found_environments: list[Environment] = _get_realm_environment_by_env_type(
            realm_name=realm_name,
            env_type=environment_type)
        if len(found_environments) != 0:
            targeted_environments = targeted_environments + found_environments
        else:
            print(f"warning: No environments found for realm: {realm_name} and env_type: {environment_type}")

    return targeted_environments


# =======================
# Adding arguments actions
# =======================


def add_select_environment_arguments(*, parser: argparse.ArgumentParser):
    """
    Adds the arguments to select only one environment on the parser.
    """

    group = parser.add_argument_group(
        title="Select one environment",
        description="Select the environment to set up by providing the realm name and the environment name."
    )

    group.add_argument(
        "--realm-name",
        type=str,
        required=True,
        help="The realm name"
    )

    group.add_argument(
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

    args_group = parser.add_argument_group(
        title="Select environment(s)",
        description="Select the environment(s) to set up by providing the "
                    "- realm name and "
                    "- either the environment name or the environment type.")

    args_group.add_argument(
        "--realm-name",
        type=str,
        required=True,
        help="The realm name"
    )

    group = args_group.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--env-name",
        type=str,
        default=None,
        nargs="?",  # allows the argument to be provided without a value, and it is set to None.
        help="The environment name"
    )

    group.add_argument(
        "--env-type",
        type=EnvironmentTypes,
        default=None,
        nargs="?",  # allows the argument to be provided without a value, and it is set to None.
        choices=[env_type for env_type in EnvironmentTypes],
        help="The environment type"
    )


def compare_dict_keys(dict1: dict, dict2: dict, parent: str = "root"):
    """
    Compare the keys of two dictionaries.
    If the value is also a dict it will compare the keys of the nested dict.
    """

    try:
        if dict1.keys() != dict2.keys():
            # keys in dict 1 that are not in dict 2
            print(f"Error: Keys in {parent} that are not in dict2: {list(dict1.keys() - dict2.keys())}")
            # keys in dict 2 that are not in dict 1
            print(f"Error: Keys in {parent} that are not in dict1: {list(dict2.keys() - dict1.keys())}")
            return False

        for key in dict1.keys():
            if isinstance(dict1[key], dict) or isinstance(dict2[key], dict):
                if not compare_dict_keys(dict1[key], dict2[key], f"{parent}.{key}"):
                    return False

        return True
    except Exception as e:
        print("Error: ", str(e))
        return False
