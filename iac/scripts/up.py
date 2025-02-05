#!/usr/bin/env python3

import os

import sys
import argparse

# Determine the absolute path to the 'iac' directory
iac_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, iac_dir)

from _types import IaCModules
from frontend.prepare_frontend import prepare_frontend
from _common import StackConfigs, add_select_environments_arguments, \
    get_environment_stack_config, get_environment_stack_configs_by_env_type, run_pulumi_up


def _deploy_frontend(env_config: StackConfigs):
    # prepare the frontend to be deployed.
    prepare_frontend(stack_name=env_config.stack_name)
    run_pulumi_up(env_config.stack_name, IaCModules.FRONTEND)


def _deploy_backend(env_config: StackConfigs):
    run_pulumi_up(env_config.stack_name, IaCModules.BACKEND)


def _deploy_environment(env_config: StackConfigs):
    """
    Deploy the environment:
    """

    print(f"Deploying environment: {env_config.stack_name}")

    # 1. run pulumi up for the micro stacks.

    run_pulumi_up(env_config.stack_name, IaCModules.AUTH)

    _deploy_frontend(env_config)

    _deploy_backend(env_config)

    run_pulumi_up(env_config.stack_name, IaCModules.COMMON)

    run_pulumi_up(env_config.stack_name, IaCModules.AWS_NS)


def _main(args):
    # get all the required stacks to deploy matching the criteria.
    _realm_name = args.realm_name
    _env_name = args.env_name
    _env_type = args.env_type

    # Flow 1: deploy the environment by realm name and environment name
    #          this happens if env_name was provided. (manual preparing)
    if _env_name is not None:
        target_environment_config = get_environment_stack_config(
            realm_name=_realm_name,
            environment_name=_env_name)

        _deploy_environment(target_environment_config)

    # Flow 2: deploy the environments by realm name and environment type.
    #         This happens in the pipeline when we want to deploy all the environments of a certain type.
    if _env_type is not None:
        target_environments = get_environment_stack_configs_by_env_type(
            realm_name=_realm_name,
            env_type=_env_type)

        if len(target_environments) == 0:
            print(f"No environments found for realm: {_realm_name} and env_type: {_env_type}")

        for env_config in target_environments:
            _deploy_environment(env_config)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Deploy the given stack(s) using pulumi commands."
    )

    # Add the arguments to select multiple environments
    add_select_environments_arguments(parser=parser)

    _main(parser.parse_args())
