import os
import subprocess
import sys

# Determine the absolute path to the 'iac' directory
iac_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/backend directory.
sys.path.insert(0, iac_folder)

from lib import get_pulumi_stack_outputs, construct_artifacts_dir, parse_artifacts_version

current_dir = os.path.join(iac_folder, "backend")

# the GCP API config file name
# it should match the file name at `backend/scripts/convert_to_openapi2.py`
api_gateway_config_file_name = "api_gateway_config.yaml"
base_configuration_dir = os.path.join(current_dir, "_tmp", "configs")


def download_backend_config(*,
                            realm_name: str,
                            deployment_number: str,
                            artifacts_version: str) -> None:
    """
    Download the backend configurations.
    1. api gateway config file.
    """

    # construct the directory to save the backend config for this deployment.
    docker_tag = parse_artifacts_version(artifacts_version).docker_tag_version

    # the backend config are stored in the generic repository.
    generic_artifacts_version = parse_artifacts_version(artifacts_version).generic_artifact_version

    config_dir = construct_artifacts_dir(deployment_number=deployment_number, artifacts_version=docker_tag)
    backend_config_output_dir = os.path.join(base_configuration_dir, config_dir)
    os.makedirs(backend_config_output_dir, exist_ok=False)

    realm_outputs = get_pulumi_stack_outputs(stack_name=realm_name, module="realm")
    generic_repository = realm_outputs["generic_repository"].value

    # download the configurations.
    try:
        print(f"Downloading the backend config to {backend_config_output_dir}")

        subprocess.run(
            [
                "gcloud",
                "artifacts",
                "generic",
                "download",
                "--package=backend-config",
                f'--repository={generic_repository["name"]}',
                f'--location={generic_repository["location"]}',
                f'--project={generic_repository["project"]}',
                "--destination=./",
                f"--version={generic_artifacts_version}"
            ],
            cwd=backend_config_output_dir,
            check=True,
            text=True
        )

        print("Done downloading the backend config bundle.")
    except subprocess.CalledProcessError as e:
        print(f"Error downloading backend config: {e}")
        raise
