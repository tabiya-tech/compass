import pulumi
import pulumi_gcp as gcp
import pulumi_mongodbatlas as mongodbatlas
import pulumiverse_time as time
from lib.std_pulumi import get_resource_name

BASE_SERVICES = [
    # GCP Cloud APIs
    "cloudapis.googleapis.com",
    # GCP Cloud Billing
    "cloudbilling.googleapis.com",
    # Identity And Access Management - needed for creating Service Accounts
    "iam.googleapis.com",
    # GCP Service Control - Required by API Gateway
    "servicecontrol.googleapis.com",
    "servicemanagement.googleapis.com",
]


# Service Usage API is used for enabling APIs
# Pulumi cannot enable Service Usage API to a project directly as the Service Usage API
# must be enabled to enable the API. This is a known limitation of Terraform/Pulumi.
# The workaround is to have a separate project - here called "root_project" where the 
# Service Usage API is enabled. We will call the root_project's Service Usage API to
# enable the APIs for the new project/environment.
# The root project name must be set as "gcp:project" in the Pulumi.<ENV>.yaml

def create_new_environment(folder_id: pulumi.Output[str],
                           billing_account: str,
                           root_project: str,
                           environment: str,
                           environment_name: str,
                           environment_type: str):
    project = gcp.organizations.Project(resource_name=f'compass-project-{environment}',
                                        project_id=f'compass-project-{environment}',
                                        name=environment_name,
                                        folder_id=folder_id,
                                        billing_account=billing_account)

    gcp_provider = gcp.Provider(
        "gcp_provider",
        project=project,
        billing_project=root_project,
        user_project_override=True,
        opts=pulumi.ResourceOptions(depends_on=[project])
    )

    # GCP APIs that must be enabled first in order to enable other GCP APIs
    initial_apis = []
    # GCP APIs that are required by the GCP services that Compass uses
    base_services = []

    service_usage = gcp.projects.Service(
        get_resource_name(environment=environment, resource_type="service", resource="serviceusage"),
        project=project,
        service="serviceusage.googleapis.com",
        # Do not disable the service when the resource is destroyed
        # as it requires to disable the dependant services to successfully disable the service.
        # However, disabling the dependant services may render the project unusable.
        # For this reason, it is better to keep the service when the resource is destroyed.
        disable_dependent_services=False,
        disable_on_destroy=False,
        opts=pulumi.ResourceOptions(provider=gcp_provider)
    )

    initial_apis.append(service_usage)

    # Cloud Resource Manager must be enabled as second API
    cloud_resource_manager = gcp.projects.Service(
        get_resource_name(environment=environment, resource_type="service", resource="cloudresourcemanager"),
        project=project,
        service="cloudresourcemanager.googleapis.com",
        # Do not disable the service when the resource is destroyed
        # as it requires to disable the dependant services to successfully disable the service.
        # However, disabling the dependant services may render the project unusable.
        # For this reason, it is better to keep the service when the resource is destroyed.
        disable_dependent_services=False,
        disable_on_destroy=False,
        opts=pulumi.ResourceOptions(depends_on=[service_usage], provider=gcp_provider)
    )

    initial_apis.append(cloud_resource_manager)

    # Compute API must be the 3rd API to be enabled
    # It takes a while for the compute engine API to be fully enabled. Without the sleep, enabling the other services
    # fail randomly as the compute engine API seems to be still disabled (although the previous step was successful)
    compute = gcp.projects.Service(
        get_resource_name(environment=environment, resource_type="service", resource="compute"),
        project=project,
        service="compute.googleapis.com",
        # Do not disable the service when the resource is destroyed
        # as it requires to disable the dependant services to successfully disable the service.
        # However, disabling the dependant services may render the project unusable.
        # For this reason, it is better to keep the service when the resource is destroyed.
        disable_dependent_services=False,
        disable_on_destroy=False,
        opts=pulumi.ResourceOptions(depends_on=[cloud_resource_manager], provider=gcp_provider)
    )

    initial_apis.append(compute)

    sleep_for_a_while = time.Sleep(
        "wait120Seconds", create_duration="120s", opts=pulumi.ResourceOptions(depends_on=initial_apis)
    )

    for service in BASE_SERVICES:
        srv = gcp.projects.Service(
            get_resource_name(environment=environment, resource_type="service", resource=service.split(".")[0]),
            project=project,
            service=service,
            # Do not disable the service when the resource is destroyed
            # as it requires to disable the dependant services to successfully disable the service.
            # However, disabling the dependant services may render the project unusable.
            # For this reason, it is better to keep the service when the resource is destroyed.
            disable_dependent_services=False,
            disable_on_destroy=False,
            opts=pulumi.ResourceOptions(depends_on=initial_apis + [sleep_for_a_while], provider=gcp_provider),
        )
        base_services.append(srv)

    '''
    IF WE WANT TO INITIALIZE AN (EMPTY) MONGODB ATLAST CLUSTER
    mongodb_cluster = mongodbatlas.Cluster("test",
                                            project_id=project.project_id,
                                            name=f'compass-{environment}',
                                            cluster_type="REPLICASET",
                                            replication_specs=[mongodbatlas.ClusterReplicationSpecArgs(
                                                num_shards=1,
                                                regions_configs=[mongodbatlas.ClusterReplicationSpecRegionsConfigArgs(
                                                    region_name="CENTRAL_US",
                                                    electable_nodes=3,
                                                    priority=7,
                                                    read_only_nodes=0,
                                                )],
                                            )],
                                            cloud_backup=True,
                                            auto_scaling_disk_gb_enabled=True,
                                            mongo_db_major_version="7.0",
                                            provider_name="GCP",
                                            provider_instance_size_name="M10",
                                            opts=pulumi.ResourceOptions(depends_on=[compute]))
    
    pulumi.export("mongodb_connection_strings", mongodb_cluster.connection_strings)
    '''

    pulumi.export("project_id", project.id.apply(lambda id: id.replace("projects/", "")))
    pulumi.export("project_name", project.name)
    pulumi.export("project_number", project.number)
    pulumi.export("environment_name", environment_name)
    pulumi.export("environment_type", environment_type)
