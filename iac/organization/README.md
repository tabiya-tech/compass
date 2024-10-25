# Infrastructure as Code - Organization

The purpose of this Pulumi micro-stack is to set up the organizational base required for later adding new environments and managing access to these new environments.

Current Pulumi micro-stacks
* `organization`: Sets up the base organization and all the required groups and permissions on organizational level.


### Vocabulary
* organization: The highest level hierarchical item in GCP. Organization can contain folders and projects.
* folder: folders are used for grouping projects and granting access on the folder level. For example, if a user has `roles/owner` role for `Folder A`, the user has `roles/owner` role for all projects inside the `Folder A` folder.
* project: GCP project
* environment: environment refers to an environment where Tabiya Compass is being deployed. Example environments could be `Compass Dev`, `Compass Test`, `Compass Production`, and `Harambee Dev`. Each environment is deployed in to a separate GCP project.
* group: a group of users. Groups are used to grant roles to multiple users at once. for example, developers, admins, operations, ...


### What does this micro-stack do?

This micro-stack creates the following GCP resources

* top level folder for the organization (compass).
* folder for lower (`dev/test`) environments.
* folder for production environments.
* organisation groups common role, a role that is common for all groups which are not added by default.
* compass developers and compass admins groups. These groups are used for granting permissions to the users. (Note: Memberships will be added manually)
* makes admins owners for all projects (lower and production environments) and developers viewers for all projects (lower and production environments).\ and editors for only lower environments.
* a common docker registry used by all environments.


The roles/permissions will be inherited from the upper level to the lower level in the hierarchy. Examples:
* a new project (~read `environment`) to the `lower environment` folder.
  * all users in the `compass.developers` group gains `roles/owner` permissions to the new project.
  * all users in the `compass.admins` group gains `roles/owner` permissions to the new project.
* a new project (~read `environment`) to the `production environment` folder.
  * all users in the `compass.developers` group gains `roles/viewer` permissions to the new project.
  * all users in the `compass.admins` group gains `roles/owner` permissions to the new project.

## Prerequisites

The organizational creation is not fully automated yet, but has a few dependencies
- root project for adding the common resources (like docker registry, etc)
- OAuth Client and Secret has been manually created/configured. These will be required when using the `environment` micro-stack, but it's best to create these beforehand to the `"root project"`.

If a `service account` is used
* placed it in the `"compass root"` folder.
* use the organization (`tabiya.org`) level IAM to grant the required roles for the service account.

## Required permissions

The user account or the service account used to run `pulumi up` on this micro-stack requires the following roles on the organization level

* Billing Account User
* Folder Admin
* Organization Administrator

For more about service account used to run this micro-stack, check the `iac/README` running service account section.

## Required configuration

The only configuration paramater this micro-stack requires is the `GCP_ORGANISATION_ID` from environment variables.
The paramter comes from environment variables for security reasons, you can find more info on environment variables in the iac/README.md

## Setting up the organization

To run this micro-stack, use the following command in the parent directory (`compass/iac`)

`pulumi up -C organization -s base`
