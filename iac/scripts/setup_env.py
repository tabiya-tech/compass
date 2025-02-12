#!/usr/bin/env python3

import os
import sys

import argparse

from google.cloud.secretmanager import SecretManagerServiceClient, AddSecretVersionRequest, GetSecretRequest, \
    CreateSecretRequest, Secret
from google.api_core.exceptions import NotFound

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, libs_dir)

from _types import IaCModules
from lib import get_stack_name_from, MAIN_SECRET_VERSION, ENV_VARS_SECRET_ID, get_formatted_secret_id, \
    construct_version_from_branch_and_sha, STACK_CONFIG_SECRET_ID
from _common import add_select_environment_arguments, \
    write_config_to_pulumi_yml_file, run_pulumi_up, get_realm_environment


def _upload_file_to_secret_manager(
        *,
        project_number: str,
        secret_name: str,
        version: str,
        file_path: str):
    """
    Upload the .env file to the secret manager.
    """

    secrets_service = SecretManagerServiceClient()

    # 1. Construct the valid secret id.
    formatted_secret_id = get_formatted_secret_id(secret_name, version)
    secret_name = f"projects/{project_number}/secrets/{formatted_secret_id}"

    # 2. Check if the secret exists, otherwise create one if it is not found.
    try:
        secrets_service.get_secret(request=GetSecretRequest(
            name=secret_name  # type: ignore
        ))
        print(f"info: secret exists secret_name:{secret_name}.")
    except NotFound as e:
        # if the secret is not found, create one as part of the setup env script.
        parent = f"projects/{project_number}"
        print(f"warning: secret:{formatted_secret_id}, message:{e.message}")
        print(f"info: creating the secret in the secret manager parent:{parent} secret_id: {formatted_secret_id}...")
        secrets_service.create_secret(request=CreateSecretRequest(
            parent=parent,  # type: ignore
            secret_id=formatted_secret_id,  # type: ignore
            secret=Secret(  # type: ignore
                replication={
                    "automatic": {},
                },
            )
        ))
    except Exception as e:
        print("error: ", str(e))
        raise

    # Upload the file to the secret manager of the environment's project.
    print(f"uploading the the file file to the secret manager... on secret: {secret_name} from file path: {file_path}")
    with open(file_path, "r", encoding="utf-8") as file:
        env_file_content = file.read()

    secrets_service.add_secret_version(request=AddSecretVersionRequest(
        parent=secret_name,  # type: ignore
        payload={"data": env_file_content.encode("utf-8")}
    ))


def _main(args):
    stack_name = get_stack_name_from(args.realm_name, args.env_name)
    config_version = construct_version_from_branch_and_sha(args.target_git_branch, args.target_git_sha)

    # Make sure the environment files directory exists,
    # and the directory contains both the .env and stackconfig files for the environment.
    if not os.path.exists(args.config_files_dir):
        raise FileNotFoundError(f"Environment files directory {args.config_files_dir} does not exist.")

    env_file_path = os.path.join(args.config_files_dir, f".env.{stack_name}")
    if not os.path.exists(env_file_path):
        raise FileNotFoundError(f"Environment file {env_file_path} does not exist.")

    stack_config_file_path = os.path.join(args.config_files_dir, f"stack_config.{args.realm_name}.{args.env_name}.yaml")
    if not os.path.exists(stack_config_file_path):
        raise FileNotFoundError(f"Stack config file {stack_config_file_path} does not exist.")

    # 1. Get the stack configurations for the given environment.
    environment = get_realm_environment(
        realm_name=args.realm_name,
        environment_name=args.env_name)

    print(f"Setting up the environment:{stack_name} ...")
    # 2. Write the environment configuration to the respective pulumi.yml file.
    write_config_to_pulumi_yml_file(
        stack_name=stack_name,
        module=IaCModules.ENVIRONMENT,
        content=environment.config
    )

    # 3. Run pulumi up to deploy the environment stack.
    up_results = run_pulumi_up(
        stack_name=stack_name,
        module=IaCModules.ENVIRONMENT
    )

    # 4. Uploading the .env file to the secret manage given the configuration version.
    project_number = up_results.outputs["project_number"].value

    _upload_file_to_secret_manager(
        project_number=project_number,
        secret_name=ENV_VARS_SECRET_ID,
        file_path=env_file_path,
        version=config_version
    )

    # 5. Upload the stack config file to the secret manager.
    _upload_file_to_secret_manager(
        project_number=project_number,
        secret_name=STACK_CONFIG_SECRET_ID,
        file_path=stack_config_file_path,
        version=config_version
    )

    print(f"Environment setup completed. {stack_name} is ready to use.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Sets up the given environment by deploying the environment stack and uploading "
                    "configurations to the secret manager."
    )

    # add the required arguments to select the environment to set up.
    add_select_environment_arguments(parser=parser)

    parser.add_argument(
        "--config-files-dir",
        type=str,
        required=True,
        help="The directory that contains the configuration files, "
             "to be uploaded to the secret manager of the environment's project."
             " The directory should contain the "
             "  1) .env.<REALM_NAME>.<ENV_NAME> file for the environment."
             "  2) stack_config.<REALM_NAME>.<ENV_NAME>.yaml"
             " It should be an absolute path."
    )

    version_group = parser.add_argument_group(
        title="Configuration version",
        description="The inputs will be used to construct the configuration version ie: <branch-name>.<git-sha>. "
                    "This is the version where the .env file and stack_config.yaml will be uploaded")

    version_group.add_argument(
        "--target-git-branch",
        type=str,
        required=False,
        default=MAIN_SECRET_VERSION,
        help=f"The target branch name. Default: {MAIN_SECRET_VERSION}"
    )

    version_group.add_argument(
        "--target-git-sha",
        type=str,
        required=False,
        help="The target git sha or commit sha"
    )

    _main(parser.parse_args())
