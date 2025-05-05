import json
import os
from typing import Optional

import sys
import shutil
import subprocess

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

# Determine the absolute path to the 'iac' directory
iac_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/frontend directory.
sys.path.insert(0, iac_folder)

from lib import base64_encode, getenv, get_realm_and_env_name_from_stack, \
    get_pulumi_stack_outputs, construct_artifacts_dir, save_content_in_file, \
    download_generic_artifacts_file, Version

from scripts.formatters import construct_artifacts_version

# The actual frontend build artifact filename is specified in the iac/scripts/build-and-upload-fe.sh script.
frontend_build_artifact_filename = "frontend-build.tar.gz"

# the constant directories.
current_dir = os.path.join(iac_folder, "frontend")
base_artifacts_dir = os.path.join(current_dir, "_tmp", "artifacts")
deployments_dir = os.path.join(current_dir, "_tmp", "deployments")


def _validate_rsa_public_key(pem_key: bytes) -> None:
    """
    Validate the given RSA public key.

    :param pem_key: The PEM-encoded RSA public key.
    :return:
    """
    serialization.load_pem_public_key(pem_key, backend=default_backend())


def download_frontend_bundle(
        *,
        realm_name: str,
        deployment_number: str,
        artifacts_version: Version) -> None:
    """
    Download the frontend build bundle given the frontend artifact version.

    Args:
        :param realm_name:
        :param deployment_number:
        :param artifacts_version:  The version of the frontend build bundle.
    """
    # 1. get the directory where to save the frontend build bundle.
    frontend_artifacts_version = construct_artifacts_version(
        git_branch_name=artifacts_version.git_branch_name,
        git_sha=artifacts_version.git_sha
    )

    artifacts_dir = construct_artifacts_dir(
        deployment_number=deployment_number,
        fully_qualified_version=frontend_artifacts_version)
    # artifacts dir, the folder to store the frontend build bundle.
    artifacts_destination_dir = os.path.join(base_artifacts_dir, artifacts_dir)
    os.makedirs(artifacts_destination_dir, exist_ok=False)

    # 2. Get the generic repository to download the frontend build bundle.
    realm_outputs = get_pulumi_stack_outputs(stack_name=realm_name, module="realm")

    # the generic repository name is defined in iac/realm/create_realm:_create_repositories method body
    # if it is not there python will raise `KeyError`, a good thing.
    realm_generic_repository = realm_outputs["generic_repository"].value

    print(f"Downloading the frontend build bundle... to {artifacts_destination_dir}")

    try:
        # 3. Download the frontend build bundle.
        download_generic_artifacts_file(
            repository=realm_generic_repository,
            version=frontend_artifacts_version,
            file_name=frontend_build_artifact_filename,
            output_dir=artifacts_destination_dir
        )

        # 4. extract the downloaded frontend build bundle.
        subprocess.run(
            [
                "tar",
                "-xf",
                frontend_build_artifact_filename,
            ],
            cwd=artifacts_destination_dir,
            check=True,
            text=True
        )

        # clean up: remove the downloaded frontend build bundle.
        os.remove(os.path.join(artifacts_destination_dir, frontend_build_artifact_filename))

        print("Done downloading the frontend build bundle.")
    except subprocess.CalledProcessError as e:
        print(f"Error downloading frontend bundle: {e}")
        raise


def _construct_env_js_content(*, artifacts_dir: str, stack_name: str):
    sentry_dsn: str = getenv("FRONTEND_SENTRY_DSN", True, False)
    enable_sentry: str = getenv("FRONTEND_ENABLE_SENTRY", False, False)
    sentry_config: str = getenv("FRONTEND_SENTRY_CONFIG", False, False)
    enable_metrics: str = getenv("FRONTEND_ENABLE_METRICS", False, False)
    login_code: Optional[str] = getenv("FRONTEND_LOGIN_CODE", False, False)
    registration_code: Optional[str] = getenv("FRONTEND_REGISTRATION_CODE", False, False)

    sensitive_personal_data_rsa_encryption_key: str = getenv("SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY")
    sensitive_personal_data_rsa_encryption_key_id: str = getenv("SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID")

    # features
    features = getenv("FRONTEND_FEATURES", False, False)

    # validations, apart from the keys are required, some values also need to be validated
    # the sensitive encryption key should be a valid RSA public key.
    _validate_rsa_public_key(sensitive_personal_data_rsa_encryption_key.encode("utf-8"))

    print(f"Constructing the env.js file... for the run: {stack_name}")

    environment_outputs = get_pulumi_stack_outputs(stack_name=stack_name, module="environment")
    auth_outputs = get_pulumi_stack_outputs(stack_name=stack_name, module="auth")
    _, env_name = get_realm_and_env_name_from_stack(stack_name)

    frontend_env_json = {
        "FIREBASE_API_KEY": base64_encode(auth_outputs["identity_platform_client_api_key"].value),
        "FIREBASE_AUTH_DOMAIN": base64_encode(environment_outputs["auth_domain"].value),
        "BACKEND_URL": base64_encode(environment_outputs["backend_url"].value),
        "TARGET_ENVIRONMENT_NAME": base64_encode(env_name),
        "FRONTEND_ENABLE_SENTRY": base64_encode(enable_sentry),
        "FRONTEND_SENTRY_DSN": base64_encode(sentry_dsn),
        "FRONTEND_SENTRY_CONFIG": base64_encode(sentry_config),
        "FRONTEND_ENABLE_METRICS": base64_encode(enable_metrics),
        "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY": base64_encode(sensitive_personal_data_rsa_encryption_key),
        "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID": base64_encode(sensitive_personal_data_rsa_encryption_key_id),
        "FRONTEND_LOGIN_CODE": base64_encode(login_code),
        "FRONTEND_REGISTRATION_CODE": base64_encode(registration_code),
        "FRONTEND_FEATURES": base64_encode(features),
    }

    env_json_content = f"""window.tabiyaConfig = {json.dumps(frontend_env_json, indent=4)};"""
    frontend_env_json_file_path = os.path.join(artifacts_dir, "data", "env.js")
    save_content_in_file(frontend_env_json_file_path, env_json_content)


def prepare_frontend(
        *,
        stack_name: str):
    """
    Prepare the frontend for deployment.
     1. Ensures that the artifact is downloaded, otherwise downloads it.
     2. Copies the downloaded artifact to the stack artifacts dir
        Specifically for the stack name, otherwise the env.js will be the same for all the stacks.
     3. Constructs the env.js file for the frontend.
    """

    # Get the path to the frontend build bundle
    # This is specific to the deployment, and the stack name
    # because the frontend build bundle is specific to the deployment, and the stack name.
    # Because the frontend/env.js file is specific to the deployment, and the stack name.
    deployment_number = getenv("DEPLOYMENT_RUN_NUMBER")
    artifacts_version = Version(
        git_branch_name=getenv("TARGET_GIT_BRANCH_NAME"),
        git_sha=getenv("TARGET_GIT_SHA")
    )

    generic_artifact_version = construct_artifacts_version(
        git_branch_name=artifacts_version.git_branch_name,
        git_sha=artifacts_version.git_sha
    )

    artifacts_dir = construct_artifacts_dir(
        deployment_number=deployment_number,
        fully_qualified_version=generic_artifact_version)

    # artifacts dir, the folder to store the frontend build bundle.
    artifacts_dir = os.path.join(base_artifacts_dir, artifacts_dir)

    realm_name, _ = get_realm_and_env_name_from_stack(stack_name)

    # get the required environment variables, for the frontend.
    print(f"preparing frontend for the run: {artifacts_dir}-{stack_name}...")

    # If the path (artifacts dir) already exists, skip, otherwise create it and download the frontend build bundle.
    # This should be the same folder for if the frontend deployments are on the same run.
    if not os.path.exists(artifacts_dir):
        # download the frontend build bundle.
        download_frontend_bundle(
            realm_name=realm_name,
            deployment_number=deployment_number,
            artifacts_version=artifacts_version)

    # Have a copy of the artifacts for this deployment (the separate stack name),
    # so that we can make necessary changes to the frontend build bundle that are specific to the environment.
    stack_artifacts_dir = construct_artifacts_dir(
        deployment_number=deployment_number,
        fully_qualified_version=generic_artifact_version,
        stack_name=stack_name)

    # copy the artifacts to the stack artifacts dir, so that we can make necessary changes to the frontend build bundle.
    stack_artifacts_dir = os.path.join(deployments_dir, stack_artifacts_dir)
    shutil.copytree(artifacts_dir, stack_artifacts_dir, dirs_exist_ok=True)

    # construct the env.js content for this deployment and stack.
    _construct_env_js_content(
        stack_name=stack_name,
        artifacts_dir=stack_artifacts_dir
    )

    print(f"Done preparing frontend for the run: {artifacts_dir}-{stack_name}.")
