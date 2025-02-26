#!/usr/bin/env python3

import os
import sys
import argparse
from datetime import date

from google.cloud.secretmanager import SecretManagerServiceClient, AddSecretVersionRequest, GetSecretRequest, \
    CreateSecretRequest, Secret
from google.api_core.exceptions import NotFound

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, libs_dir)

from _types import IaCModules
from scripts.formatters import construct_secret_id
from lib import get_stack_name_from, MAIN_SECRET_VERSION, ENV_VARS_SECRET_PREFIX, STACK_CONFIG_SECRET_PREFIX, Version
from _common import add_select_environment_arguments, \
    write_config_to_pulumi_yaml_file, run_pulumi_up, get_realm_environment


def _upload_file_to_secret_manager(
        *,
        project_number: str,
        secret_prefix: str,
        version: Version,
        file_path: str,
        expire_time: str):
    """
    Upload the file to the secret manager.
    """

    secrets_service = SecretManagerServiceClient()

    # 1. Construct the valid secret id.
    formatted_secret_id = construct_secret_id(
        prefix=secret_prefix,
        git_branch_name=version.git_branch_name,
        git_sha=version.git_sha
    )

    full_qualified_secret_name = f"projects/{project_number}/secrets/{formatted_secret_id}"

    # 2. Check if the secret exists, otherwise create one if it is not found.
    try:
        secrets_service.get_secret(request=GetSecretRequest(
            name=full_qualified_secret_name  # type: ignore
        ))
        print(f"warning: secret:{formatted_secret_id} already exists exists, skipping creating")
    except NotFound as _e:
        # if the secret is not found, create one as part of the setup env script.
        parent = f"projects/{project_number}"
        print(f"info: creating the secret in the secret manager secret_id: {formatted_secret_id}...")
        secrets_service.create_secret(request=CreateSecretRequest(
            parent=parent,  # type: ignore
            secret_id=formatted_secret_id,  # type: ignore
            secret=Secret(  # type: ignore
                replication={
                    "automatic": {},
                },
                expire_time=None if expire_time.lower() == "never" else expire_time  # type: ignore
            )
        ))
    except Exception as e:
        print(f"error: Failed to create secret {formatted_secret_id} - {str(e)}")
        raise

    # Upload the file to the secret manager of the environment's project.
    print(f"uploading the the file to the secret manager... "
          f"secret:{formatted_secret_id} "
          f"from file path: {file_path}")

    with open(file_path, "r", encoding="utf-8") as file:
        env_file_content = file.read()

    secrets_service.add_secret_version(request=AddSecretVersionRequest(
        parent=full_qualified_secret_name,  # type: ignore
        payload={"data": env_file_content.encode("utf-8")}
    ))


def _main(*, realm_name: str, env_name: str, target_git_branch: str, target_git_sha: str, config_files_dir: str,
          secrets_expire_time: str):
    stack_name = get_stack_name_from(realm_name, env_name)

    target_version = Version(
        git_branch_name=target_git_branch,
        git_sha=target_git_sha
    )

    # Make sure the environment files directory exists,
    # and the directory contains both the .env and stackconfig files for the environment.
    if not os.path.exists(config_files_dir):
        raise FileNotFoundError(f"Environment files directory {config_files_dir} does not exist.")

    env_file_path = os.path.join(config_files_dir, f".env.{stack_name}")
    if not os.path.exists(env_file_path):
        raise FileNotFoundError(f"Environment file {env_file_path} does not exist.")

    stack_config_file_path = os.path.join(config_files_dir, f"stack_config.{realm_name}.{env_name}.yaml")
    if not os.path.exists(stack_config_file_path):
        raise FileNotFoundError(f"Stack config file {stack_config_file_path} does not exist.")

    # 1. Get the stack configurations for the given environment.
    environment = get_realm_environment(
        realm_name=realm_name,
        environment_name=env_name)

    if not environment:
        print(f"error: Environment {stack_name} not found.")
        exit(1)

    print(f"Setting up the environment:{stack_name} ...")

    # 2. Write the environment configuration to the respective pulumi.yaml file.
    write_config_to_pulumi_yaml_file(
        stack_name=stack_name,
        module=IaCModules.ENVIRONMENT,
        content=environment.config
    )

    # 3. Run pulumi up to deploy the environment stack.
    up_results = run_pulumi_up(
        stack_name=stack_name,
        module=IaCModules.ENVIRONMENT
    )

    # 4. Uploading the .env file to the secret manage given the target version.
    project_number = up_results.outputs["project_number"].value
    _upload_file_to_secret_manager(
        project_number=project_number,
        secret_prefix=ENV_VARS_SECRET_PREFIX,
        file_path=env_file_path,
        version=target_version,
        expire_time=secrets_expire_time
    )

    # 5. Upload the stack config file to the secret manager.
    _upload_file_to_secret_manager(
        project_number=project_number,
        secret_prefix=STACK_CONFIG_SECRET_PREFIX,
        file_path=stack_config_file_path,
        version=target_version,
        expire_time=secrets_expire_time
    )

    print(f"Environment setup completed. {stack_name} is ready to use.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        formatter_class=argparse.RawTextHelpFormatter,
        description="Sets up the given environment by \n"
                    " - running pulumi up on the environment stack and \n"
                    " - uploading config and environment variables to the secrets manager of the environment project."
    )

    # add the required arguments to select the environment to set up.
    add_select_environment_arguments(parser=parser)

    parser.add_argument(
        "--config-files-dir",
        type=str,
        required=True,
        help="The directory that contains the configuration and environment files,\n"
             "to be uploaded to the secret manager of the target environment's project.\n"
             " - The directory should contain: \n"
             "      1) .env.<REALM_NAME>.<ENV_NAME> file containing the environment variables and values.\n"
             "      2) stack_config.<REALM_NAME>.<ENV_NAME>.yaml Containing the stack config for the pulumi modules.\n"
             " - It should be an absolute path or the path from the place where you are running script from."
    )

    target_version_group = parser.add_argument_group(
        title="Configuration version",
        description="The inputs will be used to construct the configuration version ie: <branch-name>.<git-sha>. \n"
                    "This is the version where the .env file and stack_config.yaml will be uploaded.\n"
                    "Also some characters will be escaped to comply to naming conventions in the secret manager")

    target_version_group.add_argument(
        "--target-git-branch",
        type=str,
        required=False,
        default=MAIN_SECRET_VERSION,
        help=f"The target branch name. Default: {MAIN_SECRET_VERSION}"
    )

    target_version_group.add_argument(
        "--target-git-sha",
        type=str,
        required=False,
        help="The target git sha"
    )

    target_version_group.add_argument(
        "--secrets-expire-time",
        type=str,
        required=True,
        help="Timestamp in UTC when the the secrets is scheduled to expire or 'never' if the secret never expires  \n"
             "If the secret already exists this will be ignored.\n"
             "Format: RFC 3339, for example 2100-01-01T09:00:00-00:00"

    )

    args = parser.parse_args()
    _main(
        realm_name=args.realm_name,
        env_name=args.env_name,
        target_git_branch=args.target_git_branch,
        target_git_sha=args.target_git_sha,
        config_files_dir=args.config_files_dir,
        secrets_expire_time=args.secrets_expire_time)
