import base64
import os

import pulumi
import pulumi_gcp as gcp
import pulumiverse_time as time
import hashlib

from lib import enable_services, get_resource_name

protected_from_deletion = True


def _get_custom_role_valid_name(name: str) -> str:
    # Replace all characters that do not nor match the [a-zA-Z0-9_\\.]{3,64} regex with underscore
    # If the name is less than 3 characters, add two underscores to the end
    if len(name) < 3:
        name = name + "__"
    # if the name is more than 64 characters, truncate it to 64 characters
    if len(name) > 64:
        name = name[:64]
    # replace all invalid characters with underscore
    return "".join([c if c.isalnum() or c in ['_', '.'] else '_' for c in name])


def _grant_folder_roles_to_group(*, folder_id: pulumi.Output[str] | str, folder_name: str, group_name: str, group: gcp.cloudidentity.Group, roles: list[str],
                                 provider: gcp.Provider):
    for role in roles:
        gcp.folder.IAMMember(
            get_resource_name(resource=f"{folder_name}-{group_name}-group-{role}", resource_type="iam-member"),
            folder=folder_id,
            role=role,
            member=group.group_key.apply(lambda g: f"group:{g.id}"),
            opts=pulumi.ResourceOptions(provider=provider, depends_on=[group])
        )


def _grant_roles_to_service_account(*, service_account: pulumi.Output[gcp.organizations.GetClientOpenIdUserInfoResult], roles: list[str],
                                    provider: gcp.Provider) -> time.Sleep:
    memberships = [gcp.projects.IAMMember(
        get_resource_name(resource=role, resource_type="iam-member"),
        project=provider.project,
        role=role,
        member=service_account.apply(lambda sa: f"serviceAccount:{sa.email}"),
        opts=pulumi.ResourceOptions(provider=provider)
    ) for role in roles]

    triggers_map = {"services": hashlib.md5("".join(roles).encode('utf-8')).hexdigest()}

    # wait for the artifact registry admin membership to take effect
    # see https://cloud.google.com/iam/docs/access-change-propagation
    sleep_2_minutes = time.Sleep(get_resource_name(resource="sleep-for-2-min-for-roles-membership"),
                                 create_duration="120s",
                                 triggers=triggers_map,
                                 opts=pulumi.ResourceOptions(depends_on=memberships)
                                 )
    return sleep_2_minutes


def _create_repositories(*,
                         region: str,
                         admins_group: gcp.cloudidentity.Group,
                         developers_group: gcp.cloudidentity.Group,
                         dependencies: list[pulumi.Resource],
                         provider: gcp.Provider
                         ) -> (gcp.artifactregistry.Repository, gcp.artifactregistry.Repository):
    """
    create an artifact registry repositories in the root project.
        - docker repository - for docker images
        - generic repository - for other artifacts eg: frontend build artifacts

    :param region: the region where the repository will be created
    :return: the created repository
    """

    repo_admin_role = "roles/artifactregistry.repoAdmin"

    # Create a repository - a docker repository
    docker_repository = gcp.artifactregistry.Repository(
        get_resource_name(resource="docker", resource_type="repository"),
        project=provider.project,
        location=region,
        format="DOCKER",
        repository_id="docker-repository",
        opts=pulumi.ResourceOptions(protect=protected_from_deletion, depends_on=dependencies, provider=provider),
    )

    # Devs and admins can read and write to the repository
    gcp.artifactregistry.RepositoryIamMember(
        resource_name=get_resource_name(resource="devs-group-docker-repository-admin", resource_type="iam-member"),
        project=provider.project,
        location=region,
        repository=docker_repository.name,
        role=repo_admin_role,
        member=developers_group.group_key.apply(lambda group: f"group:{group.id}"),
        opts=pulumi.ResourceOptions(provider=provider, depends_on=[docker_repository, developers_group]),
    )

    gcp.artifactregistry.RepositoryIamMember(
        resource_name=get_resource_name(resource="admins-group-docker-repository-admin", resource_type="iam-member"),
        project=provider.project,
        location=region,
        repository=docker_repository.name,
        role=repo_admin_role,
        member=admins_group.group_key.apply(lambda group: f"group:{group.id}"),
        opts=pulumi.ResourceOptions(provider=provider, depends_on=[docker_repository, admins_group]),
    )

    # Create a repository - a generic artifact repository
    generic_repository = gcp.artifactregistry.Repository(
        get_resource_name(resource="generic", resource_type="repository"),
        project=provider.project,
        location=region,
        format="GENERIC",
        repository_id="generic-repository",
        opts=pulumi.ResourceOptions(protect=protected_from_deletion, depends_on=dependencies, provider=provider),
    )

    gcp.artifactregistry.RepositoryIamMember(
        resource_name=get_resource_name(resource="devs-group-generic-repository-admin", resource_type="iam-member"),
        project=provider.project,
        location=region,
        repository=generic_repository.name,
        role=repo_admin_role,
        member=developers_group.group_key.apply(lambda group: f"group:{group.id}"),
        opts=pulumi.ResourceOptions(provider=provider, depends_on=[generic_repository, developers_group]),
    )

    gcp.artifactregistry.RepositoryIamMember(
        resource_name=get_resource_name(resource="admins-group-generic-repository-admin", resource_type="iam-member"),
        project=provider.project,
        location=region,
        repository=generic_repository.name,
        role=repo_admin_role,
        member=admins_group.group_key.apply(lambda group: f"group:{group.id}"),
        opts=pulumi.ResourceOptions(provider=provider, depends_on=[generic_repository, admins_group]),
    )

    return docker_repository, generic_repository


def _create_secrets(
        *,
        root_project_id: str,
        developers_group: gcp.cloudidentity.Group,
        admins_group: gcp.cloudidentity.Group,
        provider: gcp.Provider,
        dependencies: list[pulumi.Resource],
) -> gcp.secretmanager.Secret:
    """
    Create secrets required by the realm.
         a) environments config.

    And grant the necessary permissions to the developers and admins groups.
    """

    environments_config_secret = gcp.secretmanager.Secret(
        get_resource_name(resource="environments-config", resource_type="secret"),
        secret_id="environments-config",
        project=root_project_id,
        # automatic replication.
        replication={
            "auto": {},
        },
        opts=pulumi.ResourceOptions(provider=provider, depends_on=dependencies))

    # allow the developers to only view the secret
    gcp.secretmanager.SecretIamMember(
        get_resource_name(resource="devs-group-environments-config-secret-accessor", resource_type="iam-member"),
        secret_id=environments_config_secret.id,
        role="roles/secretmanager.secretAccessor",
        member=developers_group.group_key.apply(lambda group: f"group:{group.id}"),
        opts=pulumi.ResourceOptions(provider=provider, depends_on=[environments_config_secret, developers_group]))

    # allow the admins to admin the secret
    gcp.secretmanager.SecretIamMember(
        get_resource_name(resource="admins-group-environments-config-secret-admin", resource_type="iam-member"),
        secret_id=environments_config_secret.id,
        role="roles/secretmanager.admin",
        member=admins_group.group_key.apply(lambda group: f"group:{group.id}"),
        opts=pulumi.ResourceOptions(provider=provider, depends_on=[environments_config_secret, admins_group]))

    return environments_config_secret


def _create_organizational_base(*,
                                provider: gcp.Provider,
                                organization_id: str,
                                customer_id: str,
                                billing_account_id: str,
                                realm_name: str,
                                root_folder_id: str,
                                upper_env_google_oauth_projects_folder_id: str,
                                lower_env_google_oauth_projects_folder_id: str,
                                dependencies: list[pulumi.Resource]
                                ) -> tuple[gcp.organizations.Folder, gcp.organizations.Folder, gcp.cloudidentity.Group, gcp.cloudidentity.Group]:
    """
    Create the realm's organizational base:
        - create folders
        - create groups
        - create custom roles
        - add necessary permissions to the groups for the folders
        - create service accounts for ci/cd
    :param provider: the provider to use
    :param organization_id: the id of the organization
    :param customer_id: the id of the customer
    :param realm_name: the name of the realm
    :param root_folder_id: the id of the realm's root folder
    :return: Folders created
    """

    # Create folders with the following structure:
    # realm root folder
    #   - Lower Environments
    #   - Prod Environments
    # These folders should be protected from accidental deletion as they are common to all environments
    lower_envs_folder = gcp.organizations.Folder(
        get_resource_name(resource="lower_environments", resource_type="folder"),
        display_name="Lower Environments",
        parent=f"folders/{root_folder_id}",
        opts=pulumi.ResourceOptions(protect=protected_from_deletion, depends_on=dependencies, provider=provider)
    )

    prod_envs_folder = gcp.organizations.Folder(
        get_resource_name(resource="prod_environments", resource_type="folder"),
        display_name="Prod Environments",
        parent=f"folders/{root_folder_id}",
        opts=pulumi.ResourceOptions(protect=protected_from_deletion, depends_on=dependencies, provider=provider)
    )

    # Create a custom role for the developers and admins
    realm_developers_admin_extra_role = gcp.organizations.IAMCustomRole(
        get_resource_name(resource="developers-admins-extra-permissions", resource_type="custom-role"),
        role_id=f"{_get_custom_role_valid_name(realm_name)}_devs_admins_extra_permissions",
        title=f"Developers-admins extra permissions for: {realm_name}",
        org_id=organization_id,
        description=f"This role is used to give extra permissions to the developers and admins groups of the realm {realm_name}"
                    "that are not part of the default roles",
        permissions=[
            # Developers currently have owner and editor permissions on some of the environments,
            # so we assign them the projects.getIamPolicy to allow them to see the permissions they have on the projects.
            # Note: This is only required for developers not admins.
            "resourcemanager.projects.getIamPolicy",
            "resourcemanager.folders.getIamPolicy",

            # Developers and Admins are registry repo Admins, But on the backend they will have to allow project service
            # accounts to read artifacts on docker/generic repositories.
            # For that reason, we have to allow them to read and write IAM policies on a repository.
            "artifactregistry.repositories.getIamPolicy",
            "artifactregistry.repositories.setIamPolicy"
        ],
        opts=pulumi.ResourceOptions(protect=protected_from_deletion, depends_on=dependencies, provider=provider)
    )

    # Create groups
    #  - admins
    #  - developers

    realm_developers = gcp.cloudidentity.Group(
        get_resource_name(resource="developers", resource_type="group"),
        description="Developers have read-write access to lower and read-only access to production environments",
        display_name=f"{realm_name}-developers",
        group_key=gcp.cloudidentity.GroupGroupKeyArgs(
            id=f"{realm_name}.developers@tabiya.org",
        ),
        labels={
            "cloudidentity.googleapis.com/groups.discussion_forum": "",
        },
        parent=customer_id,
        opts=pulumi.ResourceOptions(protect=protected_from_deletion, depends_on=dependencies, provider=provider)
    )

    realm_admins = gcp.cloudidentity.Group(
        get_resource_name(resource="admins", resource_type="group"),
        description="Admins have write access to both lower and production environments",
        display_name=f"{realm_name}-admins",
        group_key=gcp.cloudidentity.GroupGroupKeyArgs(
            id=f"{realm_name}.admins@tabiya.org",
        ),
        labels={
            "cloudidentity.googleapis.com/groups.discussion_forum": "",
        },
        parent=customer_id,
        opts=pulumi.ResourceOptions(protect=protected_from_deletion, depends_on=dependencies, provider=provider)
    )

    # Assign roles to the groups
    # Developers roles
    root_folder_dev_roles = ["roles/viewer", "roles/resourcemanager.folderViewer"]
    _grant_folder_roles_to_group(folder_id=root_folder_id, folder_name="realm-root-folder", group_name="devs", group=realm_developers,
                                 roles=root_folder_dev_roles,
                                 provider=provider)
    gcp.folder.IAMMember(
        get_resource_name(resource="devs-group-extra", resource_type="iam-member"),
        folder=root_folder_id,
        role=realm_developers_admin_extra_role.name,
        member=realm_developers.group_key.apply(lambda group: f"group:{group.id}"),
        opts=pulumi.ResourceOptions(depends_on=[realm_developers], provider=provider)
    )

    lower_env_folder_dev_roles = ["roles/editor", "roles/resourcemanager.projectCreator", "roles/resourcemanager.projectDeleter",
                                  "roles/serviceusage.serviceUsageAdmin"]
    _grant_folder_roles_to_group(folder_id=lower_envs_folder.folder_id, folder_name="lower-env-folder", group_name="devs", group=realm_developers,
                                 roles=lower_env_folder_dev_roles, provider=provider)
    _grant_folder_roles_to_group(folder_id=lower_env_google_oauth_projects_folder_id, folder_name="lower-env-identity-projects-folder", group_name="devs",
                                 group=realm_developers,
                                 roles=lower_env_folder_dev_roles, provider=provider)
    gcp.billing.AccountIamMember(
        get_resource_name(resource="devs-group-billing-user", resource_type="iam-member"),
        billing_account_id=billing_account_id,
        role="roles/billing.user",
        member=realm_developers.group_key.apply(lambda group: f"group:{group.id}"),
        opts=pulumi.ResourceOptions(depends_on=[realm_developers], provider=provider)
    )

    # Admin roles
    root_folder_admin_roles = ["roles/owner", "roles/resourcemanager.projectCreator", "roles/resourcemanager.projectDeleter",
                               "roles/serviceusage.serviceUsageAdmin", "roles/resourcemanager.folderViewer"]
    _grant_folder_roles_to_group(folder_id=root_folder_id, folder_name="realm-root-folder", group_name="admins", group=realm_admins,
                                 roles=root_folder_admin_roles, provider=provider)
    gcp.folder.IAMMember(
        get_resource_name(resource="admins-group-extra", resource_type="iam-member"),
        folder=root_folder_id,
        role=realm_developers_admin_extra_role.name,
        member=realm_admins.group_key.apply(lambda group: f"group:{group.id}"),
        opts=pulumi.ResourceOptions(depends_on=[realm_admins], provider=provider)
    )
    gcp.billing.AccountIamMember(
        get_resource_name(resource="admins-group-billing-user", resource_type="iam-member"),
        billing_account_id=billing_account_id,
        role="roles/billing.user",
        member=realm_admins.group_key.apply(lambda group: f"group:{group.id}"),
        opts=pulumi.ResourceOptions(depends_on=[realm_admins], provider=provider)
    )

    return lower_envs_folder, prod_envs_folder, realm_developers, realm_admins


def _export_key(*, service_account: gcp.serviceaccount.Account, key_name: str, key_file_path: str, provider: gcp.Provider) -> None:
    # wait for the artifact registry admin membership to take effect
    # see https://cloud.google.com/iam/docs/access-change-propagation

    sleep_1_minutes = time.Sleep(get_resource_name(resource=f"wait-for-1-min-before-key-{key_name}-export", resource_type="sleep"),
                                 create_duration="60s",
                                 opts=pulumi.ResourceOptions(depends_on=service_account)
                                 )

    json_key = gcp.serviceaccount.Key(
        get_resource_name(resource=key_name, resource_type="sa-key"),
        service_account_id=service_account.id,
        opts=pulumi.ResourceOptions(depends_on=[sleep_1_minutes], provider=provider)
    )

    def _handle_value(key: str):
        with open(key_file_path, "w") as file:
            file.write(base64.b64decode(key.strip()).decode("utf-8"))

    json_key.private_key.apply(_handle_value)


def _create_service_accounts(*,
                             realm_name: str,
                             developers: gcp.cloudidentity.Group,
                             admins: gcp.cloudidentity.Group,
                             roots_path: str,
                             provider: gcp.Provider,
                             dependencies: list[pulumi.Resource]) -> tuple[gcp.serviceaccount.Account, gcp.serviceaccount.Account, str, str]:
    # Create the Service accounts for CI/CD
    # Lower environments service account
    lower_env_service_account = gcp.serviceaccount.Account(
        get_resource_name(resource="lower-env-ci-cd", resource_type="sa"),
        account_id="lower-env-ci-cd-sa",
        display_name="The service account used for CI/CD in lower environments",
        create_ignore_already_exists=True,
        project=provider.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=provider),
    )
    gcp.cloudidentity.GroupMembership(
        get_resource_name(resource="lower-env-ci-cd", resource_type="group-membership"),
        group=developers.id,
        member_key={
            "id": lower_env_service_account.email
        },
        roles=[{
            "name": "MEMBER",
        }
        ]
    )

    # Export the service account key
    # Construct the path for the keys files
    keys_path = os.path.join(roots_path, "keys")
    os.makedirs(keys_path, exist_ok=True)

    lower_env_service_account_key_file_name = f"/{realm_name}-lower-env-ci-cd-key.json"
    _export_key(service_account=lower_env_service_account,
                key_name="lower-env-ci-cd-key",
                key_file_path=keys_path + lower_env_service_account_key_file_name,
                provider=provider
                )

    # Upper environments service account
    upper_env_service_account = gcp.serviceaccount.Account(
        get_resource_name(resource="upper-env-ci-cd", resource_type="sa"),
        account_id="upper-env-ci-cd-sa",
        display_name="The service account used for CI/CD in upper environments",
        create_ignore_already_exists=True,
        project=provider.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=provider),
    )

    gcp.cloudidentity.GroupMembership(
        get_resource_name(resource="upper-env-ci-cd", resource_type="group-membership"),
        group=admins.id,
        member_key={
            "id": upper_env_service_account.email
        },
        roles=[{
            "name": "MEMBER",
        }
        ]
    )
    # Export the service account key
    upper_env_service_account_key_file_name = f"/{realm_name}-upper-env-ci-cd-key.json"
    _export_key(service_account=upper_env_service_account,
                key_name="upper-env-ci-cd-key",
                key_file_path=keys_path + upper_env_service_account_key_file_name,
                provider=provider
                )
    return (lower_env_service_account,
            upper_env_service_account,
            "keys" + lower_env_service_account_key_file_name,
            "keys" + upper_env_service_account_key_file_name)


def _enable_required_services(*, provider: gcp.Provider) -> time.Sleep:
    """
    Enable the required services that are required to create the organizational base
    :param provider: the provider to use
    :return: the list of services that were enabled
    """
    # The initial APIs that must be enabled first in order to enable other GCP APIs
    _REQUIRED_SERVICES = [
        # Required to accesses cloud resources
        "cloudresourcemanager.googleapis.com",
        # Required to create custom roles
        "iam.googleapis.com",
        # Required to create groups
        "cloudidentity.googleapis.com",
        # Required for the artifact registry
        "artifactregistry.googleapis.com",
        # Required to create environement projects that have a billing enabled
        "cloudbilling.googleapis.com",
        # Required for enabling the identity toolkit in the environment projects
        "identitytoolkit.googleapis.com",
        # GCP Secret Manager — Required for creating config secrets.
        "secretmanager.googleapis.com"
    ]

    services = enable_services(provider=provider, service_names=_REQUIRED_SERVICES, dependencies=[])
    # sleep for 2 minutes to allow the services to be enabled,
    # even if the status of the services is enabled, they may not be ready to be used
    # see https://cloud.google.com/iam/docs/access-change-propagation
    # md5 hash of the concatenated string of the service names
    triggers_map = {"services": hashlib.md5("".join(_REQUIRED_SERVICES).encode('utf-8')).hexdigest()}
    return time.Sleep(
        get_resource_name(resource="wait-for-2-min-for-services-to-be-enabled", resource_type="sleep"),
        triggers=triggers_map,
        create_duration="120s", opts=pulumi.ResourceOptions(depends_on=services)
    )


def create_realm(*,
                 organization_id: str,
                 customer_id: str,
                 billing_account_id: str,
                 root_folder_id: str,
                 root_project_id: str,
                 upper_env_google_oauth_projects_folder_id: str,
                 lower_env_google_oauth_projects_folder_id: str,
                 region: str,
                 realm_name: str,
                 roots_path: str
                 ) -> None:
    # Set the provider to use the root project
    provider = gcp.Provider(
        "gcp_provider",
        project=root_project_id,
        region=region,
        # this is not needed when creating resources in the root project as the service account running pulumi is in the root project
        # user_project_override=True
    )

    # The initial APIs that must be enabled first in order to enable other GCP APIs
    wait_for_services = _enable_required_services(provider=provider)

    # Grant the roles that are required to create the organizational base
    # roles = ["roles/iam.serviceAccountAdmin",
    #         "roles/iam.serviceAccountKeyAdmin",
    #         "roles/artifactregistry.admin"]
    # admin_service_account = gcp.organizations.get_client_open_id_user_info_output()
    # wait_for_grant = _grant_roles_to_service_account(service_account=admin_service_account, roles=roles, provider=provider)
    wait_for_dependencies = [wait_for_services]  # [wait_for_services, wait_for_grant]

    # Create the organizational base
    (lower_envs_folder,
     prod_envs_folder,
     realm_developers,
     realm_admins) = _create_organizational_base(realm_name=realm_name,
                                                 organization_id=organization_id,
                                                 customer_id=customer_id,
                                                 billing_account_id=billing_account_id,
                                                 root_folder_id=root_folder_id,
                                                 upper_env_google_oauth_projects_folder_id=upper_env_google_oauth_projects_folder_id,
                                                 lower_env_google_oauth_projects_folder_id=lower_env_google_oauth_projects_folder_id,
                                                 dependencies=wait_for_dependencies,
                                                 provider=provider)
    # Create the service accounts
    (lower_env_service_account,
     upper_env_service_account,
     lower_env_service_account_key_file_name,
     upper_env_service_account_key_file_name) = _create_service_accounts(
        realm_name=realm_name,
        developers=realm_developers,
        admins=realm_admins,
        roots_path=roots_path,
        dependencies=wait_for_dependencies, provider=provider)

    # Create the artifact registry repository
    docker_repository, generic_repository = _create_repositories(
        region=region,
        admins_group=realm_admins,
        developers_group=realm_developers,
        dependencies=wait_for_dependencies,
        provider=provider
    )

    environments_config_secret = _create_secrets(
        root_project_id=root_project_id,
        admins_group=realm_admins,
        developers_group=realm_developers,
        provider=provider,
        dependencies=wait_for_dependencies
    )

    pulumi.export("docker_repository", docker_repository)
    pulumi.export("generic_repository", generic_repository)
    pulumi.export("lower_env_folder_id", lower_envs_folder.folder_id)
    pulumi.export("environments_config_secret_name", environments_config_secret.name)
    pulumi.export("lower_env_google_oauth_projects_folder_id", lower_env_google_oauth_projects_folder_id)
    pulumi.export("upper_env_folder_id", prod_envs_folder.folder_id)
    pulumi.export("upper_env_google_oauth_projects_folder_id", upper_env_google_oauth_projects_folder_id)
    pulumi.export("lower_env_service_account", lower_env_service_account)
    pulumi.export("upper_env_service_account", upper_env_service_account)
    pulumi.export("lower_env_service_account_key_file_name", lower_env_service_account_key_file_name)
    pulumi.export("upper_env_service_account_key_file_name", upper_env_service_account_key_file_name)
