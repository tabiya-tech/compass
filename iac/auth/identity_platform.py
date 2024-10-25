import json
from dataclasses import dataclass
import random
from urllib.parse import urlparse

import time
from typing import Any, Dict, Optional, Literal

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

import _differ
from transform_keys import convert_keys_to_snake_case, convert_keys_to_camel_case
from lib import int_to_base36


@dataclass(frozen=True)
class DNSInfoArgs:
    use_custom_domain: Optional[pulumi.Input[bool]] = None
    custom_domain: Optional[pulumi.Input[str]] = None

    def to_dict(self):
        return {
            "custom_domain": self.custom_domain,
            "use_custom_domain": self.use_custom_domain,
        }


@dataclass(frozen=True)
class VerifyEmailTemplateArgs:
    sender_local_part: Optional[pulumi.Input[str]] = None
    subject: Optional[pulumi.Input[str]] = None
    sender_display_name: Optional[pulumi.Input[str]] = None
    reply_to: Optional[pulumi.Input[str]] = None

    def to_dict(self):
        return {
            "sender_local_part": self.sender_local_part,
            "subject": self.subject,
            "sender_display_name": self.sender_display_name,
            "reply_to": self.reply_to,
        }


@dataclass(frozen=True)
class SendEmailArgs:
    callback_uri: Optional[pulumi.Input[str]] = None
    dns_info: Optional[pulumi.Input[DNSInfoArgs]] = None
    verify_email_template: Optional[pulumi.Input[VerifyEmailTemplateArgs]] = None

    def to_dict(self):
        return {
            "callback_uri": self.callback_uri,
            "dns_info": self.dns_info.to_dict() if hasattr(self.dns_info, "to_dict") else self.dns_info,
            "verify_email_template": self.verify_email_template.to_dict() if hasattr(self.verify_email_template, "to_dict") else self.verify_email_template,
        }


@dataclass(frozen=True)
class NotificationConfigArgs:
    send_email: Optional[pulumi.Input[SendEmailArgs]] = None

    def to_dict(self):
        return {
            "send_email": self.send_email.to_dict() if self.send_email else None,
        }


def _deep_delete(d, keys):
    """
    Recursively deletes nested keys from a dictionary.

    This function takes a dictionary and a list of keys (in dot-separated format)
    and attempts to remove them from the dictionary if they exist.

    :param d: The dictionary to remove the keys from.
    :param keys: A list of keys to remove, where nested keys are represented
                            in dot notation (e.g., "parent.child.grandchild").
    :return:
    """
    for key in keys:
        parts = key.split(".")
        sub_dict = d
        for part in parts[:-1]:
            if not isinstance(sub_dict, dict) or part not in sub_dict:
                break
            sub_dict = sub_dict[part]
        else:
            sub_dict.pop(parts[-1], None)


def _getconfig_for_api_body(props: dict[str, Any]) -> dict[str, Any]:
    """
    Converts the props to the format expected by the GCP API (camelCase keys).
    Exclude any keys that are not part of the specification.
    See https://cloud.google.com/identity-platform/docs/reference/rest/v2/Config for more details.
    :param props: The props to convert, expected to be in snake_case format.
    :return: A dictionary with the keys in camelCase format.
    """
    # remove any top level keys that are not part of the config
    _cfg = convert_keys_to_camel_case(props)
    _allowed_keys = ["signIn", "notification", "quota", "monitoring", "multiTenant", "authorizedDomains", "subTyp",
                     "client", "mfa", "blockingFunctions", "recaptchaConfig", "smsRegionConfig", "autodeleteAnonymousUsers",
                     "passwordPolicyConfig", "emailPrivacyConfig", "mobileLinksConfig"]
    _body = {k: v for k, v in _cfg.items() if k in _allowed_keys}

    # remove the keys that are read-only
    # Currently handling only a few keys, more keys can be added as needed
    keys_to_remove = [
        "signIn.hashConfig",
        "client.apiKey",
        "client.firebaseSubdomain",
        "notification.sendEmail.verifyEmailTemplate.customized",
        "notification.sendEmail.verifyEmailTemplate.body",
        "notification.sendEmail.verifyEmailTemplate.bodyFormat",
        "notification.sendEmail.dnsInfo.customDomain",
        "notification.sendEmail.dnsInfo.pendingCustomDomain",
        "notification.sendEmail.dnsInfo.customDomainState",
        "notification.sendEmail.dnsInfo.domainVerificationRequestTime",
    ]
    _deep_delete(_body, keys_to_remove)

    return _body


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
    # Use context manager to avoid leaving sockets open
    # https://github.com/googleapis/google-api-python-client/blob/main/docs/start.md
    with discovery.build(serviceName="identitytoolkit", version="v2", credentials=credentials) as service:
        try:
            # See https://cloud.google.com/identity-platform/docs/reference/rest/v2/projects/updateConfig
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


class DomainVerificationError(Exception):
    def __init__(self, message: str):
        super().__init__(message)


def _identity_platform_verify_domain(credentials: Any,
                                     project_id: str,
                                     domain: str,
                                     action: Literal['VERIFY', 'APPLY', 'CANCEL']
                                     ) -> tuple[Literal['SUCCEEDED', 'IN_PROGRESS', 'NOT_STARTED', 'FAILED'], Optional[str]]:
    """
    Verifies the domain for the email notifications for the Identity Platform.
    see https://cloud.google.com/identity-platform/docs/reference/rest/v2/projects.domain/verify
    :param credentials: The credentials to use for the API request
    :param project_id: The GCP project ID
    :param domain: The domain to verify
    :return: A tuple with the verification state and the verification error message.
    :raises: HttpError if the API request fails or the api returns an error.
    """
    # Use context manager to avoid leaving sockets open
    # https://github.com/googleapis/google-api-python-client/blob/main/docs/start.md
    with discovery.build(serviceName="identitytoolkit", version="v2", credentials=credentials) as service:
        try:
            # See https://cloud.google.com/identity-platform/docs/reference/rest/v2/projects/verifyDomain
            # Construct the correct API URL (manually, since it's not exposed in discovery)
            url = f"https://identitytoolkit.googleapis.com/admin/v2/projects/{project_id}/domain:verify"

            # Define the request body
            body = json.dumps({
                "domain": domain,
                "action": action
            })

            _response, _response_body = service._http.request(
                method="POST",
                uri=url,
                body=body,
                headers={"Content-Type": "application/json"}
            )
            # check the response status, if it is not 2xx, raise an error
            # For example, when APPLY is called it fails, it will return 400 with an error message on the response body
            if _response.status >= 400:
                raise HttpError(_response, _response_body, uri=url)
            response = json.loads(_response_body)
            return response.get("verificationState"), response.get("verificationError")
        except HttpError as e:
            pulumi.error(f"Failed to verify the 'domain: {domain}' for the Identity Platform notifications: {e}")
            raise
        except Exception as e:
            pulumi.error(f"Failed to make the request to to verify the 'domain: {domain}' for the Identity Platform notifications: {e}")
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


def _verify_domain(credentials: Any, _project_id: str, props: dict[str, Any]):
    _use_custom_domain = props.get("notification", {}).get("send_email", {}).get("dns_info", {}).get("use_custom_domain", False)
    _custom_domain = props.get("notification", {}).get("send_email", {}).get("dns_info", {}).get("custom_domain")
    if _use_custom_domain:
        pulumi.info(f"Verifying the 'domain: {_custom_domain}' for email notifications for 'project: {_project_id}'")
        # retry the domain verification for 10 minutes (60 seconds * 10)
        _timeout = 300  # 5 minutes
        _retry_interval = 10  # 10 seconds
        _elapsed_time = 0
        _started_at = time.time()
        while _elapsed_time < _timeout:  # 1 minutes
            _verification_state, _error_text = _identity_platform_verify_domain(credentials, _project_id, _custom_domain, "VERIFY")
            if _verification_state == "SUCCEEDED":
                pulumi.info(f"Verified 'domain: {_custom_domain}' for email notifications for 'project: {_project_id}'")
                pulumi.info(f"Applying the verification of the 'domain: {_custom_domain}' for email notifications for 'project: {_project_id}'")
                # APPLY will throw an error if the verification is not successful, no need to check the state
                _identity_platform_verify_domain(credentials, _project_id, _custom_domain, "APPLY")
                break

            if _verification_state == 'FAILED' or _error_text != "":
                _err_msg = f"Failed to verify the 'domain: {_custom_domain}' for email notifications for 'project: {_project_id}', 'reason: {_error_text}'"
                pulumi.error(_err_msg)
                # Cancel the verification
                pulumi.info(f"Cancelling the verification of the 'domain: {_custom_domain}' for email notifications for 'project: {_project_id}'")
                _identity_platform_verify_domain(credentials, _project_id, _custom_domain, "CANCEL")
                raise DomainVerificationError(_err_msg)

            if _verification_state not in ["IN_PROGRESS", "NOT_STARTED"]:
                raise DomainVerificationError(f"Unknown 'verification state:{_verification_state}' for the 'domain: {_custom_domain}' "
                                              f"for the email notifications for 'project: {_project_id}'")

            pulumi.info(f"Verification for 'domain: {_custom_domain}' in progress since {_elapsed_time} for email notifications for 'project: {_project_id}'")
            # if the timeout is will be reached, raise an error
            if _elapsed_time + _retry_interval >= _timeout:
                # Cancel the verification
                pulumi.info(f"Timed out, cancelling the verification of the 'domain: {_custom_domain}' for email notifications for 'project: {_project_id}'")
                _identity_platform_verify_domain(credentials, _project_id, _custom_domain, "CANCEL")
                raise TimeoutError(f"Failed to verify the domain {_custom_domain} for the email notifications for project: {_project_id}")
            time.sleep(_retry_interval)
            _elapsed_time = time.time() - _started_at


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

    # Do the domain verification for the email notifications if needed
    try:
        _verify_domain(_credentials, _project_id, props)
    except Exception as e:
        pulumi.error(f"Failed to verify the domain for the email notifications: {e}")
        pulumi.info("Reverting the Identity Platform config 'use_custom_domain: False'")
        _cfg["notification"]["sendEmail"]["dnsInfo"]["useCustomDomain"] = False
        _current_cfg = _identity_platform_update_config(_credentials, _project_id, _cfg)
        raise e

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

        # Validate the notifications sendmail args
        _use_custom_domain = _news.get("notification", {}).get("send_email", {}).get("dns_info", {}).get("use_custom_domain", False)
        _custom_domain = _news.get("notification", {}).get("send_email", {}).get("dns_info", {}).get("custom_domain")
        if _use_custom_domain and _custom_domain is None:
            raise ValueError("The 'custom_domain' should be set in the notification_config args when 'use_custom_domain' is set to True.")

        # Verify the domain for the email notifications
        _callback_uri = _news.get("notification", {}).get("send_email", {}).get("callback_uri")
        _callback_hostname = urlparse(_callback_uri).hostname
        if _callback_hostname and not _use_custom_domain:
            raise ValueError("The 'callback_uri' should be set in the 'notification_config' args "
                             "with a valid hostname when 'use_custom_domain' is set to True.")
        if _use_custom_domain and not _callback_hostname:
            raise ValueError("The 'callback_uri' should not be set in the 'notification_config' args "
                             "when 'use_custom_domain' is set to False.")
        if _use_custom_domain and _callback_hostname:
            if not _callback_hostname.endswith(_custom_domain):
                raise ValueError(f"The 'callback_uri:{_callback_hostname}' hostname in the 'notification_config' args "
                                 f"must end with the custom 'custom_domain:{_custom_domain}'.")

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

        # Get the config in the format expected by the GCP API so that we can diff only the relevant keys and not the entire config
        _news_cfg = _getconfig_for_api_body(_news)
        _olds_cfg = _getconfig_for_api_body(_olds)
        # Diff the config to see if the _news_cfg will cause a patch when applied to _olds_cfg
        _changes = _differ.will_patch(_news_cfg, _olds_cfg)

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

       Replace `{{project}}` with your GCP project ID (e.g., `compass-poc-1234`).
       This is needed because the Identity Platform remains enabled in the underlying GCP project.

    Improvements in the current implementation over the standard provider:
    This custom implementation addresses these issues by:
    - Supporting updates to an already-enabled Identity Platform.
    - Allowing deletion via an empty configuration.
    - Handling re-creation of the resource even if the Identity Platform was previously enabled, eliminating the need for manual imports.
    - Support the configuration of the notification settings such as the email template and custom domain settings.

    """

    # (Optional) For IDE type hints, define class attributes
    client: pulumi.Output[dict]

    def __init__(self, name: str, *, config: gcp.identityplatform.ConfigArgs = None, notification_config: NotificationConfigArgs = None,
                 opts: pulumi.ResourceOptions = None):
        # Convert the config and notification_config to a dictionary
        _props = {**config.__dict__} if config else {}
        _props.update({"notification": notification_config.to_dict()} if notification_config else {})

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
