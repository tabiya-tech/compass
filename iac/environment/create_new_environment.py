import hashlib
from typing import Mapping

from pulumi_random import RandomInteger
import pulumi
import pulumi_gcp as gcp
import pulumiverse_time as time

from lib.std_pulumi import enable_services, get_resource_name, int_to_base36, get_pulumi_stack_outputs

from dns import REQUIRED_SERVICES as DNS_SERVICES
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
    # GCP Secret Manager - Required for storing environment variables
    "secretmanager.googleapis.com"
]

# merge the required services of all the modules with the base services by retaining only the unique services
SERVICES_TO_ENABLE = list(set(BASE_SERVICES + DNS_SERVICES + AUTH_SERVICES + BACKEND_SERVICES + COMMON_SERVICES + FRONTEND_SERVICES))

# The initial APIs that must be enabled first in order to enable other GCP APIs
_INITIAL_APIS = ["serviceusage.googleapis.com",
                 "cloudresourcemanager.googleapis.com",
                 "compute.googleapis.com"]

# ensure that the initial APIs are not listed in the services to enable, throw an error if they are
if any(api in SERVICES_TO_ENABLE for api in _INITIAL_APIS):
    raise ValueError("The initial APIs must not be included in the services to enable")


def _ensure_immutable_config(*, key: str, value: pulumi.Output[str]):
    past_outputs = get_pulumi_stack_outputs(stack_name=pulumi.get_stack(), module="environment")
    locked_key = f"{key}_locked_at"
    previous_value = past_outputs.get(locked_key)

    def _validate_locked_value(_value: str):
        if previous_value is not None and previous_value.value != _value:
            raise ValueError(f"Cannot change the value of {key} from {previous_value} to {_value}")

    value.apply(_validate_locked_value)

    pulumi.export(locked_key, value)


def create_new_environment(*,
                           region: str,
                           realm_name: str,
                           folder_id: pulumi.Output[str],
                           billing_account: pulumi.Output[str],
                           environment_name: str,
                           protected_from_deletion: bool,
                           protected_from_deletion_tag: pulumi.Output[str]):

    # This is the project for the environment.
    # all the required services are enabled on this micro-task project.
    # The project should be created in either the Lower Environments folder or the Prod Folder

    project_name = f"{realm_name}-{environment_name}"
    # Add the project's name to the project id so that we can recognize the project's service accounts of that project easily
    # Truncate to 30 characters to avoid the 30 characters limit of the project's id
    random_id = RandomInteger("random",
                              min=2 ** 32 - 1,  # 32bit integer
                              max=2 ** 62,  # Slightly below the 64-bit maximum as a valid integer
                              keepers={
                                  "version": "1"  # Changing this will regenerate the random integer
                              })
    # convert the random integer to base36 approx 12 characters
    project_id = random_id.result.apply(lambda _id: f"{project_name}-{int_to_base36(_id)}"[:30])

    # Ensure that the environment name is immutable. This is to prevent, re-creating of the project.
    _ensure_immutable_config(key="project_id", value=project_id)

    project = gcp.organizations.Project(
        # we are using the get_resource_name function to generate a unique name for the project.
        resource_name=get_resource_name(resource="project"),
        name=project_name,
        project_id=project_id,
        folder_id=folder_id,
        billing_account=billing_account,
        opts=pulumi.ResourceOptions(
            # Protect the project if it is configured to be protected from deletion.
            protect=protected_from_deletion,
            # If someone manually un-protects the upper project, the GCP `Delete Project` command method will not
            # be called  for this resource. We don't want to delete this project in GCP no matter what.
            retain_on_delete=protected_from_deletion
        )
    )

    # By default, resources use package-wide configuration
    # settings, however an explicit `Provider` instance may be created and passed during resource

    # The configuration includes a provider that can be used to create resources in the project, independently of the
    # project the serviceAccount that pulumi will run was created in.
    # This is especially important when creating resources in a project that is not the root project (the service account
    # is created in the root project).

    environment_gcp_provider = gcp.Provider(
        "gcp_provider",
        region=region,
        project=project.id,
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
        project=environment_gcp_provider.project,
        service="serviceusage.googleapis.com",
        # Do not disable the service when the resource is destroyed
        # as it requires to disable the dependant services to successfully disable the service.
        # However, disabling the dependant services may render the project unusable.
        # For this reason, it is better to keep the service when the resource is destroyed.
        disable_dependent_services=False,
        disable_on_destroy=False,
        opts=pulumi.ResourceOptions(provider=environment_gcp_provider)
    )

    initial_apis.append(service_usage)

    # Cloud Resource Manager must be enabled as second API
    # used to manage resources in a project eg: permissions.
    # https://cloud.google.com/resource-manager/docs
    cloud_resource_manager = gcp.projects.Service(
        get_resource_name(resource="cloudresourcemanager", resource_type="service"),
        project=environment_gcp_provider.project,
        service="cloudresourcemanager.googleapis.com",
        # Do not disable the service when the resource is destroyed
        # as it requires to disable the dependant services to successfully disable the service.
        # However, disabling the dependant services may render the project unusable.
        # For this reason, it is better to keep the service when the resource is destroyed.
        disable_dependent_services=False,
        disable_on_destroy=False,
        opts=pulumi.ResourceOptions(depends_on=[service_usage], provider=environment_gcp_provider)
    )

    initial_apis.append(cloud_resource_manager)

    # Compute API must be the 3rd API to be enabled
    # It takes a while for the compute engine API to be fully enabled. Without the sleep, enabling the other services
    # fail randomly as the compute engine API seems to be still disabled (although the previous step was successful)
    compute = gcp.projects.Service(
        get_resource_name(resource="compute", resource_type="service"),
        project=environment_gcp_provider.project,
        service="compute.googleapis.com",
        # Do not disable the service when the resource is destroyed
        # as it requires to disable the dependant services to successfully disable the service.
        # However, disabling the dependant services may render the project unusable.
        # For this reason, it is better to keep the service when the resource is destroyed.
        disable_dependent_services=False,
        disable_on_destroy=False,
        opts=pulumi.ResourceOptions(depends_on=[cloud_resource_manager], provider=environment_gcp_provider)
    )

    initial_apis.append(compute)

    # iterate over all initial_apis and concatenate the service urn
    def initial_apis_map(urns: list[str]) -> Mapping[str, str]:
        return {"services": hashlib.md5("".join(urns).encode('utf-8')).hexdigest()}

    triggers_map = pulumi.Output.all(*[api.urn for api in initial_apis]).apply(initial_apis_map)
    triggers_map.apply(lambda x: pulumi.log.info(f"Triggers Map: {x}"))
    sleep_for_a_while = time.Sleep(
        get_resource_name(resource="sleep-for-2-min"),
        triggers=triggers_map,
        create_duration="120s", opts=pulumi.ResourceOptions(depends_on=initial_apis)
    )

    # enable all the required services for the environment
    enable_services(
        provider=environment_gcp_provider,
        service_names=SERVICES_TO_ENABLE,
        dependencies=initial_apis + [sleep_for_a_while]
    )

    # add the project tag as a separate resource, because changing tags list in project triggers a recreation
    # of the new project, which we don't want for now because of legacy created projects.
    if protected_from_deletion:
        gcp.tags.TagBinding(
            get_resource_name(resource="project-protected", resource_type="tag-binding"),
            parent=project.number.apply(lambda number: f"//cloudresourcemanager.googleapis.com/projects/{number}"),
            tag_value=protected_from_deletion_tag,
            opts=pulumi.ResourceOptions(
                provider=environment_gcp_provider,
                depends_on=initial_apis,
                # Delete the existing resource before creating new binding
                # to avoid conflicts with the existing bindings on the key.
                delete_before_replace=True))

    pulumi.export("project_id", project.id.apply(lambda _id: _id.replace("projects/", "")))
    pulumi.export("project_number", project.number)
