# Infrastructure as Code - Organization

The purpose of this Pulumi micro-stack is to set up the organizational base required for later adding new environments and managing access to these new environments.

Current Pulumi micro-stacks
* `organization`: Sets up the base organization


### Vocabulary
* organization: The highest level hierarchical item in GCP. Organization can contain folders and projects.
* folder: folders are used for grouping projects and granting access on the folder level. For example, if a user has `roles/owner` role for `Folder A`, the user has `roles/owner` role for all projects inside the `Folder A` folder.
* project: GCP project
* environment: environment refers to an environment where Tabiya Compass is being deployed. Example environments could be `Compass Dev`, `Compass Test`, `Compass Production`, and `Harambee Dev`. Each environment is deployed in to a separate GCP project.
* group: a group of users. Groups are used to grant roles to multiple users at once. There are two groups in the organization: 
  * `compass.admins@tabiya.org` - group for administrators
  * `compass.developers@tabiya.org` - group for developers
   
  
### What does this micro-stack do?

This micro-stack creates the following GCP resources

* folder for lower (`dev/test`) environments.
* folder for production environments.
* assigns `roles/owner` role (`read-write` access) for `compass.admins@tabiya.org` to the organization.
* assigns `roles/owner` role (`read-write` access) for `compass.developers@tabiya.org` to the lower environment folder.
* assigns `roles/viewer` role (`read-only` access) for `compass.developers@tabiya.org` to the production environment folder.

\
The roles/permissions will be inherited from the upper level to the lower level in the hierarchy. Examples:
* a new project (~read `environment`) to the `lower environment` folder.
  * all users in the `compass.developers@tabiya.org` group gains `roles/owner` permissions to the new project.
  * all users in the `compass.admins@tabiya.org` group gains `roles/owner` permissions to the new project.
* a new project (~read `environment`) to the `production environment` folder.
  * all users in the `compass.developers@tabiya.org` group gains `roles/viewer` permissions to the new project.
  * all users in the `compass.admins@tabiya.org` group gains `roles/owner` permissions to the new project.

## Prerequisites

The organizational creation is not fully automated yet, but has a few dependencies
- it expects that `compass.developers@tabiya.org` exists
- it expects that `compass.adminss@tabiya.org` exists
- the `environment` micro-stack requires the `"root project"` and it should be created manually before using this micro-stack.
- OAuth Client and Secret has been manually created/configured. These will be required when using the `environment` micro-stack, but it's best to create these beforehand to the `"root project"`.

If a `service account` is used
* placed it in the `"compass root"` folder.
* use the organization (`tabiya.org`) level IAM to grant the required roles for the service account.

### Root project

When Pulumi creates a new project (~read `environment`), the new project does not have any APIs in enabled state. This is a major issue as Pulumi must use those APIs to manage the projects (enable other APIs, create resources, etc).\
\
To overcome this issue, we use something called `root project` - a project that was manually created directly under the `tabiya.org` organization. After this `root project` has been created, the following APIs must be manually enabled in it 
* service usage api
* compute engine api
* cloud resource manager api
* Identity and Access management api
* cloud billing api

\
When Pulumi `environment` micro-stack is used, it will use the required base APIs from the `root project` to enable the necessary APIs and services in the new project/environment. The other stacks can then use the required APIs from the project/environment itself instead of using the APIs from the `root project`.
\
\
To prevent the stacks from using the required APIs from "random" projects, a pulumi.ProviderResource is used, which forces Pulumi to ignore other configurations and use the target project/environment instead. 
```
Which project will be used depends on the environment and configurations. For example, your personal gcloud configurations may point to the `root project` or to some other project instead of the new project/environment where we actually want to deploy all the changes.

Using the provider forces Pulumi always to use the target project instead of a project configured somewhere else.
```

```
gcp_provider = gcp.Provider("gcp_provider", 
                            project=project, 
                            user_project_override=True)

// Provider can then be passed in the opts 
opts=pulumi.ResourceOptions(provider=gcp_provider)

// Example usage for provider
service_account = gcp.serviceaccount.Account(
        get_resource_name(environment=basic_config.environment, resource="backend-sa"),
        account_id=get_resource_name(environment=basic_config.environment, resource="backend-sa"),
        display_name="The dedicated service account for the Compass backend service",
        project=basic_config.project,
        opts=pulumi.ResourceOptions(depends_on=dependencies, provider=basic_config.provider),
    )

```

## Required permissions

The user account or the service account used to run `pulumi up` on this micro-stack requires the following roles on the organization level

* Billing Account User
* Folder Admin
* Organization Administrator

## Required configuration

The only configuration paramater this micro-stack requires is the `orgizational_id` parameter.
The parameter should be added to a file called `Pulumi.base.yaml`

```yaml
config:
  organization_id: "589690021422"
```

## Setting up the organization

To run this micro-stack, use the following command in the parent directory (`compass/iac`)

`pulumi up -C organization -s base`
