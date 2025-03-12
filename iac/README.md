# Infrastructure as Code

The infrastructure for Compass is managed using [Pulumi](https://www.pulumi.com/). The infrastructure is defined in code and can be deployed to Google Cloud
Platform (GCP) using Pulumi.

## IaC Codebase Components

### Keywords

- **realm**: The top-level container of the organization's infrastructure for this project (compass).
- **environment**: A combination between partner and environment. It is a project in the GCP organization that is used to deploy the infrastructure for a specific partner. The name is usually called <realm-name>.<environment-name> eg: `compass.dev`, `compass.partner-a-dev`, `test-realm.dev`


### Components

The IaC is divided into seven subprojects and lib folder for re-usable code/functions/types.

- [realm](realm): Sets up the realm.
- [environment](environment): Sets up the environment project and enable all the required APIs.
  - [DNS](dns): Sets up the Managed DNS Zone and AWS name servers for the subdomains. It is used to set up domain delegation for the subdomains.
- [auth](auth): Sets up the authentication infrastructure. (Identity Platform, IDPs, and Firebase).
- [backend](backend): Sets up the backend application's infrastructure. Cloudrun and API Gateway for the backend application.
- [frontend](frontend): Sets up the frontend application's infrastructure, a static website hosted on Google Cloud Storage.
- [common](common): Sets up the foundational infrastructure such as a load balancer, SSL certificate and DNS records for the entire application.

## The Realm

The realm is the top-level container of the organization's infrastructure for this project (compass). It has access to the groups, projects, and folders in the organization.


The main components of the realm are:
* Root Folder. The root folder is the top-level folder in the GCP organization where all the resources of the realm are created.
* Root Project. The root project is at the root folder, it's purpose is to host resources that are common to all projects in the realm, -
  * Service Accounts: Service accounts used to run deployments of environments(Project).
  * Artifacts Repositories:  Docker and generic repositories for storing images and other artifacts.
  * Environment Configurations Secret: A secret that contains the configuration for the environments.

* Folders for the environments. There are two types of environments, **_lower_** and **_production_** environments. Lower environments are used for development
  and testing, while production environments are used for production.
* organisation groups common role, a role that is common for all groups which are not added by default.
* User Groups: **_Realm developers_** and **_Realm admins_** groups. These groups are used for granting permissions to the users. (Note: Memberships will be added manually)
  <br /><br />_The roles/permissions will be inherited from the production level to the lower level in the hierarchy. Examples:_
  * a new project (~read `environment`) to the `lower environment` folder.
    * all users in the `compass.developers` group gains `roles/owner` permissions to the new project.
    * all users in the `compass.admins` group gains `roles/owner` permissions to the new project.
  * a new project (~read `environment`) to the `production environment` folder.
    * all users in the `compass.developers` group gains `roles/viewer` permissions to the new project.
    * all users in the `compass.admins` group gains `roles/owner` permissions to the new project.
