import pulumi
import pulumi_gcp as gcp
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ProjectBaseConfig:
    project: str
    location: str
    environment: str
    provider: pulumi.ProviderResource


def get_file_as_string(file: str):
    return Path(file).read_text()


def get_project_base_config(project: str, location: str, environment: str):
    gcp_provider = gcp.Provider(
        "gcp_provider",
        project=project,
        user_project_override=True)
    return ProjectBaseConfig(project=project, location=location, environment=environment, provider=gcp_provider)


def get_resource_name(environment: str, resource: str, resource_type: str = None):
    """
    Get the resource name
    :param environment:
    :param resource:
    :param resource_type:
    :return:
    """
    if not resource_type:
        return f"compass-{environment}-{resource}"

    return f"compass-{environment}-{resource_type}-{resource}"


def enable_services(basic_config: ProjectBaseConfig, service_names: list[str]) -> list[gcp.projects.Service]:
    services = []

    for service_name in service_names:
        srv = gcp.projects.Service(
            get_resource_name(environment=basic_config.environment, resource_type="service",
                              resource=service_name.split(".")[0]),
            project=basic_config.project,
            service=service_name,
            # Do not disable the service when the resource is destroyed
            # as it requires to disable the dependant services to successfully disable the service.
            # However, disabling the dependant services may render the project unusable.
            # For this reason, it is better to keep the service when the resource is destroyed.
            disable_dependent_services=False,
            disable_on_destroy=False,
            opts=pulumi.ResourceOptions(provider=basic_config.provider)
        )
        services.append(srv)

    return services
