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
from lib import get_stack_name_from, MAIN_SECRET_VERSION, ENV_VARS_SECRET_ID, get_formatted_secret_id
from _common import add_select_environment_arguments, get_environment_stack_config, \
    write_config_to_pulumi_yml_file, run_pulumi_up


def _upload_env_file_content_to_sm(*, project_number: str, config_version: str, env_file_path: str):
    """
    Upload the .env file to the secret manager.
    """

    secrets_service = SecretManagerServiceClient()

    # 1. Construct the valid secret id.
    formatted_secret_id = get_formatted_secret_id(ENV_VARS_SECRET_ID, config_version)
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
        # @noinspection
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

    # Upload the .env file to the secret manager of the environment's project.
    print(f"uploading the .env file to the secret manager... on secret: {secret_name} from file: {env_file_path}")
    with open(env_file_path, "r", encoding="utf-8") as file:
        env_file_content = file.read()

    secrets_service.add_secret_version(request=AddSecretVersionRequest(
        parent=secret_name,  # type: ignore
        payload={"data": env_file_content.encode("utf-8")}
    ))


def _main(args):
    stack_name = get_stack_name_from(args.realm_name, args.env_name)
    config_version = args.config_version

    # Make sure the environment files directory exists,
    # and the directory contains the .env file for the environment.
    if not os.path.exists(args.env_files_dir):
        raise FileNotFoundError(f"Environment files directory {args.env_files_dir} does not exist.")

    env_file_path = os.path.join(args.env_files_dir, f".env.{stack_name}")
    if not os.path.exists(env_file_path):
        raise FileNotFoundError(f"Environment file {env_file_path} does not exist.")

    # 1. Get the realm's stacks configurations for the given environment.
    stack_config = get_environment_stack_config(
        realm_name=args.realm_name,
        environment_name=args.env_name,
        config_version=config_version)  # the config version will be main.

    print(f"Setting up the environment:{stack_name} ...")
    # 2. Write the environment configuration to the respective pulumi.yml file.
    write_config_to_pulumi_yml_file(
        stack_name=stack_name,
        module=IaCModules.ENVIRONMENT,
        content=stack_config.environment
    )

    # 3. Run pulumi up to deploy the environment stack.
    up_results = run_pulumi_up(
        stack_name=stack_name,
        module=IaCModules.ENVIRONMENT
    )

    # 4. Uploading the .env file to the secret manage given the configuration version.
    project_number = up_results.outputs["project_number"].value
    _upload_env_file_content_to_sm(
        project_number=project_number,
        env_file_path=env_file_path,
        config_version=config_version
    )

    print(f"Environment setup completed. {stack_name} is ready to use.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Prepare the given environment by deploying the environment stack and uploading "
                    "the environment's .env file to the secret manager."
    )

    # add the required arguments to select the environment to set up.
    add_select_environment_arguments(parser=parser)

    parser.add_argument(
        "--env-files-dir",
        type=str,
        required=True,
        help="The directory that contains the environments files, "
             "to be uploaded to the secret manager of the environment's project."
             " The directory should contain the .env.<REALM_NAME>.<ENV_NAME> file for the environment."
             " It should be an absolute path."
    )

    parser.add_argument(
        "--config-version",
        type=str,
        required=False,
        default=MAIN_SECRET_VERSION,
        help="The version of the configuration to look for when determining the environment(s) to set up. Also the "
             "same version will be used when upload the .env file")

    _main(parser.parse_args())
