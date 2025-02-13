#!/usr/bin/env python3

import os

import sys
import argparse
import requests

# Determine the absolute path to the 'iac' directory
iac_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, iac_dir)

from _types import IaCModules
from frontend.prepare_frontend import prepare_frontend
from lib import load_dot_realm_env, getenv, get_ref_name_and_sha_from_artifacts_version, get_pulumi_stack_outputs
from _common import add_select_environments_arguments, get_realm_environment_by_env_type, run_pulumi_up, \
    get_realm_environment


def _run_smoke_tests(version_json_url: str):
    artifacts_version = getenv("ARTIFACTS_VERSION")
    print(f"info: running the smoke tests on {version_json_url} and expected version is {artifacts_version}")

    ref_name, sha = get_ref_name_and_sha_from_artifacts_version(artifacts_version)

    version_json_response = requests.get(version_json_url)
    assert version_json_response.status_code == 200

    version_json = version_json_response.json()
    assert version_json["sha"] == sha
    assert version_json["branch"] == ref_name

    print("info: smoke tests passed successfully.")


def _deploy_frontend(stack_name: str):
    # load the environment variables of the stack.
    load_dot_realm_env(stack_name)

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


def _deploy_aws_ns(stack_name: str):
    # 1. run pulumi up on aws-ns
    run_pulumi_up(stack_name, IaCModules.AWS_NS)

    # 2. run smoke tests
    environment_outputs = get_pulumi_stack_outputs(stack_name, IaCModules.ENVIRONMENT.value)

    # 2.1 run smoke tests for the backend
    backend_url = environment_outputs["backend_url"].value
    _run_smoke_tests(f"{backend_url}/version")

    # 2.2 run smoke tests for the frontend
    frontend_url = environment_outputs["frontend_url"].value
    _run_smoke_tests(f"{frontend_url}/data/version.json")


def _deploy_environment(stack_name: str):
    """
    Deploy the environment:
    """

    print(f"Deploying environment: {stack_name}")

    # 1. run pulumi up for the micro stacks.
    run_pulumi_up(stack_name, IaCModules.ENVIRONMENT)

    # 1.1 Deploy the aut
    run_pulumi_up(stack_name, IaCModules.AUTH)

    # 1.2 Deploy the frontend.
    _deploy_frontend(stack_name)

    # 1.3 Deploy the backend.
    _deploy_backend(stack_name)

    # 1.4 Deploy the common
    run_pulumi_up(stack_name, IaCModules.COMMON)

    # 1.5 Deploy the aws-ns
    _deploy_aws_ns(stack_name)


def _main(args):
    # get all the required stacks to deploy matching the criteria.
    realm_name = args.realm_name
    env_name = args.env_name
    env_type = args.env_type

    # Flow 1: deploy the environment by realm name and environment name
    #          this happens if env_name was provided. (manual preparing)
    if env_name is not None:
        target_environment = get_realm_environment(
            realm_name=realm_name,
            environment_name=env_name)

        _deploy_environment(target_environment.stack_name)

    # Flow 2: deploy the environments by realm name and environment type.
    #         This happens in the pipeline when we want to deploy all the environments of a certain type.
    if env_type is not None:
        target_environments = get_realm_environment_by_env_type(
            realm_name=realm_name,
            env_type=env_type)

        if len(target_environments) == 0:
            print(f"No environments found for realm: {realm_name} and env_type: {env_type}")

        for environment in target_environments:
            _deploy_environment(environment.stack_name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Deploy the given stack(s) using pulumi commands."
    )

    # Add the arguments to select multiple environments
    add_select_environments_arguments(parser=parser)

    _main(parser.parse_args())
