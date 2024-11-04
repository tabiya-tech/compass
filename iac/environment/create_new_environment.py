import pulumi
import pulumi_gcp as gcp
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


def create_new_environment(*,
                           folder_id: pulumi.Output[str],
                           billing_account: str,
                           root_project: str,
                           environment: str,
                           environment_name: str,
                           environment_type: str
                           ):
    # This is the project for the environment.
    # All resources of the environment are created in this project.
    # The project should be created in either the Lower Environments folder or the Prod Folder

    project = gcp.organizations.Project(
        # we are using the get_resource_name function to generate a unique name for the project
        # eg: compass-dev-project
        resource_name=get_resource_name(environment=environment, resource="project"),
        name=environment_name,
        folder_id=folder_id,
        billing_account=billing_account
    )
    # REVIEW: be specific... explain why we need the provider ( see also std_lib)
    # By default, resources use package-wide configuration
    # settings, however an explicit `Provider` instance may be created and passed during resource
    # construction to achieve fine-grained programmatic control over provider settings. See the
    # [documentation](https://www.pulumi.com/docs/reference/programming-model/#providers) for more information.
    # Our This provider is project specific, it is used to create resources in the project.

    # This project is going to be used in std_pulumi.py to create re-use the provider
    # for other resources that are going to be created in the project.
    # So important information is added here, and we won't have to be repeating it in other places.
    # eg: billing id
    # that is why the resource_name is a constant for the stack.
    gcp_provider = gcp.Provider(
        "gcp_provider",
        project=project.id,
        billing_project=root_project,  # REVIEW why do it need the billing project and why do we use the root_project and not the newly created project
        user_project_override=True,
        opts=pulumi.ResourceOptions(depends_on=[project])
    )

    # The next step is to enable the required GCP APIs for the environment.
    # Otherwise, the environment will not be able to use the GCP services that require these APIs.
    # The following APIs are required by the GCP services that Compass uses.
    # The APIs are enabled in a specific order to avoid any issues.

    # GCP APIs that must be enabled first in order to enable other GCP APIs
    initial_apis = []

    # GCP APIs that are required by the GCP services that Compass uses
    base_services = []

    # service usage API is required because we need this API enabled so that we can be able to enable other apis.
    # https://cloud.google.com/service-usage/docs/reference/rest
    service_usage = gcp.projects.Service(
        get_resource_name(environment=environment, resource_type="service", resource="serviceusage"),
        project=project.id,
        service="serviceusage.googleapis.com",
        # Do not disable the service when the resource is destroyed
        # as it requires to disable the dependant services to successfully disable the service.
        # However, disabling the dependant services may render the project unusable.
        # For this reason, it is better to keep the service when the resource is destroyed.
        disable_dependent_services=False,
        disable_on_destroy=False,
        opts=pulumi.ResourceOptions(provider=gcp_provider)  # Use the gcp_provider to create the resource in the project
    )

    initial_apis.append(service_usage)

    # Cloud Resource Manager must be enabled as second API
    # used to manage resources in a project eg: permissions.
    # https://cloud.google.com/resource-manager/docs
    cloud_resource_manager = gcp.projects.Service(
        get_resource_name(environment=environment, resource_type="service", resource="cloudresourcemanager"),
        project=project.id,
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
        project=project.id,
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
            project=project.id,
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

    pulumi.export("project_id", project.id.apply(lambda _id: _id.replace("projects/", "")))
    pulumi.export("project_number", project.number)
    pulumi.export("environment_type", environment_type)
