import pulumi
import pulumi_gcp as gcp
import pulumiverse_time as time
from lib.std_pulumi import get_resource_name, enable_services

from auth import REQUIRED_SERVICES as AUTH_SERVICES
from backend import REQUIRED_SERVICES as BACKEND_SERVICES
from common import REQUIRED_SERVICES as COMMON_SERVICES
from frontend import REQUIRED_SERVICES as FRONTEND_SERVICES

# The services that are required for the environment
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

# merge the required services of all the modules with the base services by retaining only the unique services
SERVICES_TO_ENABLE = list(set(BASE_SERVICES + AUTH_SERVICES + BACKEND_SERVICES + COMMON_SERVICES + FRONTEND_SERVICES))

# The initial APIs that must be enabled first in order to enable other GCP APIs
_INITIAL_APIS = ["serviceusage.googleapis.com",
                 "cloudresourcemanager.googleapis.com",
                 "compute.googleapis.com"]

# ensure that the initial APIs are not listed in the services to enable, throw an error if they are
if any(api in SERVICES_TO_ENABLE for api in _INITIAL_APIS):
    raise ValueError("The initial APIs must not be included in the services to enable")


def create_new_environment(*,
                           folder_id: pulumi.Output[str],
                           billing_account: str,
                           environment_name: str,
                           root_project_id: str,
                           environment_type: str
                           ):
    # This is the project for the environment.
    # all the required services are enabled on this micro-task project.
    # The project should be created in either the Lower Environments folder or the Prod Folder

    project = gcp.organizations.Project(
        # we are using the get_resource_name function to generate a unique name for the project
        resource_name=get_resource_name(resource="project"),
        name=environment_name,
        folder_id=folder_id,
        billing_account=billing_account
    )

    # By default, resources use package-wide configuration
    # settings, however an explicit `Provider` instance may be created and passed during resource

    # The configuration includes a provider that can be used to create resources in the project, independently of the
    # project the serviceAccount that pulumi will run was created in.
    # This is especially important when creating resources in a project that is not the root project (the service account
    # is created in the root project).

    gcp_provider = gcp.Provider(
        "gcp_provider",
        project=project.id,
        user_project_override=True,
        # The billing project is the root project id
        # it is required because initially service usage API needs to be enabled manually.
        # service usage API is required so that we can enable the required services for the environment.
        # usage API needs to be enabled manually in the root project
        # so that the service account created on the root project will allow us to enable the required services.
        # if it is not added, or we use the newly created project id, the service usage API will not be enabled.
        billing_project=root_project_id,
        opts=pulumi.ResourceOptions(depends_on=[project])
    )

    # The next step is to enable the required GCP APIs for the environment.
    # Otherwise, the environment will not be able to use the GCP services that require these APIs.
    # The following APIs are required by the GCP services that Compass uses.
    # The APIs are enabled in a specific order to avoid any issues.

    # GCP APIs that must be enabled first in order to enable other GCP APIs
    initial_apis = []

    # service usage API is required because we need this API enabled so that we can be able to enable other apis.
    # https://cloud.google.com/service-usage/docs/reference/rest
    service_usage = gcp.projects.Service(
        get_resource_name(resource="serviceusage", resource_type="service"),
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
        get_resource_name(resource="cloudresourcemanager", resource_type="service"),
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
        get_resource_name(resource="compute", resource_type="service"),
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
        get_resource_name(resource="sleep-for-2-min"),
        create_duration="120s", opts=pulumi.ResourceOptions(depends_on=initial_apis)
    )

    # enable all the required services for the environment
    enable_services(
        provider=gcp_provider,
        service_names=SERVICES_TO_ENABLE,
        dependencies=initial_apis + [sleep_for_a_while]
    )

    pulumi.export("project_id", project.id.apply(lambda _id: _id.replace("projects/", "")))
    pulumi.export("project_number", project.number)
    pulumi.export("environment_type", environment_type)
