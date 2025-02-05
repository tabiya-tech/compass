import json
import os
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

from lib import base64_encode, getenv, get_realm_and_env_name_from_stack, load_dot_realm_env, get_pulumi_stack_outputs, \
    get_deployment_id, parse_artifacts_version

current_dir = os.path.join(iac_folder, "frontend")
FRONTEND_BUILD_ARTIFACT_FILENAME = "build.tar.gz"  # The actual frontend build artifact filename is specified in the iac/scripts/build-and-upload-fe.sh script

ARTIFACTS_DIR = os.path.join(current_dir, "_tmp", "artifacts")
DEPLOYMENTS_DIR = os.path.join(current_dir, "_tmp", "deployments")


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
        artifacts_version: str) -> None:
    """
    Download the frontend build bundle.

    Args:
        :param realm_name:
        :param deployment_number:
        :param artifacts_version:  The version of the frontend build bundle.
    """
    frontend_version = parse_artifacts_version(artifacts_version).frontend_version
    _deployment_id = get_deployment_id(deployment_number=deployment_number, deploy_version=frontend_version)

    # artifacts dir, the folder to store the frontend build bundle.
    output_dir = os.path.join(ARTIFACTS_DIR, _deployment_id)

    print(f"Downloading the frontend build bundle... to {output_dir}")
    os.makedirs(output_dir, exist_ok=False)

    # download the artifacts.
    realm_outputs = get_pulumi_stack_outputs(stack_name=realm_name, module="realm")
    generic_repository = realm_outputs["generic_repository"].value

    try:
        subprocess.run(
            [
                "gcloud",
                "artifacts",
                "generic",
                "download",
                "--package=frontend",
                f'--repository={generic_repository["name"]}',
                f'--location={generic_repository["location"]}',
                f'--project={generic_repository["project"]}',
                "--destination=./",
                f'--version={frontend_version}'
            ],
            cwd=output_dir,
            check=True,
            text=True
        )

        subprocess.run(
            [
                "tar",
                "-xf",
                FRONTEND_BUILD_ARTIFACT_FILENAME,
            ],
            cwd=output_dir,
            check=True,
            text=True
        )

        # clean up: remove the downloaded frontend build bundle.
        os.remove(os.path.join(output_dir, FRONTEND_BUILD_ARTIFACT_FILENAME))

        print("Done downloading the frontend build bundle.")
    except subprocess.CalledProcessError as e:
        print(f"Error downloading frontend bundle: {e}")
        raise


def _construct_env_js_content(*, deployment_artifacts_dir: str, stack_name: str):
    sentry_frontend_dsn: str = getenv("SENTRY_FRONTEND_DSN")
    sentry_auth_token: str = getenv("SENTRY_AUTH_TOKEN", True)
    sensitive_personal_data_rsa_encryption_key: str = getenv("SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY")
    sensitive_personal_data_rsa_encryption_key_id: str = getenv("SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID")

    # validations, apart from the keys are required, some values also need to be validated
    # the sensitive encryption key should be a valid RSA public key.
    _validate_rsa_public_key(sensitive_personal_data_rsa_encryption_key.encode("utf-8"))

    print(f"Constructing the env.js file... for the run: {stack_name}")

    environment_outputs = get_pulumi_stack_outputs(stack_name=stack_name, module="environment")
    auth_outputs = get_pulumi_stack_outputs(stack_name=stack_name, module="auth")
    frontend_env_json = {
        "FIREBASE_API_KEY": base64_encode(auth_outputs["identity_platform_client_api_key"].value),
        "FIREBASE_AUTH_DOMAIN": base64_encode(auth_outputs["identity_platform_client_firebase_subdomain"].value),
        "BACKEND_URL": base64_encode(environment_outputs["backend_url"].value),

        "SENTRY_FRONTEND_DSN": base64_encode(sentry_frontend_dsn),
        "SENTRY_AUTH_TOKEN": base64_encode(sentry_auth_token),

        "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY": base64_encode(sensitive_personal_data_rsa_encryption_key),
        "SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID": base64_encode(sensitive_personal_data_rsa_encryption_key_id),
    }

    env_json_content = f"""window.tabiyaConfig = {json.dumps(frontend_env_json, indent=4)};"""
    frontend_env_json_file_path = os.path.join(deployment_artifacts_dir, "data", "env.js")
    with open(frontend_env_json_file_path, "w", encoding="utf-8") as file:
        file.write(env_json_content)


def prepare_frontend(
        *,
        stack_name: str,
):
    """
    Prepare the frontend for deployment.
    """

    # load the environment variables of the stack.
    load_dot_realm_env(stack_name)

    deployment_number = getenv("DEPLOYMENT_RUN_NUMBER")
    artifacts_version = getenv("ARTIFACTS_VERSION")

    frontend_version = parse_artifacts_version(artifacts_version).frontend_version
    _deployment_id = get_deployment_id(deployment_number=deployment_number, deploy_version=frontend_version)

    realm_name, _ = get_realm_and_env_name_from_stack(stack_name)

    # get the required environment variables, for the frontend.
    print(f"preparing frontend for the run: {_deployment_id}-{stack_name}...")

    # artifacts dir, the folder to store the frontend build bundle.
    artifacts_dir = os.path.join(ARTIFACTS_DIR, _deployment_id)

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
    deployment_id = get_deployment_id(deployment_number=_deployment_id, stack_name=stack_name)
    deployment_artifacts_dir = os.path.join(DEPLOYMENTS_DIR, deployment_id)
    shutil.copytree(artifacts_dir, deployment_artifacts_dir, dirs_exist_ok=True)

    # construct the env.js content.
    _construct_env_js_content(
        stack_name=stack_name,
        deployment_artifacts_dir=deployment_artifacts_dir
    )

    print(f"Done preparing frontend for the run: {_deployment_id}-{stack_name}.")
