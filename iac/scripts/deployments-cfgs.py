#!/usr/bin/env python3

import argparse
import datetime
import json
import os
from textwrap import dedent
from typing import Any

import pulumi.automation as auto
import requests
from google.cloud.secretmanager import SecretManagerServiceClient

from _common import get_environments_in_realm
from _types import Environment, IaCModules
from lib import save_content_in_file

iac_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def _construct_environment_info(*,
                                environment: Environment,
                                output_dir: str):
    print(f"=============== Constructing the deployment info and configurations"
          f" of environment: {environment.environment_name} ==================")

    secret_manager_service = SecretManagerServiceClient()
    print(f"info: Getting the latest deployment for the environment: {environment.environment_name}....")

    stack_path = os.path.join(iac_folder, IaCModules.ENVIRONMENT.value)
    stack = auto.select_stack(
        work_dir=stack_path,
        stack_name=environment.stack_name
    )

    # Get the required information
    print("info: Getting stack information.....")
    stack_info = stack.info()

    print("info: Getting stack tags.....")
    stack_tags = stack.list_tags()

    print("info: Getting stack outputs.....")
    stack_outputs = stack.outputs()

    env_vars_secrets_path = stack_tags.get("env_vars_secrets_path")
    env_vars_local_path = os.path.join(output_dir, ".env")

    stack_config_secret_path = stack_tags.get("stack_config_secret_path")
    stack_configs_local_path = os.path.join(output_dir, "stack_config.yaml")

    # Download the secrets.
    # If the file is not found, set to None and log a warning.
    if env_vars_secrets_path:
        print("info: Downloading the environment variables.....")
        env_vars = secret_manager_service.access_secret_version(name=env_vars_secrets_path)

        save_content_in_file(env_vars_local_path, env_vars.payload.data.decode("utf-8"))
    else:
        env_vars_local_path = None
        print("warning: No environment variables found for the deployment.")

    # if the file is not found, set to None and log a warning.
    if stack_config_secret_path:
        print("info: Downloading the stack configuration.....")
        stack_config = secret_manager_service.access_secret_version(name=stack_config_secret_path)

        save_content_in_file(stack_configs_local_path, stack_config.payload.data.decode("utf-8"))
    else:
        stack_configs_local_path = None
        print("warning: No stack configuration found for the deployment.")

    # Construct the latest deployment info.
    deployment_info = dict(
        name=environment.environment_name,
        environment_type=environment.environment_type.value,
        deployment_type=environment.deployment_type.value,

        # by default pulumi uses UTC time. But no timezone info in the datetime object.
        start_time=stack_info.start_time.replace(tzinfo=datetime.timezone.utc).isoformat(),
        end_time=stack_tags.get("deployment_end_time"),
        artifacts_prepare_time=stack_tags.get("prepare_time"),

        env_vars_secrets_remote_path=env_vars_secrets_path,
        stack_config_secret_remote_path=stack_config_secret_path,

        env_vars_secret_local_path=env_vars_local_path,
        stack_config_local_path=stack_configs_local_path,

        target_git_branch=stack_tags.get("target_git_branch"),
        target_git_sha=stack_tags.get("target_git_sha"),

        backend_url=stack_outputs.get("backend_url").value,
        frontend_url=stack_outputs.get("frontend_url").value,

        frontend_version_json=requests.get(f"{stack_outputs.get('frontend_url').value}/data/version.json").json(),
        backend_version_json=requests.get(f"{stack_outputs.get('backend_url').value}/version").json(),
    )

    save_content_in_file(
        os.path.join(output_dir, "version.json"),
        json.dumps(deployment_info, indent=4))

    print(f"info: Deployment info constructed successfully. and saved in the {output_dir} directory")

    return deployment_info


def _prepare_and_download_cfgs(*,
                               realm_name: str,
                               output_dir: str):
    print(f"info: preparing deployment infos of the realm: {realm_name}")

    # 1. Get all environments in the realm.
    environments: list[Environment] = get_environments_in_realm(realm_name)

    # 2. Construct the deployment info object for each environment. And keep the summary of the deployment.

    summaries: list[dict[str, Any]] = []
    for environment in environments:
        try:
            environment_output_dir = os.path.join(output_dir, environment.environment_name)
            os.makedirs(environment_output_dir, exist_ok=True)

            environment_deployment_info = _construct_environment_info(
                environment=environment, output_dir=environment_output_dir)

            summaries.append(dict(
                env_name=environment_deployment_info.get("name"),
                target_git_sha=environment_deployment_info.get("target_git_sha"),
                target_branch_name=environment_deployment_info.get("target_git_branch"),
                dot_env_file=environment_deployment_info.get("env_vars_secret_local_path"),
                stack_config_file=environment_deployment_info.get("stack_config_local_path"),
                version_file=os.path.join(output_dir, environment_deployment_info.get("name") + ".version.json")
            ))
        except Exception as setup_error:
            print(f"error: failed to download configurations for the environment: {environment.environment_name}. Cause: {setup_error}")

    # save the summary of the deployment infos.
    summary = dict(realm_name=realm_name,
                   created_at=datetime.datetime.now().isoformat(),
                   total_environments=len(environments),
                   environments=summaries)

    save_content_in_file(
        os.path.join(output_dir, "summary.json"),
        json.dumps(summary, indent=4))

    print(f"info: export saved in the directory: {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        formatter_class=argparse.RawTextHelpFormatter,
        description=dedent(
            """
            Get the configurations and versions of all existing deployments.
            For each environment under the realm:
                a) get all the configurations and environments variables that are deployed on this environment
                b) Get the version of artifacts that are deployed on this environment.
                              
            You must use a member of realm admins group so that you can access the secrets from upper and lower envs.
            The script saves three files for each environment in the folder of {environment name} directory:
                1) .env - The environment variables that are deployed on this environment.
                2) stack_config.yaml - The stack configuration that is deployed on this environment.
                3) version.json - The version of the latest deployment.
                            
            We also save a summary.json file in the output directory that contains the summary of all the deployments.
            """))

    parser.add_argument("--realm-name", type=str, required=True, help="The realm name to get the configurations for.")
    parser.add_argument(
        "--output-dir",
        type=str,
        required=True,
        help="The directory to save the deployments configurations. Absolute or relative path to the working directory."
             " We recommend giving an empty directory, otherwise, the existing files will be overwritten.")

    args = parser.parse_args()

    try:
        # ensure the directory exists.
        os.makedirs(args.output_dir, exist_ok=True)

        _prepare_and_download_cfgs(
            output_dir=args.output_dir,
            realm_name=args.realm_name)

    except Exception as e:
        print(f"error: {e}")
