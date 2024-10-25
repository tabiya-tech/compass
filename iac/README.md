# Infrastructure as Code

The infrastructure for Compass is managed using [Pulumi](https://www.pulumi.com/). The infrastructure is defined in code and can be deployed to Google Cloud
Platform (GCP) using Pulumi.

## Prerequisites

### General

- A recent version of [git](https://git-scm.com/) (e.g. ^2.37 )

- [Python 3.8 or higher](https://www.python.org/downloads/)
- [Pulumi CLI](https://www.pulumi.com/docs/install/).
- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install)

## Installation

In the iac directory, run the following commands:

```shell
# create a virtual environment
python3 -m venv venv-iac

# activate the virtual environment
source venv-iac/bin/activate
```

Install the dependencies:

```shell
pip install -r requirements.txt
```

> Note:
> Before running performing any tasks such as building the image or running the code locally, activate the virtual environment so that the installed
> dependencies are available:
>  ```shell
>  # activate the virtual environment
>  source venv-iac/bin/activate
>  ```
> To deactivate the virtual environment, run:
> ```shell
> # deactivate the virtual environment
> deactivate
> ```

## Running the Pulumi

Before running the code, you need to configure the Google Cloud SDK to use the credentials of the principal that will manage the infrastructure. That principal
should have the necessary roles to manage the infrastructure in the particular project that we target. Also, you need to authenticate with Docker to push the
images to the Google Cloud Artifact Registry.

### Authenticate via service account keys (preferred method)

Using the [service account credentials, authenticate with Google Cloud](https://cloud.google.com/sdk/gcloud/reference/auth/activate-service-account) is the way
preferred when running in a CI/CD environment and the most convenient method for running pulumi locally.

First activate the service account using the following command, as it is required by the docker daemon to authenticate with Google Cloud Artifact Registry:

 ```shell
gcloud auth activate-service-account --key-file=<KEY_FILE>
 ```

Then, add credentials to docker:

```shell
# add credentials to docker
# replace <LOCATION> with the location of the Google Cloud Artifact Registry
gcloud auth configure-docker <LOCATION>-docker.pkg.dev
```

Finally, use the service account key file to authenticate with Google Cloud when running pulumi.
For example, assuming that you have to preview the changes, run the following command:

 ```shell
GOOGLE_CREDENTIALS=<KEY_FILE> pulumi preview 
 ```

### Authenticate with Google Cloud (alternative method)

When running the code locally, you can authenticate with Google Cloud using your personal account. 

Besides the service account keys authentication, there
are [others ways you can authenticate with Google Cloud](https://cloud.google.com/sdk/gcloud/reference/auth).

Even though it is best practice to use service account impersonation when running the code locally, it can be cumbersome to set up and use.

Here is how to authenticate to Google Cloud using service account impersonation.

Initially authenticate with your personal Google Cloud account:

 ```shell
 gcloud auth application-default login
 ```

Then, impersonate the service account that has the necessary roles to manage the infrastructure. To impersonate a service account, run the following command:

 ```shell
 gcloud config set auth/impersonate_service_account <SERVICE_ACCOUNT_EMAIL>
```

> Note:
> When using service account impersonation, your account should be granted access with the `roles/iam.serviceAccountTokenCreator` to that service account. Ask
> the project owner to grant you that role.

### Environment variables

The deployment requires the following environment variables to be set:
- `ARTIFACTS_VERSION`: The artifacts version of the application. This is used to tag the Docker images.

- `GCP_OAUTH_CLIENT_ID`: The OAuth client ID used to authenticate the application with Firebase.
- `GCP_OAUTH_CLIENT_SECRET`: The OAuth client secret used to authenticate the application with Firebase.

- `DOMAIN_NAME`: The domain name of the environment, typically it is `<ENVIRONMENT>.<REALM_NAME>.tabiya.tech`
- `FRONTEND_DOMAIN` : The domain of the frontend application, typically it is `<ENVIRONMENT>.<REALM_NAME>.tabiya.tech`
- `FRONTEND_URL`: The URL of the frontend application, typically it is `https://<ENVIRONMENT>.<REALM_NAME>.tabiya.tech`
- `BACKEND_DOMAIN` : The domain of the backend api, typically it is `<ENVIRONMENT>.<REALM_NAME>.tabiya.tech`, for now should be equal to `FRONTEND_DOMAIN`
- `BACKEND_URL`: The URL of the backend api, typically it is `https://<ENVIRONMENT>.<REALM_NAME>.tabiya.tech/api`. Should be different than `FRONTEND_URL`
- 
- `TAXONOMY_MONGODB_URI`: The URI of the MongoDB Atlas instance where the ESCO taxonomy data is stored.
- `TAXONOMY_DATABASE_NAME`: The name of mongo db database where the ESCO taxonomy data with the embeddings is stored.
- `TAXONOMY_MODEL_ID`: The ID of the model used to store the taxonomy data in the database.

- `APPLICATION_MONGODB_URI`: The URI of the MongoDB Atlas instance for the application database.
- `APPLICATION_DATABASE_NAME`: The name of mongo db database used by the application to store data.

- `USERDATA_MONGODB_URI`: The URI of the MongoDB instance for the user data database.
- `USERATA_DATABASE_NAME`: The name of the mongo db database used by the application to store user data.

- `VERTEX_API_REGION`: The region of the Vertex API that will be used by the backend.

- `SENTRY_BACKEND_DSN`: The Sentry Data Source Name for error tracking (the backend DSN is for the project used to track backend errors)
- `ENABLE_SENTRY`: A boolean value that determines whether Sentry error tracking is enabled. Set to `True` to enable Sentry error tracking.

It is recommended to use a `.env` file to set the environment variables. Create a `.env` file in the root directory of the project and add the following
content:

```shell
# .env file
ARTIFACTS_VERSION=<ARTIFACTS_VERSION>

GCP_OAUTH_CLIENT_ID=<GCP_OAUTH_CLIENT_ID>
GCP_OAUTH_CLIENT_SECRET=<GCP_OAUTH_CLIENT_SECRET>

DOMAIN_NAME=<ENVIRONMENT>.compass.tabiya.tech
FRONTEND_DOMAIN=<ENVIRONMENT>.compass.tabiya.tech
FRONTEND_URL=https://<ENVIRONMENT>.compass.tabiya.tech
BACKEND_DOMAIN=<ENVIRONMENT>.compass.tabiya.tech
BACKEND_URL=https://<ENVIRONMENT>.compass.tabiya.tech/api

TAXONOMY_MONGODB_URI=<MONGODB_URI>
TAXONOMY_DATABASE_NAME=<DATABASE_NAME>
TAXONOMY_MODEL_ID=<MODEL_ID>

APPLICATION_MONGODB_URI=<MONGODB_URI>
APPLICATION_DATABASE_NAME=<DATABASE_NAME>

USERDATA_MONGODB_URI=<URI_TO_MONGODB>
USERDATA_DATABASE_NAME=<DATABASE_NAME>

VERTEX_API_REGION=<REGION>

SENTRY_BACKEND_DSN=<SENTRY_BACKEND_DSN>
ENABLE_SENTRY=<True/False>
```

Refer to the backend and frontend projects for information on the environment variables.

## Running Pulumi locally

Before running the pulumi code:

1. Activate the virtual environment as instructed in the [Installation](#installation) section.
2. Set up the [Environment Variables](#environment-variables)
3. Ensure that the Docker daemon is running locally.
4. Authenticate with Google Cloud as instructed in [Authenticate via Service Account Keys](#authenticate-via-service-account-keys-preferred-method).
   ```shell
    # assuming the service account key file is in a folder named keys in the project's root directory and the key file is named credentials.json
    gcloud auth activate-service-account --key-file="$(pwd)/keys/credentials.json"
    # assuming the Google Cloud Artifact Registry is in the us-central1 region
    gcloud auth configure-docker us-central1-docker.pkg.dev
   ```

5. Run the pulumi code for the infrastructure part you want to deploy.

For example assuming the `.env` file is in the root directory of the IaC project and the service account key file named `credentials.json` is in a folder named
`keys` in the project's root directory, to preview the changes for the `backend` infrastructure of the `dev` environment, run the following command:
Copy pase from `.env.example` to `.env` and replace the values with the correct ones, Conduct the team for necessary values or create them if they are not
available. Refer to the documentation on how to get the variables.

 ```shell
 # for example, to preview the changes for the backend infrastructure of the dev environment
GOOGLE_CREDENTIALS="$(pwd)/keys/credentials.json" pulumi preview -C backend -s dev
 ```

### Useful links

See the [Pulumi documentation](https://www.pulumi.com/docs/) for more information on how to use Pulumi.
See the [Pulumi GCP provider documentation](https://www.pulumi.com/docs/reference/clouds/gcp/) for more information on how to use the GCP provider.

You can read more about how to configure pulumi with a Google cloud project in
python [here](https://www.pulumi.com/ai/answers/15xDqB9xyu6D17Kb297Dfi/configuring-google-cloud-project-with-python)

### Some caveats

There are some caveats to be aware of when using Pulumi to manage the Compass infrastructure in GCP:

- auth: When deploying the auth infrastructure, we enable and configure the Identity Platform API. This API has some limitations, in that it can be enabled in a
  GCP project, but not disabled.
  If you write code that disables or deletes the Identity Platform API, pulumi will only remove it from the pulumi state file, but the API will still be enabled
  in the GCP project. This can lead to unexpected behavior when trying to re-enable the API.
  You may get the error

> Error creating Config: googleapi: Error 400: INVALID_PROJECT_ID : Identity Platform has already been enabled for this project.

In this case, you will need to manually import the identity platform API configuration into pulumi. This can be done by running the following command:

```shell
GOOGLE_CREDENTIALS=<KEYFILE> pulumi -C auth -s dev import gcp:identityplatform/config:Config default projects/<GCP_PROJECT_ID>/config
```

Replace `<GCP_PROJECT_ID>` with the GCP project ID where the Identity Platform API is enabled.

Once the configuration is imported, you can run pulumi commands as usual.

> Note: Don't forget to unprotect the imported resource, since imported resources are protected by default. It is important to do this, since pulumi will not
> allow you to destroy a protected resource.

- You are going to see a warning requiring you to set `gcp:project`, This is because the project is not set in the `Pulumi.<env>.yaml` file. This is not a
  problem, because we are using a custom gcp_provider with project set dynamically because the project is created in an environment microtask and passed
  throughout other subprojects.

## IaC Codebase Components

The IaC is divided into seven subprojects and lib folder for re-usable code/functions/types.

- [realm](realm): Sets up the realm.
- [environment](environment): Sets up the environment's configuration.
- [auth](auth): Sets up the authentication infrastructure, which is a Firebase project and related DNS Record.
- [backend](backend): Sets up the backend application's infrastructure. API Gateway, Cloudrun and Docker image for the backend application.
- [frontend](frontend): Sets up the frontend application's infrastructure, which is a static website hosted on Google Cloud Storage.
- [aws-ns](aws-ns): Sets up the AWS name servers for the subdomains. It is used to set up domain delegation for the subdomains.
- [common](common): Sets up the foundational infrastructure such as DNS records for the entire application.

### The Realm

The realm is the top-level container of the organization's infrastructure for this project (compass). It has access to the groups, projects, and folders in the organization.


The main components of the realm are:
* Root Folder. The root folder is the top-level folder in the GCP organization where all the resources of the realm are created.
* Root Project. The root project is at the root folder, it's purpose is to host the service account that will be used to manage the realm.
* 
* Folders for the environments. There are two types of environments, **_lower_** and **_production_** environments. Lower environments are used for development
  and testing, while production environments are used for production.
* Projects for the environments.
* 
* folder for production environments.
* organisation groups common role, a role that is common for all groups which are not added by default.
* compass developers and compass admins groups. These groups are used for granting permissions to the users. (Note: Memberships will be added manually)
* makes admins owners for all projects (lower and production environments) and developers viewers for all projects (lower and production environments).\ and
  editors for only lower environments.
* a common docker registry used by all environments.

The roles/permissions will be inherited from the upper level to the lower level in the hierarchy. Examples:

* a new project (~read `environment`) to the `lower environment` folder.
  * all users in the `compass.developers` group gains `roles/owner` permissions to the new project.
  * all users in the `compass.admins` group gains `roles/owner` permissions to the new project.
* a new project (~read `environment`) to the `production environment` folder.
  * all users in the `compass.developers` group gains `roles/viewer` permissions to the new project.
  * all users in the `compass.admins` group gains `roles/owner` permissions to the new project.

### Environment

The purpose of this Pulumi micro-stack is to create a new project (~read `environment`).
_"A combination between partner and environment"_

#### What does this micro-stack do?

The `environment` Pulumi micro-stack creates a new project under the target folder in the `tabiya.org` GCP organization. It will then enable a set of base APIs
for this new project using the `"root project"`. After the project has been created, Pulumi enables a set of required base APIs for the project.\
\
The target folder is determined based on the `environment_type` configuration parameter. Check `organization` micro-stack for more information about
`folders, projects, and environments`\
\
After the new `project/environment` has been created, the next micro-stacks can be set up

- auth
- backend
- frontend
- common
- aws-ns

## Create a Realm

### Step 1. Workspace custom role for managing groups

The custom role for managing groups must be created in the Google Workspace of the organization where the infrastructure will be deployed.
Create the custom role using the [admin roles console of the workspace](https://admin.google.com/ac/roles) and assign the following permissions: `Create`,
`Delete`, `Read`, and `Update` Groups.

> **Note**: The custom role is needed to avoid using the existing built-in _Groups Admin_ that has too broad permissions.

### Step 2. Root Folder

Create the realm's root folder manually in the [gcloud console](https://console.cloud.google.com/cloud-resource-manager).
All resources will be created bellow this folder. It is your decision where to create the root folder, it can be at the organization root or in a subfolder of
the organization.

### Step 3. Root Project

Create the realm's root project manually in the root folder from the previous step using
the [gcloud console](https://console.cloud.google.com/cloud-resource-manager):

- Create the GCP project.
- Enable the following apis manually:
  - `Service Usage API (serviceusage.googleapis.com)`
  - `Compute Engine API (compute.googleapis.com)`
- Ensure the root project is linked to a billing account.

### Step 4. Admin Service Account

Create a service account that will be used to setup the compass realm:

- Create the service account in the realm's root project from the previous step using
  the [gcloud console](https://console.cloud.google.com/iam-admin/serviceaccounts).
- Using the [admin roles console](https://admin.google.com/ac/roles) of the workspace of the realm's root project, grant the service account the custom role
  created in [Step 1](#step-1-workspace-custom-role-for-managing-groups)
- Using the [IAM console](https://console.cloud.google.com/iam-admin/iam) grant the following roles to the service account:
    - At the **organization level** assign the roles:
      - `Organization Role Administrator (roles/iam.organizationRoleAdmin)`
      - `Billing Account Administrator (roles/billing.admin)`
    - At the **realm's root folder level** assign the roles:
      - `Folder Admin (roles/resourcemanager.folderAdmin)`
      - `Service Usage Admin (roles/serviceusage.serviceUsageAdmin)`
      - `Service Account Admin (roles/iam.serviceAccountAdmin)`
      - `Service Account Key Admin (roles/iam.serviceAccountKeyAdmin)`
      - `Artifact Registry Administrator (roles/artifactregistry.admin)`
      - `Secret Manager Admin (roles/secretmanager.admin)`
    - (Optionally) In case the service account is used to tear down resources in any of the environments, at the **realm's root folder level** assign the roles:
      - `Owner (roles/owner)`
      - `Project Deleter (roles/resourcemanager.projectDeleter)`
      - `Artifact Registry Repository Admin (roles/artifactregistry.repoAdmin)`

### Step 5. Pulumi Stack

- Create a new pulumi stack in the `realm` folder using the following command:

```shell
  # The stack name is the name of the realm, for example `tabiya-compass` 
  pulumi stack init <REALM_NAME>
```

- Configure the realm by setting the values in the pulumi stack with the following command:

```shell
  # The region where the GCP region specific resources will be created
  pulumi config set gcp:region <REGION>
  
  # The customer ID of the GCP project. This is used to identify the customer realm.
  pulumi config set gcp_customer_id <CUSTOMER_ID>
  
  # The billing account ID of the GCP project. This is used to link the billing account to realm.
  pulumi config set gcp_billing_account_id <BILLING_ACCOUNT_ID>
  
  # The organisation ID of the GCP organisation where the realm will be created.
  pulumi config set gcp_organization_id <ORGANIZATION_ID>
  
  # The name of the realm's root folder
  pulumi config set gcp_root_folder_id <ROOT_FOLDER_ID>
  
  # The name of the realm's root project
  pulumi config set gcp_root_project_id <ROOT_PROJECT_ID>    
```

> **ATTENTION**: Do not check the `Pulumi.<REALM_NAME>.yaml` file to the repository, as it contains sensitive information.

- Get the credentials from the Admin Service Account
- Authenticate with gcloud using the service account credentials
- Run the following command to create the realm:

```shell
  pulumi up -C organization -s <REALM_NAME>
```

## Identity project.

Identity project is the project, which allows users to sign in with Google. You need to specify the privacy page, consent screen and branding.

#### How to set up identity project

- Create a new project in the [Google Cloud Console](https://console.cloud.google.com/cloud-resource-manager). The project will be used to host the Identity Platform API.
- Create OAuth client ID for the web application (frontend) on the Authorized redirect URIs, we will add information later here.
  For every created project/environment we want to link to this client id,
  We will use the formula: `https://{{ project id }}.firebaseapp.com/__/auth/handler`

  Note: if we configure custom domains for a firebase application, the formula will be `https://{{ custom domain }}/__/auth/handler`


- Get the JSON or the client id and the client secret, which we are going to use when deploying the [auth micro-stack](auth).

The values should be set as the following variables, when deploying the auth micro-stack:
```shell
    GCP_OAUTH_CLIENT_ID="<GCP_OAUTH_CLIENT_ID>"
    GCP_OAUTH_CLIENT_SECRET="<GCP_OAUTH_CLIENT_SECRET>"
```

[//]: # (// TODO: Describe all the decisions made and why)
