#!/usr/bin/env python3

import os
import sys

import argparse

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, libs_dir)

from _types import IaCModules
from lib import get_stack_name_from
from _common import add_select_environment_arguments, get_environment_stack_config, \
    write_config_to_pulumi_yml_file, \
    upload_env_file_content_to_sm, run_pulumi_up


def _main(args):
    stack_name = get_stack_name_from(args.realm_name, args.env_name)

    # Make sure the environment files directory exists,
    # and the directory contains the .env file for the environment.

    if not os.path.exists(args.env_files_dir):
        raise FileNotFoundError(f"Environment files directory {args.env_files_dir} does not exist.")

    env_file_path = os.path.join(args.env_files_dir, f".env.{stack_name}")
    if not os.path.exists(env_file_path):
        raise FileNotFoundError(f"Environment file {env_file_path} does not exist.")

    # 1. Get the realm's stacks configurations for the given environment.
    stack_config = get_environment_stack_config(realm_name=args.realm_name, environment_name=args.env_name)

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

    # 4. Uploading the .env file to the secret manager.
    secret_name = up_results.outputs["secret_name"].value
    upload_env_file_content_to_sm(
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
        help="The directory that contains the environments files, "
             "to be uploaded to the secret manager of the environment's project."
             " The directory should contain the .env.<REALM_NAME>.<ENV_NAME> file for the environment."
             " It should be an absolute path."
    )

    _main(parser.parse_args())
