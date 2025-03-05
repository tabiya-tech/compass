#!/usr/bin/env python3
import datetime
import os

import sys
import argparse
import time
from typing import Optional
import pulumi.automation as auto

import requests


# Determine the absolute path to the 'iac' directory
iac_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, iac_dir)

from environment.env_types import EnvironmentTypes
from _types import IaCModules, Environment
from frontend.prepare_frontend import prepare_frontend
from lib import load_dot_realm_env, getenv, get_pulumi_stack_outputs, Version, clear_dot_env
from _common import add_select_environments_arguments, run_pulumi_up, find_environments


def _run_smoke_tests(version_json_url: str, max_retries: int = 10):
    artifacts_version = Version(
        git_branch_name=getenv("TARGET_GIT_BRANCH_NAME"),
        git_sha=getenv("TARGET_GIT_SHA")
    )

    print(f"info: running the smoke tests on {version_json_url} and expected version is {artifacts_version}")

    version_json_response: Optional[requests.Response] = None

    for _i in range(max_retries):
        try:
            version_json_response = requests.get(version_json_url)
            break
        except requests.exceptions.SSLError:
            print(f"info: retrying after 10 seconds the request to {version_json_url} due to SSL error.")
            time.sleep(10)

    assert version_json_response is not None
    assert version_json_response.status_code == 200

    version_json = version_json_response.json()
    assert version_json["sha"] == artifacts_version.git_sha
    assert version_json["branch"] == artifacts_version.git_branch_name

    print("info: smoke tests passed successfully.")


def _deploy_frontend(stack_name: str):
    # prepare the frontend to be deployed.
    prepare_frontend(stack_name=stack_name)

    # run pulumi up for the frontend stack.
    up_results = run_pulumi_up(stack_name, IaCModules.FRONTEND)

    # run the smoke tests for the frontend.
    bucket_url = up_results.outputs["bucket_url"].value
    _run_smoke_tests(f"{bucket_url}/data/version.json")


def _deploy_backend(stack_name: str):
    # run pulumi up on the backend
    up_results = run_pulumi_up(stack_name, IaCModules.BACKEND)

    # run the smoke tests for the backend.
    apigateway_url = up_results.outputs["apigateway_url"].value
    _run_smoke_tests(f"{apigateway_url}/version")


def _deploy_common(stack_name: str):
    # 1. run pulumi up on common
    run_pulumi_up(stack_name, IaCModules.COMMON)

    # 2. run smoke tests
    environment_outputs = get_pulumi_stack_outputs(stack_name, IaCModules.ENVIRONMENT.value)

    # 2.1 run smoke tests for the backend
    backend_url = environment_outputs["backend_url"].value
    _run_smoke_tests(f"{backend_url}/version", 30)

    # 2.2 run smoke tests for the frontend
    frontend_url = environment_outputs["frontend_url"].value
    _run_smoke_tests(f"{frontend_url}/data/version.json", 30)


def _tag_the_environment_with_deployment_info(stack_name: str):
    print(f"Tagging the environment: {stack_name} with the deployment info.")

    stack_path = os.path.join(iac_dir, IaCModules.ENVIRONMENT.value)
    environment_stack = auto.select_stack(
        work_dir=stack_path,
        stack_name=stack_name
    )

    prepare_time = getenv("PREPARE_TIME")
    environment_stack.set_tag("prepare_time", prepare_time)

    env_vars_secret_path = getenv("ENV_VARS_SECRETS_PATH")
    environment_stack.set_tag("env_vars_secrets_path", env_vars_secret_path)

    stack_config_secret_path = getenv("STACK_CONFIG_SECRET_PATH")
    environment_stack.set_tag("stack_config_secret_path", stack_config_secret_path)

    target_git_branch = getenv("TARGET_GIT_BRANCH_NAME")
    environment_stack.set_tag("target_git_branch", target_git_branch)

    target_git_sha = getenv("TARGET_GIT_SHA")
    environment_stack.set_tag("target_git_sha", target_git_sha)

    environment_stack.set_tag("deployment_end_time", datetime.datetime.now(tz=datetime.timezone.utc).isoformat())


def _deploy_environment(stack_name: str):
    """
    Deploy the environment:
    """
    # load the environment variables of the stack.
    load_dot_realm_env(stack_name)
    try:
        print(f"Deploying environment: {stack_name}")

        # 1. run pulumi up for the micro stacks.
        run_pulumi_up(stack_name, IaCModules.ENVIRONMENT)

        # 1.1 Deploy the dns
        run_pulumi_up(stack_name, IaCModules.DNS)

        # 1.2 Deploy the auth
        run_pulumi_up(stack_name, IaCModules.AUTH)

        # 1.3 Deploy the frontend.
        _deploy_frontend(stack_name)

        # 1.4 Deploy the backend.
        _deploy_backend(stack_name)

        # 1.5 Deploy the common
        _deploy_common(stack_name)

        # 1.6 set the necessary tags to the pulumi environment, necessary for the deployment report.
        _tag_the_environment_with_deployment_info(stack_name)

    except Exception as e:
        print(f"Error deploying the environment: {stack_name}")
        raise e
    finally:
        # clean up the environment variables.
        clear_dot_env(stack_name)


def _main(*, realm_name: str, env_name: str, env_type: EnvironmentTypes):
    # Get the environments that match the selection criteria.
    targeted_environments: list[Environment] = find_environments(realm_name=realm_name,
                                                                 environment_name=env_name,
                                                                 environment_type=env_type)

    if len(targeted_environments) == 0:
        print(f"error: No environments found to deploy for the given selection criteria "
              f"environment_name: {env_name}, environment_type: {env_type} "
              f"in realm: {realm_name}")
        exit(1)

    for environment in targeted_environments:
        _deploy_environment(environment.stack_name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Deploy the given stack(s) using pulumi commands."
    )

    # Add the arguments to select multiple environments
    add_select_environments_arguments(parser=parser)
    args = parser.parse_args()
    _main(realm_name=args.realm_name, env_name=args.env_name, env_type=args.env_type)
