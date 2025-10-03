import base64
import os
import re
import string
import hashlib
import subprocess

import pulumi
import pulumi_gcp as gcp
import pulumiverse_time as time
from dataclasses import dataclass
from pathlib import Path

from typing import Optional, Any, Mapping

from dotenv import find_dotenv, load_dotenv, dotenv_values
import pulumi.automation as auto

iac_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


@dataclass(frozen=True)
class ProjectBaseConfig:
    project: str | pulumi.Output[str]
    location: str | pulumi.Output[str]
    provider: gcp.Provider


def getstackref(stack_ref: pulumi.StackReference, name: str, secret: bool = False) -> pulumi.Output[Any]:
    """
    Get the stack reference value. Log the value if it is not a secret,
    otherwise log the secret value as a series of '*'

    :param stack_ref: the stack reference
    :param name: the value name
    :param secret: whether the value is a secret.
    :return:
    """
    value_output = stack_ref.get_output(name)

    def handle_value(v: Any) -> Any:
        if not v:
            pulumi.error(f"{name} is not set in the referenced stack")
            raise ValueError(f"{name} is not set in the referenced stack")

        if not secret:
            pulumi.log.info(f"Using stack ref variable {name}: {v}")
        else:
            pulumi.log.info(f"Using secret stack ref variable {name}: {'*' * len(v)}")

    value_output.apply(handle_value)
    return value_output


def getconfig(name: str, config: Optional[str] = None, *, secret: bool = False) -> str:
    """
    Get the configuration value from the pulumi configuration. Log the value if it is not a secret,
    otherwise log the secret value as a series of '*'

    :param name: the configuration name
    :param config: the pulumi configuration namespace
    :param secret: whether the configuration is a secret
    :return: the configuration value
    :raises ValueError: if the configuration value is not set.
    """

    value = pulumi.Config(config).require(name)
    if not value:
        raise ValueError(f"configuration value {name} is not set")

    key = name
    if config is not None:
        key = f"{config}:{name}"

    if not secret:
        pulumi.log.info(f"Using configuration variable {key}: {value}")
    else:
        pulumi.log.info(f"Using secret configuration variable {key}: {'*' * len(value)}")
    return value


def load_dot_realm_env(stack_name: str):
    """
    Load the environment variables from the .env file for the given stack name.
    :param stack_name: The stack name to load the environment variables for.
    :return:
    """
    dot_env = find_dotenv(filename=f".env.{stack_name}", raise_error_if_not_found=True)
    pulumi.info(f"Loading environment variables from {dot_env}")
    print(f"Loading environment variables from {dot_env}")
    # Override the environment variables with the ones in the .env file.
    # This is especially important when handling multiple environments each of which will have its own .env file.
    load_dotenv(dotenv_path=dot_env, override=True)


def clear_dot_env(stack_name: str):
    """
    Unsets all environment variables defined in the given .env file.
    :param stack_name: The stack name to clear the environment variables for.
    :return:
    """
    dot_env = find_dotenv(filename=f".env.{stack_name}", raise_error_if_not_found=True)
    pulumi.info(f"Clearing environment variables from {dot_env}")
    print(f"Clearing environment variables from {dot_env}")
    env_vars = dotenv_values(dotenv_path=dot_env)

    for key in env_vars.keys():
        if key in os.environ:
            del os.environ[key]


def getenv(name: str, secret: bool = False, required: bool = True) -> str:
    """
    Get the environment variable. Log the value if it is not a secret, otherwise log the secret value as a series of '*'
    :param name: the environment variable name
    :param secret: whether the environment variable is a secret
    :param required: whether the environment variable is required
    :return: the environment variable value
    :raises ValueError: if the environment variable is not set
    """

    value = os.getenv(name)

    # Treat empty/placeholder values as unset when not required
    if not required:
        if value is None:
            value = None
        else:
            trimmed = value.strip()
            if trimmed == "" or trimmed.lower() in ("none", "null"):
                value = None
            else:
                value = trimmed

    if required and not value:
        raise ValueError(f"environment variable {name} is not set")

    if secret and value:
        pulumi.log.info(f"Using secret environment variable {name}: {'*' * len(value)}")
    else:
        pulumi.log.info(f"Using environment variable {name}: {value}")

    return value


def get_file_as_string(file: str):
    return Path(file).read_text()


def get_project_base_config(*, project: str | pulumi.Output[str], location: str):
    """
    Get the project base configuration
    The configuration includes a provider that can be used to create resources in the project, independently of the
    project the serviceAccount that pulumi will run was created in.
    This is especially important when creating resources in a project that is not the root project (the service account
    is created in the root project).

    :param project: The project id to create the resources in.
    :param location: The location of the project.
    :return: The project base configuration.
    """
    gcp_provider = gcp.Provider(
        "gcp_provider",
        project=project,
        user_project_override=True)
    return ProjectBaseConfig(project=project, location=location, provider=gcp_provider)


# construct the project name based on the realm name and environment name etc
def get_resource_name(*, resource: str, resource_type: str = None):
    """
    Get the resource name
    :param resource:
    :param resource_type:
    :return:
    """
    if resource_type:
        return f"{resource}-{resource_type}"
    return resource


def enable_services(provider: gcp.Provider, service_names: list[str], dependencies: list) -> list[gcp.projects.Service]:
    services = []

    for service_name in service_names:
        srv = gcp.projects.Service(
            get_resource_name(resource=service_name.split('.')[0], resource_type="service"),
            project=provider.project,
            service=service_name,
            # Do not disable the service when the resource is destroyed
            # as it requires to disable the dependant services to successfully disable the service.
            # However, disabling the dependant services may render the project unusable.
            # For this reason, it is better to keep the service when the resource is destroyed.
            disable_dependent_services=False,
            disable_on_destroy=False,
            opts=pulumi.ResourceOptions(provider=provider, depends_on=dependencies)
        )
        services.append(srv)

    # sort the service names
    # so that the hashing won't be affected by the order of the service names.
    service_names.sort()
    triggers_map = {"services": hashlib.md5("".join(service_names).encode('utf-8')).hexdigest()}
    sleep_for_a_while = time.Sleep(
        get_resource_name(resource="sleep-for-2-min-services"),
        triggers=triggers_map,
        create_duration="120s", opts=pulumi.ResourceOptions(depends_on=services)
    )

    return services + [sleep_for_a_while]


def get_stack_name_from(real_name: str, environment_name: str) -> str:
    """
    Get the stack name from the realm name and environment name
    :param real_name: the realm name
    :param environment_name: the environment name
    :return: the stack name
    """
    return f"{real_name}.{environment_name}"


def get_realm_and_env_name_from_stack(stack_name: str) -> tuple[str, str]:
    """
    Get the realm and environment names from the fully qualified environment name
    :param stack_name:
    :return: the realm name, environment name
    """
    parts = stack_name.split(".")
    if len(parts) != 2:
        raise ValueError(f"Invalid stack name {stack_name}. It must be in the format realm_name.environment_name")

    # Validate the realm name. This constrain is needed
    # as the environment project name will be based on the realm name and environment name.

    reg_ex = r"^[a-zA-Z0-9-'\" !]{3,29}$"
    if not re.match(reg_ex, f"{parts[0]}{parts[1]}"):
        raise ValueError(
            f"Invalid stack name {stack_name} parts. Both parts together, excluding the dot (.), "
            f"must be 3 to 29 characters with lowercase and uppercase "
            f"letters, numbers, hyphen, single-quote, double-quote, space, and exclamation point")

    return parts[0], parts[1]


def parse_realm_env_name_from_stack() -> tuple[str, str, str]:
    """
    Parse the stack name to get the realm and environment names.
    The stack name is in the format realm_name.environment_name
    The fully qualified environment name is realm_name.environment_name
    :return: the realm name, environment name, and the fully qualified environment name (realm_name.environment_name)
    """
    stack_name = pulumi.get_stack()
    realm_name, environment_name = get_realm_and_env_name_from_stack(stack_name)
    pulumi.log.info(f"Using Realm: {realm_name}")
    pulumi.log.info(f"Using Environment: {environment_name}")
    pulumi.log.info(f"Using Stack Name: {stack_name}")

    return realm_name, environment_name, stack_name


def save_content_in_file(file_path: str, content: str):
    """
    Save the content in the file
    """
    with open(file_path, "w", encoding="utf-8") as file:
        file.write(content)


def base64_encode(_string: Optional[str]) -> str:
    """
    Base64 encode the string

    :return:
    """

    if not _string:
        print("warning: provided string is empty")
        return ""

    encoded_bytes = base64.b64encode(_string.encode("utf-8"))
    encoded_string = encoded_bytes.decode("utf-8")

    return encoded_string


BASE36_ALPHABET = string.digits + string.ascii_lowercase  # "0123456789abcdefghijklmnopqrstuvwxyz"


def hash_string(_string: str, allowed_chars: str = BASE36_ALPHABET) -> str:
    """
    Hash the string using MD5 and convert it to a custom base string using the allowed characters
    MD5 is 128 bits long, depending on the allowed characters, the hash can be shortened to a custom base string.
    To calculate the number of digits of the resulting base string, use the formula:
    digits = math.floor((128 * math.log10(2)) / math.log10(len(allowed_chars))) + 1
    For base36, the number of digits is 25.
    :param _string: The string to hash
    :param allowed_chars: The allowed characters
    :return: The base string
    """
    md5_hash = hashlib.md5(_string.encode()).hexdigest()
    hash_int = int(md5_hash, 16)

    return int_to_base(hash_int, allowed_chars)


def int_to_base(num: int, allowed_chars: str):
    """
    Convert an integer to a custom base string using the allowed characters
    :param num: The integer to convert (must be non-negative).
    :param allowed_chars: A string containing unique characters to represent digits e.g. "0123456789abcdef"
    :return: The converted base string.
    :raises ValueError: If num is negative or allowed_chars is empty.
    """
    if num < 0:
        raise ValueError("num must be a non-negative integer")

    if not allowed_chars:
        raise ValueError("allowed_chars cannot be an empty string")

    if num == 0:
        return allowed_chars[0]

    base_str = []
    base = len(allowed_chars)

    while num > 0:
        num, rem = divmod(num, base)
        base_str.append(allowed_chars[rem])

    return ''.join(reversed(base_str))


def int_to_base36(num: int):
    return int_to_base(num, BASE36_ALPHABET)


# Helper method to enable the remote debugger in IntelliJ
def enable_debugger(port: int):
    """
    Enables the remote debugger in IntelliJ.
    :param port: The port of the remote debugger to attach to.
    :return:
    """
    pulumi.info("Starting the auth pulumi stack")
    import pydevd_pycharm
    pydevd_pycharm.settrace('localhost', port=port, stdoutToServer=True, stderrToServer=True, suspend=False)
    pulumi.info("Remote debugger attached")


def get_pulumi_stack_outputs(stack_name: str, module: str) -> Mapping[str, Any]:
    """
    Get the stack outputs for the given stack and workspace(module).

    :param stack_name: (str) The name of the stack
    :param module: (str): The module name.

    :returns dict: The outputs of the stack.
    """
    stack_path = os.path.join(iac_folder, module)
    stack = auto.select_stack(
        work_dir=stack_path,
        stack_name=stack_name
    )

    return stack.outputs()


def construct_artifacts_dir(*,
                            deployment_number: str,
                            fully_qualified_version: Optional[str] = None,
                            stack_name: Optional[str] = None):
    """
    Construct the artifacts directory based on the deployment number, artifacts version, and stack name.
    """

    artifacts_dir = deployment_number

    if fully_qualified_version is not None:
        artifacts_dir = f"{fully_qualified_version}-{artifacts_dir}"

    if stack_name is not None:
        artifacts_dir = f"{stack_name}-{artifacts_dir}"

    print("info: using artifacts directory: ", artifacts_dir)
    return artifacts_dir


def _is_gcloud_authenticated():
    """
    Checks if gcloud has an active authenticated account.
    Returns the active account email if authentication exists, otherwise returns None.
    """
    try:
        result = subprocess.run(
            ["gcloud", "auth", "list", "--filter=status:ACTIVE", "--format=value(account)"],
            capture_output=True,
            text=True,
            check=True
        )
        account = result.stdout.strip()
        return account if account else None  # Return account email or None if not authenticated
    except subprocess.CalledProcessError:
        return None  # If the command fails, assume not authenticated


def _authenticate_gcloud():
    """
    Authenticates gcloud **only if necessary**.
    - If already authenticated, do nothing.
    - If GOOGLE_APPLICATION_CREDENTIALS is set, use it to authenticate.
    - Otherwise, assume the CI/CD environment (GitHub/GitLab) has already authenticated externally.
    """
    auth_email = _is_gcloud_authenticated()
    if auth_email is not None:
        print(f"info: gcloud is already authenticated with {auth_email}")
        return  # Skip authentication

    print("info: gcloud is not authenticated. Authenticating...")

    key_file = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    if key_file:
        print(f"info: Using GOOGLE_APPLICATION_CREDENTIALS: {key_file}")
        try:
            subprocess.run(
                ["gcloud", "auth", "activate-service-account", "--key-file", key_file],
                check=True,
                text=True
            )
            print("info: gcloud authentication successful.")
        except subprocess.CalledProcessError as e:
            print(f"error: Failed to authenticate gcloud: {e}")
            raise
    else:
        print("warning: No GOOGLE_APPLICATION_CREDENTIALS found. Assuming external authentication is already configured.")


def download_generic_artifacts_file(
        *,
        repository: dict,
        file_name: str,
        version: str,
        output_dir: str):
    """
    Download the generic artifacts file from the repository.
    """

    # Authenticate only if necessary
    _authenticate_gcloud()

    subprocess.run(
        [
            "gcloud",
            "artifacts",
            "files",
            "download",
            "--destination=./",
            f'--repository={repository["name"]}',
            f'--location={repository["location"]}',
            f'--project={repository["project"]}',
            f"--local-filename={file_name}",
            f'artifacts:{version}:{file_name}'
        ],
        cwd=output_dir,
        check=True,
        text=True
    )
