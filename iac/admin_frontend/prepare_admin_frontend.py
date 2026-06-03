import json
import os
import sys
import shutil
import subprocess
from typing import Optional

# Determine the absolute path to the 'iac' directory
iac_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from within the iac/admin-frontend directory.
sys.path.insert(0, iac_folder)

from lib import getenv, get_realm_and_env_name_from_stack, \
    get_pulumi_stack_outputs, construct_artifacts_dir, save_content_in_file, \
    download_generic_artifacts_file, Version, base64_encode

from scripts.formatters import construct_artifacts_version

# The actual admin frontend build artifact filename is specified in the iac/scripts/build-and-upload-fe.sh script.
admin_frontend_build_artifact_filename = "admin-frontend-build.tar.gz"

# the constant directories.
current_dir = os.path.join(iac_folder, "admin_frontend")
base_artifacts_dir = os.path.join(current_dir, "_tmp", "artifacts")
deployments_dir = os.path.join(current_dir, "_tmp", "deployments")


def download_admin_frontend_bundle(
        *,
        realm_name: str,
        deployment_number: str,
        artifacts_version: Version) -> None:
    """
    Download the admin frontend build bundle given the admin frontend artifact version.

    Args:
        :param realm_name:
        :param deployment_number:
        :param artifacts_version:  The version of the admin frontend build bundle.
    """
    # 1. get the directory where to save the admin frontend build bundle.
    admin_frontend_artifacts_version = construct_artifacts_version(
        git_branch_name=artifacts_version.git_branch_name,
        git_sha=artifacts_version.git_sha
    )

    artifacts_dir = construct_artifacts_dir(
        deployment_number=deployment_number,
        fully_qualified_version=admin_frontend_artifacts_version)

    # artifacts dir, the folder to store the admin frontend build bundle.
    artifacts_destination_dir = os.path.join(base_artifacts_dir, artifacts_dir)
    os.makedirs(artifacts_destination_dir, exist_ok=False)

    # 2. Get the generic repository to download the admin frontend build bundle.
    realm_outputs = get_pulumi_stack_outputs(stack_name=realm_name, module="realm")

    # the generic repository name is defined in iac/realm/create_realm:_create_repositories method body
    # if it is not there python will raise `KeyError`, a good thing.
    realm_generic_repository = realm_outputs["generic_repository"].value

    print(f"Downloading the admin frontend build bundle... to {artifacts_destination_dir}")

    try:
        # 3. Download the admin frontend build bundle.
        download_generic_artifacts_file(
            repository=realm_generic_repository,
            version=admin_frontend_artifacts_version,
            file_name=admin_frontend_build_artifact_filename,
            output_dir=artifacts_destination_dir
        )

        # 4. extract the downloaded admin frontend build bundle.
        subprocess.run(
            [
                "tar",
                "-xf",
                admin_frontend_build_artifact_filename,
            ],
            cwd=artifacts_destination_dir,
            check=True,
            text=True
        )

        # clean up: remove the downloaded admin frontend build bundle.
        os.remove(os.path.join(artifacts_destination_dir, admin_frontend_build_artifact_filename))

        print("Done downloading the admin frontend build bundle.")
    except subprocess.CalledProcessError as e:
        print(f"Error downloading admin frontend bundle: {e}")
        raise


def _construct_env_js_content(*, artifacts_dir: str, stack_name: str):
    """
    Construct the env.js file for the admin frontend.

    This function reads environment variables and constructs the env.js file
    that will be used by the admin frontend application.

    Args:
        :param artifacts_dir: The directory where the admin frontend build bundle is stored.
        :param stack_name: The name of the Pulumi stack.
    """
    # Admin frontend Firebase authentication (manually created, passed via env vars)
    admin_firebase_api_key: str = getenv("ADMIN_FRONTEND_FIREBASE_API_KEY", False, True)
    admin_firebase_auth_domain: str = getenv("ADMIN_FRONTEND_FIREBASE_AUTH_DOMAIN", False, True)
    admin_firebase_tenant_id: Optional[str] = getenv("ADMIN_FRONTEND_FIREBASE_TENANT_ID", False, False)

    # Sentry configuration
    sentry_dsn: str = getenv("FRONTEND_SENTRY_DSN", True, False)
    enable_sentry: str = getenv("FRONTEND_ENABLE_SENTRY", False, False)
    sentry_config: str = getenv("FRONTEND_SENTRY_CONFIG", False, False)

    # Locales
    supported_locales = getenv("FRONTEND_SUPPORTED_LOCALES", False, True)
    default_locale = getenv("FRONTEND_DEFAULT_LOCALE", False, True)

    # Optional backend URL override
    custom_backend_url: Optional[str] = getenv("CUSTOM_BACKEND_URL", False, False)

    # Branding
    global_product_name: Optional[str] = getenv("GLOBAL_PRODUCT_NAME", False, False)
    frontend_browser_tab_title: Optional[str] = getenv("FRONTEND_BROWSER_TAB_TITLE", False, False)
    frontend_meta_description: Optional[str] = getenv("FRONTEND_META_DESCRIPTION", False, False)
    frontend_logo_url: Optional[str] = getenv("FRONTEND_LOGO_URL", False, False)
    frontend_ministry_url: Optional[str] = getenv("FRONTEND_MINISTRY_URL", False, False)
    frontend_favicon_url: Optional[str] = getenv("FRONTEND_FAVICON_URL", False, False)
    frontend_app_icon_url: Optional[str] = getenv("FRONTEND_APP_ICON_URL", False, False)
    frontend_theme_css_variables: Optional[str] = getenv("FRONTEND_THEME_CSS_VARIABLES", False, False)
    legal_site_base_url: Optional[str] = getenv("LEGAL_SITE_BASE_URL", False, False)

    print(f"Constructing the env.js file... for the run: {stack_name}")

    environment_outputs = get_pulumi_stack_outputs(stack_name=stack_name, module="environment")
    _, env_name = get_realm_and_env_name_from_stack(stack_name)
    firebase_project_id = environment_outputs["project_id"].value

    if custom_backend_url and custom_backend_url.strip():
        backend_url = custom_backend_url
    else:
        backend_url = environment_outputs["backend_url"].value

    frontend_env_json = {
        "ADMIN_FRONTEND_FIREBASE_API_KEY": base64_encode(admin_firebase_api_key),
        "ADMIN_FRONTEND_FIREBASE_AUTH_DOMAIN": base64_encode(admin_firebase_auth_domain),
        "ADMIN_FRONTEND_FIREBASE_TENANT_ID": base64_encode(admin_firebase_tenant_id),
        "ADMIN_FRONTEND_FIREBASE_PROJECT_ID": base64_encode(firebase_project_id),
        "BACKEND_URL": base64_encode(backend_url),
        "TARGET_ENVIRONMENT_NAME": base64_encode(env_name),
        "FRONTEND_ENABLE_SENTRY": base64_encode(enable_sentry),
        "FRONTEND_SENTRY_DSN": base64_encode(sentry_dsn),
        "FRONTEND_SENTRY_CONFIG": base64_encode(sentry_config),
        "FRONTEND_SUPPORTED_LOCALES": base64_encode(supported_locales),
        "FRONTEND_DEFAULT_LOCALE": base64_encode(default_locale),
        "GLOBAL_PRODUCT_NAME": base64_encode(global_product_name),
        "FRONTEND_BROWSER_TAB_TITLE": base64_encode(frontend_browser_tab_title),
        "FRONTEND_META_DESCRIPTION": base64_encode(frontend_meta_description),
        "FRONTEND_LOGO_URL": base64_encode(frontend_logo_url),
        "FRONTEND_MINISTRY_URL": base64_encode(frontend_ministry_url or ""),
        "FRONTEND_FAVICON_URL": base64_encode(frontend_favicon_url),
        "FRONTEND_APP_ICON_URL": base64_encode(frontend_app_icon_url),
        "FRONTEND_THEME_CSS_VARIABLES": base64_encode(frontend_theme_css_variables),
        "LEGAL_SITE_BASE_URL": base64_encode(legal_site_base_url),
    }

    env_json_content = f"""window.tabiyaConfig = {json.dumps(frontend_env_json, indent=4)};"""
    frontend_env_json_file_path = os.path.join(artifacts_dir, "data", "env.js")
    save_content_in_file(frontend_env_json_file_path, env_json_content)


def prepare_admin_frontend(
        *,
        stack_name: str):
    """
    Prepare the admin frontend for deployment.
     1. Ensures that the artifact is downloaded, otherwise downloads it.
     2. Copies the downloaded artifact to the stack artifacts dir
        Specifically for the stack name, otherwise the env.js will be the same for all the stacks.
     3. Constructs the env.js file for the admin frontend.
    """

    # Get the path to the admin frontend build bundle
    # This is specific to the deployment, and the stack name
    # because the admin frontend build bundle is specific to the deployment, and the stack name.
    # Because the admin-frontend/env.js file is specific to the deployment, and the stack name.
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

    # artifacts dir, the folder to store the admin frontend build bundle.
    artifacts_dir = os.path.join(base_artifacts_dir, artifacts_dir)

    realm_name, _ = get_realm_and_env_name_from_stack(stack_name)

    # get the required environment variables, for the admin frontend.
    print(f"preparing admin frontend for the run: {artifacts_dir}-{stack_name}...")

    # If the path (artifacts dir) already exists, skip, otherwise create it and download the admin frontend build bundle.
    # This should be the same folder for if the admin frontend deployments are on the same run.
    if not os.path.exists(artifacts_dir):
        # download the admin frontend build bundle.
        download_admin_frontend_bundle(
            realm_name=realm_name,
            deployment_number=deployment_number,
            artifacts_version=artifacts_version)

    # Have a copy of the artifacts for this deployment (the separate stack name),
    # so that we can make necessary changes to the admin frontend build bundle that are specific to the environment.
    stack_artifacts_dir = construct_artifacts_dir(
        deployment_number=deployment_number,
        fully_qualified_version=generic_artifact_version,
        stack_name=stack_name)

    # copy the artifacts to the stack artifacts dir, so that we can make necessary changes to the admin frontend build bundle.
    # copy the artifacts to the stack artifacts dir.
    stack_artifacts_dir = os.path.join(deployments_dir, stack_artifacts_dir)
    shutil.copytree(artifacts_dir, stack_artifacts_dir, dirs_exist_ok=True)

    # construct the env.js content for this deployment and stack.
    _construct_env_js_content(
        stack_name=stack_name,
        artifacts_dir=stack_artifacts_dir
    )

    print(f"Done preparing admin frontend for the run: {artifacts_dir}-{stack_name}.")
