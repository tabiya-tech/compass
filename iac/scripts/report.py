#!/usr/bin/env python3

import os
import json
import logging
import uuid
from typing import Any

import requests
import argparse
import datetime

import pulumi.automation as auto

from google.cloud.secretmanager import SecretManagerServiceClient

from _common import get_environments_in_realm
from _types import Environment, IaCModules
from lib import save_content_in_file

iac_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


logging.basicConfig(format="%(asctime)s - %(levelname)s - %(name)s - %(message)s", level=logging.INFO)


def _construct_environment_report(*,
                                  environment: Environment,
                                  output_dir: str):
    logger = logging.getLogger(f"construct_{environment.environment_name}_report")

    secret_manager_service = SecretManagerServiceClient()
    logger.info(f"Getting the report for the environment: {environment.environment_name}....")

    stack_path = os.path.join(iac_folder, IaCModules.ENVIRONMENT.value)
    stack = auto.select_stack(
        work_dir=stack_path,
        stack_name=environment.stack_name
    )

    # Get the required information
    logger.info("Getting stack information.....")
    stack_info = stack.info()

    logger.info("Getting stack tags.....")
    stack_tags = stack.list_tags()

    logger.info("Getting stack outputs.....")
    stack_outputs = stack.outputs()

    env_vars_secrets_path = stack_tags.get("env_vars_secrets_path")
    env_vars_local_path = os.path.join(output_dir, f".env.{environment.stack_name}")

    stack_config_secret_path = stack_tags.get("stack_config_secret_path")
    stack_configs_local_path = os.path.join(output_dir, f"stack_config.{environment.stack_name}.yaml")

    # Download the secrets.

    if env_vars_secrets_path:
        logger.info("Downloading the environment variables.....")
        env_vars = secret_manager_service.access_secret_version(name=env_vars_secrets_path)

        save_content_in_file(env_vars_local_path, env_vars.payload.data.decode("utf-8"))
    else:
        env_vars_local_path = None
        logger.warning("No environment variables found for the deployment.")

    if stack_config_secret_path:
        logger.info("Downloading the stack configuration.....")
        stack_config = secret_manager_service.access_secret_version(name=stack_config_secret_path)

        save_content_in_file(stack_configs_local_path, stack_config.payload.data.decode("utf-8"))
    else:
        stack_configs_local_path = None
        logger.warning("No stack configuration found for the deployment.")

    # Construct the report
    env_report = dict(
        name=environment.environment_name,
        environment_type=environment.environment_type.value,
        deployment_type=environment.deployment_type.value,

        pulumi_version=stack_info.version,

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
        os.path.join(output_dir, f"{environment.environment_name}.version.json"),
        json.dumps(env_report, indent=4))

    return env_report


def _main(*,
          realm_name: str,
          output_dir: str):
    logger = logging.getLogger("main")

    logger.info(f"preparing deployment report of the realm: {realm_name}")

    environments: list[Environment] = get_environments_in_realm(realm_name)

    reports: list[dict[str, Any]] = []
    for environment in environments:
        logger.info(f"Getting the report for the environment: {environment.environment_name}....")
        reports.append(_construct_environment_report(environment=environment, output_dir=output_dir))

    # save the summary of the report.

    summary = dict(
        realm_name=realm_name,
        created_at=datetime.datetime.now().isoformat(),
        environments=[dict(
            env_name=report.get("name"),

            target_git_sha=report.get("target_git_sha"),
            target_branch_name=report.get("target_git_branch"),

            dot_env_file=report.get("env_vars_secret_local_path"),
            stack_config_file=report.get("stack_config_local_path"),
            version_file=os.path.join(output_dir, report.get("name") + ".version.json")
        ) for report in reports]
    )

    save_content_in_file(
        os.path.join(output_dir, "summary.json"),
        json.dumps(summary, indent=4))

    logger.info(f"Report saved in the directory: {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        formatter_class=argparse.RawTextHelpFormatter,
        description="Get the report of all existing deployments. \n"
                    "For each environment under the realm: \n"
                    " a) get all the configurations and environments variables that are deployed on this environment \n"
                    " b) Get the version of artifacts that are deployed on this environment. \n\n"
                    "You must use the realm admin credentials so that you can access the secrets.\n"
                    "The script saves three files for each environment: \n"
                    " 1) .env.{environment_name} - The environment variables that are deployed on this environment. \n"
                    " 2) stack_config.{environment_name}.yaml - The stack configuration that is deployed on this "
                    "environment. \n"
                    " 3) {environment_name}.version.json - The report of the deployment. \n"
    )

    parser.add_argument("--realm-name", type=str, required=True, help="The realm name to get the report for.")
    parser.add_argument(
        "--output-dir",
        type=str,
        required=True,
        help="The directory to save the report. Absolute or relative path to the working directory")

    args = parser.parse_args()

    _logger = logging.getLogger(__name__)

    try:
        report_id = uuid.uuid4()
        _logger.info("Using the report id: %s", report_id)

        _output_dir = os.path.join(args.output_dir, f"report-{report_id}")
        os.makedirs(_output_dir, exist_ok=True)
        _logger.info("The output will be saved in the directory: %s", _output_dir)

        _main(
            output_dir=_output_dir,
            realm_name=args.realm_name)

    except Exception as e:
        _logger.exception(e)
