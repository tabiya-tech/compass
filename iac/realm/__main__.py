import os
import sys
import re

import pulumi

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/realm directory.
sys.path.insert(0, libs_dir)

from create_realm import create_realm
from lib.std_pulumi import getconfig


def main():
    # Get the realm name from the stack
    realm_name = pulumi.get_stack()
    # This constraint is needed as the realm name will be used to create projects in GCP.
    reg_ex = r"^[a-zA-Z0-9-'\" !]{1,15}$"
    if not re.match(reg_ex, realm_name):
        raise ValueError(
            f"Invalid stack name {realm_name}. It must be in up to 15 characters with lowercase and uppercase, letters, "
            f"numbers, hyphen, single-quote, double-quote, space, and exclamation point")
    pulumi.info(f"Using Realm: {realm_name}")

    # Get the config values
    region = getconfig("region", config="gcp")
    customer_id = getconfig("gcp_customer_id")
    billing_account_id = getconfig("gcp_billing_account_id")
    organization_id = getconfig("gcp_organization_id")
    root_folder_id = getconfig("gcp_root_folder_id")
    root_project_id = getconfig("gcp_root_project_id")
    upper_env_google_oauth_projects_folder_id = getconfig("gcp_upper_env_google_oauth_projects_folder_id")
    lower_env_google_oauth_projects_folder_id = getconfig("gcp_lower_env_google_oauth_projects_folder_id")
    base_domain_name = getconfig("base_domain_name")
    protected_from_deletion = getconfig("protected_from_deletion").lower() == "true"
    protected_from_deletion_tag_key = getconfig("protected_from_deletion_tag_key")
    protected_from_deletion_tag_true_value = getconfig("protected_from_deletion_tag_true_value")

    # Export the realm config so that it can be referenced in downstream stacks.
    pulumi.export("customer_id", customer_id)
    pulumi.export("billing_account_id", billing_account_id)
    pulumi.export("organization_id", organization_id)
    pulumi.export("root_folder_id", root_folder_id)
    pulumi.export("root_project_id", root_project_id)
    pulumi.export("base_domain_name", base_domain_name)

    # Create the realm
    create_realm(
        region=region,
        organization_id=organization_id,
        customer_id=customer_id,
        billing_account_id=billing_account_id,
        realm_name=realm_name,
        root_folder_id=root_folder_id,
        root_project_id=root_project_id,
        upper_env_google_oauth_projects_folder_id=upper_env_google_oauth_projects_folder_id,
        lower_env_google_oauth_projects_folder_id=lower_env_google_oauth_projects_folder_id,
        roots_path=libs_dir,
        protected_from_deletion=protected_from_deletion,
        protected_from_deletion_tag_key=protected_from_deletion_tag_key,
        protected_from_deletion_tag_true_value=protected_from_deletion_tag_true_value
    )


if __name__ == "__main__":
    main()
