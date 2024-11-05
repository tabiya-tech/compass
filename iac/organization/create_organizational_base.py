import pulumi
import pulumi_gcp as gcp

from lib.std_pulumi import enable_services, get_resource_name


def _create_repository(*,
                       root_project_id: str,
                       region: str
                       ) -> gcp.artifactregistry.Repository:
    required_services = [
        # artifact registry (used as a docker repository) requires the artifactregistry API
        "artifactregistry.googleapis.com",
    ]

    """
    create an artifact registry (docker-repository) in the root project

    :param root_project_id: the id of the root project
    :param region: the region where the repository will be created
    :return: the created repository
    """

    # get already created project to use as the root project
    # because this is to be created manually
    # later on, it can be added to the compass folder
    root_project = gcp.organizations.get_project(project_id=root_project_id)

    # By default, resources use package-wide configuration
    # this provider is used to tell pulumi where to create the resources
    # in this case, the resources are created in the root project
    provider = gcp.Provider(
        "gcp_provider",
        project=root_project.id,
        user_project_override=True
    )

    # Enable the required services
    services = enable_services(provider, service_names=required_services, dependencies=[provider])

    # enable current user (ci/cd or pulumi service account): to be able to create the repository
    # Note: this can be done manually in the console
    current_user = gcp.organizations.get_client_open_id_user_info_output()
    artifact_registry_admin_membership = gcp.projects.IAMMember(
        get_resource_name(resource="artifact-registry-admin", resource_type="iam-member"),
        project=root_project_id,
        role="roles/artifactregistry.admin",
        member=current_user.apply(lambda user: f"serviceAccount:{user.email}"),
    )

    # Create a repository - a docker repository
    repository = gcp.artifactregistry.Repository(
        get_resource_name(resource="docker", resource_type="repository"),
        project=root_project_id,
        location=region,
        format="DOCKER",
        repository_id="docker-repository",
        opts=pulumi.ResourceOptions(depends_on=services + [artifact_registry_admin_membership], provider=provider),
    )

    return repository


def _create_folders(organization_id: str, customer_id: str) -> tuple[gcp.organizations.Folder, gcp.organizations.Folder, gcp.organizations.Folder]:
    """
    Create the folders for the organization and assign the necessary permissions to the groups (created by this function)

    - create folders
    - create groups
    - create custom roles
    - add necessary permissions to the groups for the folders

    :param organization_id: the id of the organization
    :param customer_id: the id of the customer
    :return: Folders created
    """

    # Create folders with the following structure:
    # compass
    #   - Compass Lower Environments
    #   - Compass Prod Environments
    # These folders should be protected from deletion as they are common to all environments

    compass_folder = gcp.organizations.Folder(
        get_resource_name(resource="compass", resource_type="folder"),
        display_name="compass",
        parent=f"organizations/{organization_id}",
        opts=pulumi.ResourceOptions(protect=True)
    )


    lower_envs_folder = gcp.organizations.Folder(
        get_resource_name(resource="lower_environments", resource_type="folder"),
        display_name="Compass Lower Environments",
        parent=compass_folder.name,
        opts=pulumi.ResourceOptions(protect=True)
    )

    prod_envs_folder = gcp.organizations.Folder(
        get_resource_name(resource="prod_environments", resource_type="folder"),
        display_name="Compass Prod Environments",
        parent=compass_folder.name,
        opts=pulumi.ResourceOptions(protect=True)
    )

    # Create a custom role for the developers and admins
    compass_developers_extra_role = gcp.organizations.IAMCustomRole(
        get_resource_name(resource="compass-developers-extra-permissions", resource_type="custom-role"),
        role_id="compass_developers_extra_permissions",
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
    #  - admins
    #  - developers

    compass_developers = gcp.cloudidentity.Group(
        get_resource_name(resource="developers", resource_type="group"),
        description="developers have read-write access to dev/test envs and read-only access to production environments",
        display_name="compass-developers",
        group_key=gcp.cloudidentity.GroupGroupKeyArgs(
            id="compass.developers@tabiya.org",
        ),
        labels={
            "cloudidentity.googleapis.com/groups.discussion_forum": "",
        },
        parent=customer_id,
        opts=pulumi.ResourceOptions(protect=True)
    )

    compass_admins = gcp.cloudidentity.Group(
        get_resource_name(resource="admins", resource_type="group"),
        description="admin have write access to both dev/test and production environments",
        display_name="compass-admins",
        group_key=gcp.cloudidentity.GroupGroupKeyArgs(
            id="compass.admins@tabiya.org",
        ),
        labels={
            "cloudidentity.googleapis.com/groups.discussion_forum": "",
        },
        parent=customer_id,
        opts=pulumi.ResourceOptions(protect=True)
    )

    # Assign roles to the groups
    # Developers can view anything bellow the compass folder
    gcp.folder.IAMBinding(
        get_resource_name(resource="dev-group-compass-folder", resource_type="viewer-iam-binding"),
        folder=compass_folder.folder_id,
        role="roles/viewer",
        members=[compass_developers.group_key.apply(lambda group: f"group:{group.id}")],
        opts=pulumi.ResourceOptions(depends_on=[compass_developers])
    )

    # Developers can only edit the lower environments
    gcp.folder.IAMBinding(
        get_resource_name(resource="dev-group-folder-lower-environments", resource_type="iam-binding"),
        folder=lower_envs_folder.folder_id,
        role="roles/editor",
        members=[compass_developers.group_key.apply(lambda group: f"group:{group.id}")],
        opts=pulumi.ResourceOptions(depends_on=[compass_developers])
    )

    # Admins own everything bellow the compass folder
    gcp.folder.IAMBinding(
        get_resource_name(resource="admin-group-compass-folder", resource_type="iam-binding"),
        folder=compass_folder.folder_id,
        role="roles/owner",
        members=[compass_admins.group_key.apply(lambda group: f"group:{group.id}")],
        opts=pulumi.ResourceOptions(depends_on=[compass_admins])
    )

    # ############################################
    # TODO: remove this block.
    # for testing purposes. This will be removed before merging.

    gcp.cloudidentity.GroupMembership(
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
    gcp.cloudidentity.GroupMembership(
        resource_name="assign_me_to_compass_developers_admins",
        group=compass_developers.id,
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


    # allow developers and admins to view compass folder structure.
    gcp.folder.IAMBinding(
        get_resource_name(resource="members-folder-viewer", resource_type="iam-binding"),
        folder=compass_folder.folder_id,
        role="roles/resourcemanager.folderViewer",
        members=[
            compass_developers.group_key.apply(lambda group: f"group:{group.id}"),
            compass_admins.group_key.apply(lambda group: f"group:{group.id}")
        ],
        opts=pulumi.ResourceOptions(depends_on=[compass_developers, compass_admins])
    )

    # Add the extra permissions to the developers and admins groups for the compass folder
    gcp.folder.IAMBinding(
        get_resource_name(resource="members-dev-extra-role", resource_type="iam-binding"),
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
