import pulumi
import pulumi_gcp as gcp

from lib.std_pulumi import get_resource_name, get_project_base_config, enable_services

REQUIRED_SERVICES = [
    "artifactregistry.googleapis.com",
]

ROOT_ENVIRONMENT = "root"


def _create_repository(*,
                       root_project_id: str,
                       region: str
                       ) -> gcp.artifactregistry.Repository:
    root_project = gcp.organizations.get_project(project_id=root_project_id)
    basic_config = get_project_base_config(project=root_project.name, location=region, environment=ROOT_ENVIRONMENT)
    services = enable_services(basic_config=basic_config, service_names=REQUIRED_SERVICES)

    # Create a repository
    repository_name = get_resource_name(environment=ROOT_ENVIRONMENT, resource="docker-repository")
    repository = gcp.artifactregistry.Repository(
        get_resource_name(environment=basic_config.environment, resource="docker-repository"),
        project=basic_config.project,
        location=basic_config.location,
        format="DOCKER",
        repository_id=repository_name,
        opts=pulumi.ResourceOptions(depends_on=services, provider=basic_config.provider),
    )
    return repository


def _create_folders(organization_id: str, customer_id: str) -> tuple[gcp.organizations.Folder, gcp.organizations.Folder, gcp.organizations.Folder]:
    # Create folders with the following structure:
    # compass
    #   - Compass Lower Environments
    #   - Compass Prod Environments
    # These folders should be protected from deletion as they are common to all environments
    compass_folder = gcp.organizations.Folder(
        "compass",
        display_name="compass",
        parent=f"organizations/{organization_id}",
        opts=pulumi.ResourceOptions(protect=True)
    )

    lower_envs_folder = gcp.organizations.Folder(
        "tabiya_compass_lower_environments",
        display_name="Compass Lower Environments",
        parent=compass_folder.name,
        opts=pulumi.ResourceOptions(protect=True)
    )

    prod_envs_folder = gcp.organizations.Folder(
        "tabiya_compass_prod_environments",
        display_name="Compass Prod Environments",
        parent=compass_folder.name,
        opts=pulumi.ResourceOptions(protect=True)
    )

    # Create a custom role for the developers and admins
    compass_developers_extra_role = gcp.organizations.IAMCustomRole(
        "compass_developers_extra_role",
        role_id="compass_developers_extra",
        title="Compass Developers Extra Permissions",
        org_id=organization_id,
        description="This role is used to give extra permissions to the developers and admins groups "
                    "that are not part of the default roles",
        permissions=[
            # Developers currently have owner and editor permissions on some of the environments,
            # so we assign them the projects.getIamPolicy to allow them to see the permissions they have on the projects.
            # Note: This is only required for developers not admins.
            "resourcemanager.projects.getIamPolicy",
            "resourcemanager.folders.getIamPolicy",
        ],
        opts=pulumi.ResourceOptions(protect=True)
    )

    # Create groups
    compass_developers = gcp.cloudidentity.Group(
        "compass-developers-2",
        description="developers have read-write access to dev/test envs and read-only access to production environments",
        display_name="compass-developers-2",
        group_key=gcp.cloudidentity.GroupGroupKeyArgs(
            id="compass.developers.2@tabiya.org",
        ),
        labels={
            "cloudidentity.googleapis.com/groups.discussion_forum": "",
        },
        parent=customer_id,
        opts=pulumi.ResourceOptions(protect=True)
    )

    compass_admins = gcp.cloudidentity.Group(
        "compass-admins-2",
        description="admin have write access to both dev/test and production environments",
        display_name="compass-admins-2",
        group_key=gcp.cloudidentity.GroupGroupKeyArgs(
            id="compass.admins.2@tabiya.org",
        ),
        labels={
            "cloudidentity.googleapis.com/groups.discussion_forum": "",
        },
        parent=customer_id,
        opts=pulumi.ResourceOptions(protect=True)
    )

    # Assign roles to the groups
    # Developers can view anything bellow the compass folder
    _dev_compass_wide_folder_viewer_role_binding = gcp.folder.IAMBinding(
        "tabiya_compass_dev_compass_folder_viewer_role_binding",
        folder=compass_folder.folder_id,
        role="roles/viewer",
        members=[compass_developers.group_key.apply(lambda group: f"group:{group.id}")],
        opts=pulumi.ResourceOptions(depends_on=[compass_developers])
    )

    # Developers can only edit the lower environments
    _dev_lower_env_editor_role_binding = gcp.folder.IAMBinding(
        get_resource_name(environment="base", resource="dev-group-folder-lower-environments", resource_type="role-binding"),
        folder=lower_envs_folder.folder_id,
        role="roles/editor",
        members=[compass_developers.group_key.apply(lambda group: f"group:{group.id}")],
        opts=pulumi.ResourceOptions(depends_on=[compass_developers])
    )

    # Admins own everything bellow the compass folder
    _admin_org_wide_role_binding = gcp.folder.IAMBinding(
        "tabiya_compass_admin_compass_owner_role_binding",
        folder=compass_folder.folder_id,
        role="roles/owner",
        members=[compass_admins.group_key.apply(lambda group: f"group:{group.id}")],
        opts=pulumi.ResourceOptions(depends_on=[compass_admins])
    )

    # ############################################
    # TODO: remove this block.
    # for testing purposes. This will be removed before merging.

    _assign_me_to_compass_developers = gcp.cloudidentity.GroupMembership(
        resource_name="assign_me_to_compass_developers",
        group=compass_admins.id,
        member_key={
            "id": "anselme.irumva@tabiya.org"
        },
        roles=[{
            "name": "MEMBER",
        },
            {
                "name": "MANAGER",
            },
        ]
    )
    # ############################################

    # Add the extra permissions to the developers and admins groups for the compass folder
    _groups_folder_binding = gcp.folder.IAMBinding(
        "tabiya_compass_groups_extra_role_binding",
        folder=compass_folder.folder_id,
        role=compass_developers_extra_role.name,
        members=[
            compass_developers.group_key.apply(lambda group: f"group:{group.id}"),
            compass_admins.group_key.apply(lambda group: f"group:{group.id}")
        ],
        opts=pulumi.ResourceOptions(depends_on=[compass_developers, compass_admins])
    )
    return compass_folder, lower_envs_folder, prod_envs_folder


def create_organizational_base(*, organization_id: str, root_project_id: str, region: str, customer_id: str):
    # Create the folders
    _, lower_envs_folder, prod_envs_folder = _create_folders(organization_id=organization_id, customer_id=customer_id)

    # Create the artifact registry repository
    repository = _create_repository(root_project_id=root_project_id, region=region)

    pulumi.export("repository", repository)
    pulumi.export("folder_dev_id", lower_envs_folder.folder_id)
    pulumi.export("folder_prod_id", prod_envs_folder.folder_id)
