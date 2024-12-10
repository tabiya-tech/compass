import pulumi
import pulumi_gcp as gcp


def create_organizational_base(organization_id: str):
    lower_envs_folder = gcp.organizations.Folder("tabiya_compass_lower_environments",
                                                 display_name="Compass Lower Environments",
                                                 parent=f'organizations/{organization_id}')

    prod_envs_folder = gcp.organizations.Folder("tabiya_compass_prod_environments",
                                                display_name="Compass Prod Environments",
                                                parent=f'organizations/{organization_id}')

    dev_org_wide_viewer_role_binding = gcp.organizations.IAMBinding("tabiya_compass_dev_viewer_role_binding",
                                                                    org_id=organization_id,
                                                                    role="roles/viewer",
                                                                    members=["group:compass.developers@tabiya.org"],
                                                                    opts=pulumi.ResourceOptions(depends_on=[lower_envs_folder]))

    dev_lower_env_admin_role_binding = gcp.folder.IAMBinding("admin",
                                                             folder=lower_envs_folder.folder_id,
                                                             role="roles/editor",
                                                             members=["group:compass.developers@tabiya.org"],
                                                             opts=pulumi.ResourceOptions(depends_on=[lower_envs_folder]))

    admin_org_wide_role_binding = gcp.organizations.IAMBinding("tabiya_compass_admin_role_binding",
                                                               org_id=organization_id,
                                                               role="roles/owner",
                                                               members=["group:compass.admins@tabiya.org"],
                                                               opts=pulumi.ResourceOptions(depends_on=[prod_envs_folder]))

    pulumi.export("folder_dev_id", lower_envs_folder.folder_id)
    pulumi.export("folder_prod_id", prod_envs_folder.folder_id)
