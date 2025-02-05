from enum import Enum
from typing import Mapping, Any
from dataclasses import dataclass

from lib import get_realm_and_env_name_from_stack


class IaCModules(Enum):
    """
    Our iac subprojects.
    """

    REALM = "realm"
    ENVIRONMENT = "environment"

    AUTH = "auth"
    BACKEND = "backend"
    FRONTEND = "frontend"
    COMMON = "common"
    AWS_NS = "aws-ns"


@dataclass
class StackConfigs:
    """
    Environment Stack Configurations
    expected map type:
     - stack_name: str
       environment: dict: environment configurations
       auth: dict: auth configurations
       backend: dict: backend configurations
       frontend: dict: frontend configurations
       common: dict: common configurations
       aws_ns: dict: aws namespace configurations.
    """

    realm_name: str

    stack_name: str
    env_name: str
    env_type: str
    deployment_type: str

    environment: Mapping[str, Any]
    auth: Mapping[str, Any]
    backend: Mapping[str, Any]
    frontend: Mapping[str, Any]
    common: Mapping[str, Any]
    aws_ns: Mapping[str, Any]

    @staticmethod
    def from_dict(env_config_dict: dict) -> "StackConfigs":
        """
        Creates an Environment Config object from the yml config.
        If some of the fields in the config dict are not present, it will raise an error.

        :param env_config_dict: The environment configuration dictionary.
        :return:
        """

        # Please use ["key"] instead of .get("key") to avoid None values.
        # So that we ensure keys are available in the config dict, otherwise raise an error.

        _stack_name = env_config_dict["stack_name"]
        realm_name, env_name = get_realm_and_env_name_from_stack(_stack_name)
        environment_config = env_config_dict[IaCModules.ENVIRONMENT.value]["config"]

        return StackConfigs(
            realm_name=realm_name,
            stack_name=_stack_name,
            env_name=env_name,
            env_type=environment_config["environment_type"],
            deployment_type=environment_config["deployment_type"],
            environment=env_config_dict[IaCModules.ENVIRONMENT.value],
            auth=env_config_dict[IaCModules.AUTH.value],
            backend=env_config_dict[IaCModules.BACKEND.value],
            frontend=env_config_dict[IaCModules.FRONTEND.value],
            common=env_config_dict[IaCModules.COMMON.value],
            aws_ns=env_config_dict[IaCModules.AWS_NS.value]
        )
