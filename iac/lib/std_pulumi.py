import pulumi_gcp as gcp
from dataclasses import dataclass


@dataclass
class ProjectBaseConfig:
    project: str
    location: str
    environment: str


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
        )
        services.append(srv)

    return services
