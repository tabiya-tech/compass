from enum import Enum
from typing import Mapping, Any, Optional
from dataclasses import dataclass
from functools import cached_property

from environment.env_types import EnvironmentTypes
from lib import get_stack_name_from


class IaCModules(Enum):
    """
    Our iac subprojects.
    """

    REALM = "realm"
    ENVIRONMENT = "environment"

    DNS = "dns"
    AUTH = "auth"
    BACKEND = "backend"
    FRONTEND = "frontend"
    COMMON = "common"


class DeploymentType(Enum):
    """
    Deployment type.
    """

    AUTO = "auto"
    """Deployment happens automatically for some events: eg: push to main, release"""

    MANUAL = "manual"
    """Someone manually has to come and deploy the changes, with a specific version."""


@dataclass
class Environment:
    """
    Environment/Deployment
    """

    realm_name: str
    environment_name: str
    environment_type: EnvironmentTypes
    deployment_type: DeploymentType
    config: Mapping[str, Any]

    @cached_property
    def stack_name(self) -> str:
        """The stack name for the environment"""
        return get_stack_name_from(self.realm_name, self.environment_name)

    @staticmethod
    def from_dict(realm_name: str, _dict: dict) -> "Environment":
        """
        Creates an Environment object from the Dictionary
        """
        environment_config = _dict["config"]

        return Environment(
            realm_name=realm_name,
            environment_name=_dict["environment_name"],
            environment_type=EnvironmentTypes(environment_config["environment_type"]),
            deployment_type=DeploymentType(_dict["deployment_type"]),
            config={'config': environment_config}
        )


@dataclass
class StackConfigs:
    """
    Environment Stack Configurations
    """

    environment: Environment
    dns: Mapping[str, Any]
    auth: Mapping[str, Any]
    backend: Mapping[str, Any]
    frontend: Mapping[str, Any]
    common: Mapping[str, Any]

    raw_config: dict
    """The raw dictionary(JSON/YML) Configurations for the stack config."""

    @staticmethod
    def from_dict(environment: Environment, _dict: dict) -> "StackConfigs":
        """
        Creates an Environment Config object from the yml config.
        If some of the fields in the config dict are not present, it will raise an error.
        """

        # Please use ["key"] instead of .get("key") to avoid None values.
        # So that we ensure keys are available in the config dict, otherwise raise an error.

        return StackConfigs(
            environment=environment,
            dns=_dict[IaCModules.DNS.value],
            auth=_dict[IaCModules.AUTH.value],
            backend=_dict[IaCModules.BACKEND.value],
            frontend=_dict[IaCModules.FRONTEND.value],
            common=_dict[IaCModules.COMMON.value],
            raw_config=_dict
        )


@dataclass(frozen=True)
class Secret:
    """
    Secret Object
    """

    name: str
    """The fully qualified name of the secret, including the version"""

    value: Optional[str]
    """The value of the secret, the payload"""
