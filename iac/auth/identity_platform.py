import random
import time
from typing import Any, Dict

import google
import pulumi
from googleapiclient import discovery
from googleapiclient.errors import HttpError
from pulumi.dynamic import Resource, ResourceProvider, CreateResult, CheckResult, CheckFailure, UpdateResult, DiffResult
import pulumi_gcp as gcp

# Determine the absolute path to the 'iac' directory
import os
import sys

libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/auth directory
sys.path.insert(0, libs_dir)

from transform_keys import convert_keys_to_snake_case, snake_to_camel, convert_keys_to_camel_case
from lib import int_to_base36


class _Differ:
    """
    Helper class for comparing the values of the Identity Platform configuration.

    Since the Identity Platform configuration is a nested structure, we need to compare the values of its nested keys.
    Some values may be read-only and should not be included in the comparison.

    The configuration returned by the GCP API omits keys that are either not set, set to None, or set to empty dictionaries.
    Similarly, boolean values set to False, string values set to empty strings, and list values set to empty lists
    may also be omitted.

    The comparison logic should account for these omissions.
    """

    # Helper methods to get the values for the diff
    @staticmethod
    def get_boolean_value_for_diff(value: Any) -> bool:
        if value is None:
            return False
        return value

    @staticmethod
    def get_dict_value_for_diff(value: Any) -> dict:
        if value is None:
            return {}
        return value

    @staticmethod
    def get_list_value_for_diff(value: Any) -> list:
        if value is None:
            return []
        return value

    # Helper methods to compare the Permission values
    @staticmethod
    def _permissions_equal(old: any, new: any) -> bool:
        # If both falsy, they are equal
        if _Differ._permission_value_is_falsy(old) and _Differ._permission_value_is_falsy(new):
            return True
        # If one is falsy and the other is not falsy, they are not equal
        if _Differ._permission_value_is_falsy(old) or _Differ._permission_value_is_falsy(new):
            return False
        # When both are truthy, compare the values
        return old == new

    @staticmethod
    def _permission_value_is_falsy(v: any) -> bool:
        # If the permission key is None or an empty dict, it is "falsy"
        if v is None or v == {}:
            return True
        # If the permission key is a dict with all falsy values, it is "falsy"
        return (_Differ.get_boolean_value_for_diff(v.get("disabled_user_deletion")) is False
                and _Differ.get_boolean_value_for_diff(v.get("disabled_user_signup")) is False)

    @staticmethod
    def _client_values_is_falsy(v: any) -> bool:
        # If the client key is None or an empty dict, it is "falsy"
        if v is None or v == {}:
            return True
        # If the client.permissions key is "falsy", the client is "falsy"
        return _Differ._permission_value_is_falsy(v.get("permissions"))

    @staticmethod
    def _sign_in_values_is_falsy(value: Any) -> bool:
        if value is None or value == {}:
            return True

        # Note: This is not a complete check, because ideally we would have to traverse the nested keys and decide.
        return (
                _Differ.get_boolean_value_for_diff(value.get("allow_duplicate_emails")) is False and
                (value.get("anonymous") is None or value.get("anonymous") == {}) and
                (value.get("email") is None or value.get("email") == {})
        )

    ######################################################################
    # Methods to compare the values of the Identity Platform config
    ######################################################################
    @staticmethod
    def clients_equal(old: any, new: any) -> bool:
        # The apikey and the firebase_subdomain cannot be updated, so we should not compare them
        # The permissions can be updated, so we should compare them.

        # If both falsy, they are equal
        if _Differ._client_values_is_falsy(old) and _Differ._client_values_is_falsy(new):
            return True
        # If one is falsy and the other is not falsy, they are not equal
        if _Differ._client_values_is_falsy(old) or _Differ._client_values_is_falsy(new):
            return False
        # When both are truthy, compare the values of the permissions
        return _Differ._permissions_equal(old.get("permissions"), new.get("permissions"))

    @staticmethod
    def sign_in_equal(old: any, new: any) -> bool:
        # If both falsy, they are equal
        if _Differ._sign_in_values_is_falsy(old) and _Differ._sign_in_values_is_falsy(new):
            return True

        # If one is falsy, and the other is not falsy, they are not equal.
        if _Differ._sign_in_values_is_falsy(old) or _Differ._sign_in_values_is_falsy(new):
            return False

        # When both are truthy, compare the values
        return (
                _Differ.get_boolean_value_for_diff(old.get("allow_duplicate_emails")) == _Differ.get_boolean_value_for_diff(new.get("allow_duplicate_emails")) and
                old.get("anonymous") == new.get("anonymous") and
                old.get("email") == new.get("email")
        )

    @staticmethod
    def auto_delete_anonymous_users_equal(old: any, new: any) -> bool:
        return _Differ.get_boolean_value_for_diff(old) == _Differ.get_boolean_value_for_diff(new)

    @staticmethod
    def authorized_domains_equal(old: any, new: any) -> bool:
        return _Differ.get_list_value_for_diff(old) == _Differ.get_list_value_for_diff(new)


def _getconfig_for_api_body(props: dict[str, Any]) -> dict[str, Any]:
    """
    Converts the props to the format expected by the GCP API (camelCase keys).
    Exclude any keys that are not part of the specification.
    See https://cloud.google.com/identity-platform/docs/reference/rest/v2/Config for more details.
    :param props: The props to convert, expected to be in snake_case format.
    :return: A dictionary with the keys in camelCase format.
    """

    _allowed_keys_snake = ["authorized_domains", "autodelete_anonymous_users", "blocking_functions", "client", "mfa",
                           "monitoring", "multi_tenant", "quota", "sign_in", "sms_region_config"]
    _allowed_keys_camel = [snake_to_camel(k) for k in _allowed_keys_snake]
    _allowed_keys = _allowed_keys_snake + _allowed_keys_camel

    _body = {k: v for k, v in props.items() if k in _allowed_keys}
    # remove the keys that are read-only
    # sign_in.hash_config, client.api_key, client.firebase_subdomain
    if _body.get("sign_in") and _body["sign_in"].get("hash_config"):
        del _body["sign_in"]["hash_config"]
    if _body.get("client"):
        if _body["client"].get("api_key"):
            del _body["client"]["api_key"]
        if _body["client"].get("firebase_subdomain"):
            del _body["client"]["firebase_subdomain"]

    cfg = convert_keys_to_camel_case(_body)

    return cfg


def _identity_toolkit_api_enable(credentials: Any, project_id: str):
    """
    Enables the Identity Toolkit (Identity Platform) API for the given GCP project.
    :param credentials: The credentials to use for the API request
    :param project_id: The GCP project number
    """
    try:
        # See https://cloud.google.com/service-usage/docs/reference/rest/v1/services/enable
        service = discovery.build("serviceusage", "v1", credentials=credentials)
        service_name = f"projects/{project_id}/services/identitytoolkit.googleapis.com"
        request = service.services().enable(name=service_name, body={})
        response = request.execute()
        pulumi.info(f"Enabled Identity Toolkit API for project {project_id}")
        pulumi.debug("Enabled Identity Toolkit API:", response)
    except Exception as e:
        pulumi.error(f"Failed to enable Identity Toolkit API: {e}")
        raise


def _identity_toolkit_api_get_state(credentials: Any, project_id: str) -> bool:
    """
    Returns the state the Identity Toolkit (Identity Platform) API for the given GCP project.
    :param credentials: The credentials to use for the API request
    :param project_id: The GCP project number
    :return: True if the API is enabled, False if disabled or in an unknown state.
    """
    try:
        # See https://cloud.google.com/service-usage/docs/reference/rest/v1/services/get
        service = discovery.build("serviceusage", "v1", credentials=credentials)
        service_name = f"projects/{project_id}/services/identitytoolkit.googleapis.com"
        request = service.services().get(name=service_name)
        response = request.execute()
        pulumi.info(f"Get Identity Toolkit API state for project {project_id}")
        pulumi.debug("Get State Identity Toolkit API:", response)
        return response.get("state") == "ENABLED"
    except Exception as e:
        pulumi.error(f"Failed to get Identity Toolkit API state: {e}")
        raise


def _identity_platform_enable(credentials: Any, project_id: str):
    """
    Enables the Identity Toolkit (Identity Platform) for the given GCP project.
    :param credentials: The credentials to use for the API request
    :param project_id: The GCP project ID
    """

    # Build the Service Usage API client (v1)
    try:
        # See https://cloud.google.com/identity-platform/docs/reference/rest/v2/projects.identityPlatform/initializeAuth
        service = discovery.build("identitytoolkit", "v2", credentials=credentials)
        service_name = f"projects/{project_id}"
        request = service.projects().identityPlatform().initializeAuth(
            project=service_name,
            body={}
        )
        request.execute()
        pulumi.info(f"Enabled Identity Platform for project: {project_id}")
    except Exception as e:
        pulumi.error(f"Failed to enable Identity Platform: {e}")
        raise


def _identity_platform_get_config(credentials: Any, project_id: str) -> dict[str, Any] | None:
    """
    Retrieves the Identity Platform config resource for the given GCP project.
    :param credentials:
    :param project_id:
    :raises: HttpError if the API request fails
    :return: None, if the Identity Platform not enabled or
             a dictionary with the Identity Platform config resource with the keys in camelCase format.
             See https://cloud.google.com/identity-platform/docs/reference/rest/v2/Config for more details
    """
    try:
        # See https://cloud.google.com/identity-platform/docs/reference/rest/v2/projects/getConfig
        service = discovery.build('identitytoolkit', 'v2', credentials=credentials)
        name = f"projects/{project_id}/config"
        request = service.projects().getConfig(name=name)
        response = request.execute()
        pulumi.debug(f"Retrieved Identity Platform config: {response}")
        return response
    except HttpError as e:
        if e.resp.status == 404 or e.resp.status == 403:
            pulumi.warn(f"Identity Platform not enabled for project: {project_id}")
            # This means the config (resource) is not found, which implies Identity Platform not enabled.
            return None
        # If it's some other status code, re-raise for visibility
        pulumi.error(f"Failed to get Identity Platform config: {e}")
        raise
    except Exception as e:
        pulumi.error(f"Failed to make the request to get Identity Platform config: {e}")
        raise


def _wait_for_update_config_to_apply(credentials: Any, project_id: str) -> dict[str, Any]:
    """
    Waits for the Identity Platform client to be created successfully.

    For now, we are ensuring:
     --> apiKey and firebaseSubdomain are set in the client.

    :returns idp_config: The Identity Platform config resource with the keys in camelCase format.
    """

    _idp_config = _identity_platform_get_config(credentials, project_id)
    retries = 10

    while retries > 0:
        idp_config_client = _idp_config["client"]
        if idp_config_client.get("apiKey") and idp_config_client.get("firebaseSubdomain"):
            pulumi.info(f"Identity Platform client created successfully. after {10 - retries} retries")
            return _idp_config

        retries -= 1
        time.sleep(10)
        pulumi.info("Waiting for 10 seconds for the Identity Platform client to be created.")
        _idp_config = _identity_platform_get_config(credentials, project_id)

    raise TimeoutError(
        "Failed to read the apiKey, firebaseSubdomain of the the Identity Platform client within 100 seconds.")


def _identity_platform_update_config(credentials: Any, project_id: str, cfg: dict[str, Any]) -> dict[str, Any]:
    """
    Updates the project's Identity Platform config resource.
    :param credentials: The credentials to use for the API request
    :param project_id: The GCP project ID
    :param cfg: The Identity Platform config resource to update. It should be a dictionary with the keys in camelCase format.
                See https://cloud.google.com/identity-platform/docs/reference/rest/v2/Config for more details.
    :raises: HttpError if the API request fails
    """

    try:
        # See https://cloud.google.com/identity-platform/docs/reference/rest/v2/projects/updateConfig
        service = discovery.build(serviceName="identitytoolkit", version="v2", credentials=credentials)
        name = f"projects/{project_id}/config"
        # The 'updateMask' indicates which fields we want to update.
        # An empty mask means we want to update all fields.
        update_mask = None  # "signIn,mfa,authorizedDomains"
        request = service.projects().updateConfig(
            name=name,
            updateMask=update_mask,
            body=cfg
        )
        response = request.execute()
        if cfg == {}:  # If the config is empty, it means we are deleting the config
            pulumi.info(f"Deleted Identity Platform config for project: {project_id}")
        else:
            # ensure the client is created successfully
            # with all the expected properties already there.
            response = _wait_for_update_config_to_apply(credentials, project_id)
            pulumi.info(f"Updated Identity Platform config for project: {project_id}")
        pulumi.debug("Updated Identity Platform config successfully:", response)
        return response
    except HttpError as e:
        pulumi.error(f"Failed to update Identity Platform config: {e}")
        raise
    except TimeoutError as e:
        # Failed to read the apiKey, firebaseSubdomain so fail as these values are required by downstream resources
        pulumi.error(f"Failed to verify that Identity Platform config was updated: {e}")
        raise
    except Exception as e:
        pulumi.error(f"Failed to make the request to update Identity Platform config: {e}")
        raise


def get_credentials() -> Any:
    #    google_credentials = getenv("GOOGLE_CREDENTIALS", True)
    #    _credentials, _ = google.auth.load_credentials_from_file(google_credentials, scopes=["https://www.googleapis.com/auth/cloud-platform"])
    _credentials, _ = google.auth.default()
    return _credentials


def _get_id() -> str:
    """
    Generates a random ID for the Identity Platform resource.
    :return:
    """
    random_int = random.Random().randrange(
        2 ** 32 - 1,  # 32bit integer
        2 ** 64 - 1)  # 64bit integer
    random_id = int_to_base36(random_int)
    return f"identity-platform-{random_id}"


def _apply_config(props: dict[str, Any]) -> dict[str, Any]:
    _project_id = props.get("project")
    if _project_id is None:
        raise ValueError(f"'project' is missing in props! Received props: {props}")

    _credentials = get_credentials()
    if _credentials is None:
        raise ValueError("Failed to get the credentials.")

    # Check if the project has an identity platform enabled
    if _identity_platform_get_config(_credentials, _project_id):  # if there is already config so it is enabled
        pulumi.info(f"Identity Platform already enabled for the project: {_project_id}")
    else:  # if not enabled, enable it
        pulumi.info(f"Identity Platform is not enabled for the project: {_project_id} and will be enabled now.")
        if not _identity_toolkit_api_get_state(_credentials, _project_id):
            pulumi.info(f"Identity Toolkit API not enabled for project: {_project_id}")
            # First make sure the Identity Toolkit API is enabled
            _identity_toolkit_api_enable(_credentials, _project_id)
        else:
            pulumi.info(f"Identity Toolkit API already enabled for project: {_project_id}")
        # Then enable the Identity Platform
        _identity_platform_enable(_credentials, _project_id)

    # To Convert the props to the format expected by the GCP API (camelCase keys)
    _cfg = _getconfig_for_api_body(props)

    # Update the Identity Platform config and get the current config
    _current_cfg = _identity_platform_update_config(_credentials, _project_id, _cfg)

    # Convert the keys to snake_case to match the input props
    _current_cfg = convert_keys_to_snake_case(_current_cfg)
    # If present, remove some keys that should not be returned in the outputs
    # sign_in.hash_config
    if _current_cfg.get("sign_in") and _current_cfg["sign_in"].get("hash_config"):
        del _current_cfg["sign_in"]["hash_config"]

    # Set the project id in the response so that it is available in the outputs when deleting the resource
    _current_cfg["project"] = _project_id
    # Set the resource name in the response so that it is available in the outputs when deleting the resource
    _current_cfg["resource_name"] = props.get("resource_name")

    return _current_cfg


# Custom Resource Provider for Identity Platform
class IdentityPlatformProvider(ResourceProvider):
    def __init__(self):
        super().__init__()

    def check(self, _olds: Dict[str, Any], news: Dict[str, Any]) -> CheckResult:
        pulumi.info("Checking the Identity Platform config")

        _failures = []
        _project_id = news.get("project")
        if _project_id is None:
            _failures.append(CheckFailure("project", "project is missing in props"))

        # Convert the news to a dictionary in the snake case format to match the input props
        _news = convert_keys_to_snake_case(news)

        # Check if the project has an identity platform enabled
        return CheckResult(_news, _failures)

    def create(self, props: dict[str, Any]) -> CreateResult:
        pulumi.info("Creating the Identity Platform")
        cfg = _apply_config(props)
        return CreateResult(id_=_get_id(), outs=cfg)

    def update(
            self,
            _id: str,
            _olds: Dict[str, Any],
            _news: Dict[str, Any],
    ) -> UpdateResult:
        pulumi.info("Updating the Identity Platform")
        cfg = _apply_config(_news)
        return UpdateResult(cfg)

    def diff(
            self,
            _id: str,
            _olds: Dict[str, Any],
            _news: Dict[str, Any],
    ) -> DiffResult:
        pulumi.info("Diffing the Identity Platform")
        # If the project is changed, delete the resource before replacing it
        if _news.get("project") != _olds.get("project"):
            return DiffResult(True, ["project"], [], True)
        if _news.get("resource_name") != _olds.get("resource_name") and _olds.get("resource_name") is not None:
            # When the resource name is changed, we need to delete the resource before replacing it
            # to avoid deleting the config after the resource is created with the new name
            # For this to work use the opts: aliases=[pulumi.Alias(name=<old_name>)] so that pulumi can track the resource and
            # do a diff before deciding to delete or replace.
            # If the resource name is changed without the alias, pulumi will not even diff the resource and will just create it with the new name and then
            # delete the old resource. This will cause the config to be deleted after the new resource is created.
            return DiffResult(True, ["resource_name"], [], True)

        _changes = False
        # Iterate over the properties and check if the values have changed
        for k, v in _news.items():
            if k == "provider" or k == "resource_name" or k == "project":
                continue
            elif k == "client":
                if not _Differ.clients_equal(v, _olds.get(k)):
                    _changes = True
                    break
            elif k == "autodelete_anonymous_users":
                if not _Differ.auto_delete_anonymous_users_equal(v, _olds.get(k)):
                    _changes = True
                    break
            elif k == "sign_in":
                if not _Differ.sign_in_equal(v, _olds.get(k)):
                    _changes = True
                    break
            elif v != _olds.get(k):
                _changes = True
                break

        return DiffResult(_changes, [], [], False)

    def delete(self, _id: str, _props: Any):
        """
        Deletes the Identity Platform config for the given project.
        The platform cannot be disabled once it has been enabled.
        :param _id:
        :param _props:
        """
        pulumi.info("Deleting the Identity Platform")

        _project_id = _props.get("project")

        if _project_id is None:
            raise ValueError(f"'project' is missing in props! Received props: {_props}")

        _credentials = get_credentials()
        if _credentials is None:
            raise ValueError("Failed to get the credentials.")

        # Check if the project has an identity platform enabled
        if not _identity_platform_get_config(_credentials, _project_id):  # If there is no config, it is not enabled
            pulumi.warn(f"Identity Platform already disabled for the project: {_project_id}")
            return

        pulumi.info(f"IdentityPlatform config will be deleted for project: {_project_id}")
        # Delete the Identity Platform config
        _identity_platform_update_config(_credentials, _project_id, {})  # pass an empty config to delete the config


# Custom Resource for Identity Platform
class IdentityPlatform(Resource):
    """
    Custom Resource for Managing the Identity Platform in GCP.

    The Identity Platform cannot be disabled once enabled, and the standard Pulumi GCP provider (gcp.identityplatform.Config) has the following limitations:
    1. Fails to re-create the Identity Platform after the resource is destroyed.
    2. Does not clean up the Identity Platform configuration when the resource is destroyed.
    3. Requires either the deletion and recreation of the project that hosts the identity platform, or a manual import workaround
       to re-create the resource after a `pulumi destroy` due to its read-only nature.
       Workaround for the Standard Implementation:
       With the standard implementation (gcp.identityplatform.Config),
       re-creating the stack after a `pulumi destroy` requires manually importing the Identity Platform configuration using:

       $ pulumi import gcp:identityplatform/config:Config default {{project}}

       Replace `{{project}}` with your GCP project ID (e.g., `auth-poc-422113`).
       This is needed because the Identity Platform remains enabled in the underlying GCP project.

    Improvements in the Current Implementation:
    This custom implementation addresses these issues by:
    - Supporting updates to an already-enabled Identity Platform.
    - Allowing deletion via an empty configuration.
    - Handling re-creation of the resource even if the Identity Platform was previously enabled, eliminating the need for manual imports.

    This approach ensures smooth management of the Identity Platform lifecycle in Pulumi, avoiding the limitations of the standard provider.
    """

    # (Optional) For IDE type hints, define class attributes
    client: pulumi.Output[dict]

    def __init__(self, name: str, *, config: gcp.identityplatform.ConfigArgs = None,
                 opts: pulumi.ResourceOptions = None):
        _props = {**config.__dict__}
        if _props.get("project") is None:
            # If the project is not set in the config args, get it from the provider
            _provider = getattr(opts, "provider", None)  # Safe check for opts and opts.provider
            _project = getattr(_provider, "project", None)  # Safe check for provider and provider.project
            if _project is None:
                raise ValueError("The 'project' should be set in the config args or in the provider args.")
            _props["project"] = _project

        # Manually add client.api_key and client.firebase_subdomain to the properties
        # so they are included in the resource outputs. Only take client.permissions
        # from the configuration arguments, and only if it is present, as it can be updated.
        # Other values are read-only and should not be included in the outputs
        if _props.get("client") is None:
            _props["client"] = gcp.identityplatform.ConfigClientArgs()
        _props["resource_name"] = name
        super().__init__(IdentityPlatformProvider(), name=name, props=_props, opts=opts)
