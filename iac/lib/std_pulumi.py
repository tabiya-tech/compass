import os

import pulumi
import pulumi_gcp as gcp
from dataclasses import dataclass
from pathlib import Path

from typing import Optional


@dataclass
class ProjectBaseConfig:
    project: str
    location: str
    environment: Optional[str]
    provider: gcp.Provider


def getconfig(name: str, config: Optional[str] = None) -> str:
    """
    Get the configuration value from the pulumi configuration
    :param name: the configuration name
    :param config: the pulumi configuration
    :return: the configuration value
    :raises ValueError: if the configuration value is not set
    """

    value = pulumi.Config(config).require(name)
    if not value:
        raise ValueError(f"configuration value {name} is not set")
    return value


def getenv(name: str) -> str:
    """
    Get the environment variable
    :param name: the environment variable name
    :return: the environment variable value
    :raises ValueError: if the environment variable is not set
    """
    value = os.getenv(name)
    if not value:
        raise ValueError(f"environment variable {name} is not set")
    return value


def get_file_as_string(file: str):
    return Path(file).read_text()


def get_project_base_config(project: str | pulumi.Output[str], location: str, environment: Optional[str] = None):
    """
    Get the project base configuration
    The configuration includes a provider that can be used to create resources in the project, independently of the
    project the serviceAccount that pulumi will run was created in.
    This is especially important when creating resources in a project that is not the root project (the service account
    is created in the root project).

    :param project: The project id to create the resources in
    :param location: The location of the project
    :param environment: The environment the project is in
    :return: The project base configuration
    """
    gcp_provider = gcp.Provider(
        "gcp_provider",
        project=project,
        user_project_override=True)
    return ProjectBaseConfig(project=project, location=location, environment=environment, provider=gcp_provider)


def get_resource_name(resource: str, *, environment: str = None, resource_type: str = None):
    """
    Get the resource name
    :param environment:
    :param resource:
    :param resource_type:
    :return:
    """
    name = resource
    if resource_type:
        name = f"{name}-{resource_type}"

    if environment:
        name = f"{name}-{environment}"

    return name


def enable_services(provider: gcp.Provider, service_names: list[str], dependencies: list) -> list[gcp.projects.Service]:
    services = []

    for service_name in service_names:
        srv = gcp.projects.Service(
            get_resource_name(service_name.split('.')[0], resource_type="service"),
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

    return services
