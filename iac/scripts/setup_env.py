#!/usr/bin/env python3

import os
import sys

import argparse
import pulumi.automation as auto

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, libs_dir)

from lib import get_stack_name_from
from _common import add_select_environment_arguments, get_environment_stack_config, \
    write_config_to_pulumi_yml_file, \
    upload_environment_secrets_to_secret_manager


def _main(args):
    stack_name = get_stack_name_from(args.realm_name, args.env_name)

    # Make sure the environment files directory exists,
    # and the directory contains the .env file for the environment.

    if not os.path.exists(args.env_files_dir):
        raise FileNotFoundError(f"Environment files directory {args.env_files_dir} does not exist.")

    env_file_path = os.path.join(args.env_files_dir, f".env.{stack_name}")
    if not os.path.exists(env_file_path):
        raise FileNotFoundError(f"Environment file {env_file_path} does not exist.")

    # Get the stack config from the realm's secrets
    stack_config = get_environment_stack_config(realm_name=args.realm_name, env_name=args.env_name)

    # Save it to a yaml file, in the environment module.
    write_config_to_pulumi_yml_file(
        stack_name=stack_name,
        module="environment",
        content=stack_config.environment
    )

    # Run pulumi up to deploy the environment stack.
    environment_stack = auto.create_or_select_stack(
        stack_name=stack_name,
        work_dir=os.path.join(libs_dir, "environment"),
    )

    up_results = environment_stack.up(
        on_output=print,
        color="always"
    )

    # Uploading the .env file to the secret manager.
    secret_name = up_results.outputs.get("secret_name").value
    upload_environment_secrets_to_secret_manager(
        secret_name=secret_name,
        env_file_path=env_file_path
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
        help="The directory that contains the environments files, to be uploaded to the secret manager of the environment's project."
             " The directory should contain the .env.<REALM_NAME>.<ENV_NAME> file for the environment."
             " It should be an absolute path."
    )

    _main(parser.parse_args())
