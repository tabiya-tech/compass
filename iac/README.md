# Infrastructure as Code
The infrastructure for Compass is managed using [Pulumi](https://www.pulumi.com/). The infrastructure is defined in code and can be deployed to Google Cloud Platform (GCP) using Pulumi. 

## Prerequisites
### General

- A recent version of [git](https://git-scm.com/) (e.g. ^2.37 )

- [Python 3.8 or higher](https://www.python.org/downloads/)
- [Pulumi CLI](https://www.pulumi.com/docs/install/).
- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install)
- [Docker](https://docs.docker.com/get-docker/) (specifically for backend)

### GCP project setup

To use Pulumi to manage the Compass infrastructure in GCP, the following setup must be performed manually:

#### Root Project

The root project is used to manage the resources of the target projects where the resources will be created. The root project must be created manually and the service account used to run pulumi must be granted access to the root project. Here are the steps to set up the root project:

- Create a root GCP project (`ROOT-PROJECT-ID`). The same root project can be used to manage the resources of other target projects.
- The service account used to run pulumi must be granted access to the root project (see the [Target Project](#target-project) section bellow for details on the service account). \
  The service account must have permissions to use Service Usage API in the root project:
  - `roles/serviceusage.serviceUsageAdmin`
- The Service Usage API must be enabled manually using Google Cloud Console in the root project.
- The root project is specified in the organisation project environment as `GCP_ROOT_PROJECT_NAME` and it will be propagated throughout all projects
- The main usage for this root project is for billing. (check environment project) where the billing account is linked to the root project

- Another usage for root project is for Service Usage API
> **Explanation:** Service Usage API is used for enabling APIs
> Pulumi cannot enable Service Usage API to a project directly as the Service Usage API
> must be enabled to enable the API. This is a known limitation of Terraform/Pulumi.
> The workaround is to have a separate project - here called "root_project" where the
> Service Usage API is enabled. We will call the root_project's Service Usage API to
> enable the APIs for the new project/environment. 
> That is why the service account to run CI/CD should be created under this root project

#### Identity Project

The identity API is enabled manually, It can be enabled on the root project, 
the reason why this is done manually is that there are some manual steps that need to be done in the Identity Platform console like consent screen.

The exported keys from the identity project should be added to the .env/environment variables file. they must be added to the environment of backend and auth subprojects
```shell
    GCP_OAUTH_CLIENT_ID="<GCP_OAUTH_CLIENT_ID>"
    GCP_OAUTH_CLIENT_SECRET="<GCP_OAUTH_CLIENT_SECRET>"
```

#### Service Account

We need to have a service account created on root project so that it can be able to enable other services on the environment.

##### pre-requisites for the service account

- it must be the owner of the organisation, 
- it must be able to manage and delete folders on the organisation
  - create a folder
  - delete a folder
  - update a folder
  - get folder IAM Policy
  - set folder IAM Policy
- it must be able to manage projects on the organisation
  - create a project
  - delete a project
  - update a project
  - get a project
- roles/iam.organizationRoleAdmin: to be able to manage roles on the organisation
  Reference is here: https://cloud.google.com/iam/docs/understanding-roles#iam.organizationRoleAdmin
- it must be able to manage groups on the identity project (Note: this is done on admin organisation as groups are only created on google workspace admin panel)
  - create a group
  - delete a group
  - update a group
  - get a group
> Note: it is recommended to create a custom admin role named  `Groups Small Admin` with only CRUD permissions on groups.
- it must be a member of the `root project` in order for it to use ServiceUsageAPI so that it can be able to enable services on the subprojects

In summary, we need the following roles.

1. Billing Account User
2. Folder Admin
3. Organization Administrator
4. Organization Role Administrator
5. Project Creator

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
> Before running performing any tasks such as building the image or running the code locally, activate the virtual environment so that the installed dependencies are available:
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

Before running the code, you need to configure the Google Cloud SDK to use the credentials of the principal that will manage the infrastructure. That principal should have the necessary roles to manage the infrastructure in the particular project that we target. Also, you need to authenticate with Docker to push the images to the Google Cloud Artifact Registry.

See the details in the [Root Project](#root-project) and [Target project](#target-project) for the required roles of the principal. 

### Authenticate via service account keys (preffered method)

Using the [service account credentials, authenticate with Google Cloud](https://cloud.google.com/sdk/gcloud/reference/auth/activate-service-account) is the way preferred when running in a CI/CD environment and the most convenient method for running pulumi locally. 

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

Besides the service account keys authentication, there are [others ways you can authenticate with Google Cloud](https://cloud.google.com/sdk/gcloud/reference/auth). 

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
> When using service account impersonation, your account should be granted access with the `roles/iam.serviceAccountTokenCreator` to that service account. Ask the project owner to grant you that role.

### Environment variables
The deployment requires the following environment variables to be set:
- `GITHUB_SHA`: GitHub commit SHA that will be used as the docker image label. This does not have to be an actual git commit SHA, but using a static SHA (like `latest`) might have weird consequences (like the service not picking up the latest version).
- `GCP_OAUTH_CLIENT_ID`: The OAuth client ID used to authenticate the application with Firebase.
- `GCP_OAUTH_CLIENT_SECRET`: The OAuth client secret used to authenticate the application with Firebase.
- `DOMAIN_NAME`: The domain name of the environment, typically it is `<ENVIRONMENT>.compass.tabiya.tech`
- `FRONTEND_DOMAIN` : The domain of the frontend application, typically it is `<ENVIRONMENT>.compass.tabiya.tech`
- `FRONTEND_URL`: The URL of the frontend application, typically it is `https://<ENVIRONMENT>.compass.tabiya.tech`
- `BACKEND_DOMAIN` : The domain of the backend api, typically it is `<ENVIRONMENT>.compass.tabiya.tech`, for now should be equal to `FRONTEND_DOMAIN`
- `BACKEND_URL`: The URL of the backend api, typically it is `https://<ENVIRONMENT>.compass.tabiya.tech/api`. Should be different than `FRONTEND_URL`
- `TAXONOMY_MONGODB_URI`: The URI of the MongoDB Atlas instance where the ESCO taxonomy data is stored.
- `TAXONOMY_DATABASE_NAME`: The name of mongo db database where the ESCO taxonomy data with the embeddings is stored.
- `TAXONOMY_MODEL_ID`: The ID of the model used to store the taxonomy data in the database.
- `APPLICATION_MONGODB_URI`: The URI of the MongoDB Atlas instance for the application database.
- `APPLICATION_DATABASE_NAME`: The name of mongo db database used by the application to store data.
- `VERTEX_API_REGION`: The region of the Vertex API that will be used by the backend.
- `SENTRY_BACKEND_DSN`: The Sentry Data Source Name for error tracking (the backend DSN is for the project used to track backend errors)
- `ENABLE_SENTRY`: A boolean value that determines whether Sentry error tracking is enabled. Set to `True` to enable Sentry error tracking. 
- `GCP_BILLING_ACCOUNT`: The billing account ID of the GCP project. This is used to link the billing account to the project.
- `GCP_ORGANISATION_ID`: The organisation ID of the GCP organisation. This is to add all projects under this organisation.
- `GCP_ROOT_PROJECT_NAME`: The name of the root project that will be used to manage the resources of the target projects.

It is recommended to use a `.env` file to set the environment variables. Create a `.env` file in the root directory of the project and add the following content:

```shell
# .env file
GITHUB_SHA="<GIT_COMMIT_SHA>"
GCP_OAUTH_CLIENT_ID="<GCP_OAUTH_CLIENT_ID>"
GCP_OAUTH_CLIENT_SECRET="<GCP_OAUTH_CLIENT_SECRET>"
DOMAIN_NAME="<DOMAIN_NAME>"
FRONTEND_DOMAIN="<FRONTEND_DOMAIN>"
FRONTEND_URL="<FRONTEND_URL>"
BACKEND_DOMAIN="<BACKEND_DOMAIN>"
BACKEND_URL="<BACKEND_URL>"
TAXONOMY_MONGODB_URI="<URI_TO_MONGODB>"
TAXONOMY_DATABASE_NAME="<DATABASE_NAME>"
TAXONOMY_MODEL_ID="<TAXONOMY_MODEL_ID>"
APPLICATION_MONGODB_URI="<URI_TO_MONGODB>"
APPLICATION_DATABASE_NAME="<DATABASE_NAME>"
VERTEX_API_REGION="<REGION>"
SENTRY_BACKEND_DSN="<SENTRY_BACKEND_DSN>"
ENABLE_SENTRY="False"
GCP_BILLING_ACCOUNT="<BILLING_ACCOUNT>"
GCP_ORGANISATION_ID="<ORGANISATION_ID>"
GCP_ROOT_PROJECT_NAME="<ROOT_PROJECT_NAME>"
```
Refer to the backend and frontend projects for information on the environment variables.

## Running Pulumi locally

Before running the pulumi code.


1. Activate the virtual environment as instructed in the [Installation](#installation) section.
2. Set up the [Environment Variables](#environment-variables)

3. Ensure that the Docker daemon is running locally.

4. Authenticate with Google Cloud as instructed in [Authenticate via Service Account Keys](#authenticate-via-service-account-keys-preffered-method).
   ```shell
    # assuming the service account key file is in a folder named keys in the project's root directory and the key file is named credentials.json
    gcloud auth activate-service-account --key-file="$(pwd)/keys/credentials.json"
    # assuming the Google Cloud Artifact Registry is in the us-central1 region
    gcloud auth configure-docker us-central1-docker.pkg.dev
   ```

5. Run the pulumi code for the infrastructure part you want to deploy. 


For example assuming the `.env` file is in the root directory of the IaC project and the service account key file named `credentials.json` is in a folder named `keys` in the project's root directory, to preview the changes for the `backend` infrastructure of the `dev` environment, run the following command:

 ```shell
GOOGLE_CREDENTIALS="$(pwd)/keys/credentials.json" pulumi preview -C backend -s dev
 ```

## Useful links

See the [Pulumi documentation](https://www.pulumi.com/docs/) for more information on how to use Pulumi.

See the [Pulumi GCP provider documentation](https://www.pulumi.com/docs/reference/clouds/gcp/) for more information on how to use the GCP provider.

You can read more about how to configure pulumi with a a google cloud project in python [here](https://www.pulumi.com/ai/answers/15xDqB9xyu6D17Kb297Dfi/configuring-google-cloud-project-with-python)

##  Some caveats

There are some caveats to be aware of when using Pulumi to manage the Compass infrastructure in GCP: 

- auth: When deploying the auth infrastructure, we enable and configure the Identity Platform API. This API has some limitations, in that it can be enabled in a GCP project, but not disabled.
If you write code that disables or deletes the Identity Platform API, pulumi will only remove it from the pulumi state file, but the API will still be enabled in the GCP project. This can lead to unexpected behavior when trying to re-enable the API.
You may get the error
> Error creating Config: googleapi: Error 400: INVALID_PROJECT_ID : Identity Platform has already been enabled for this project.

In this case, you will need to manually import the identity platform API configuration into pulumi. This can be done by running the following command:
```shell
GOOGLE_CREDENTIALS=<KEYFILE> pulumi -C auth -s dev import gcp:identityplatform/config:Config default projects/<GCP_PROJECT_ID>/config
```
Replace `<GCP_PROJECT_ID>` with the GCP project ID where the Identity Platform API is enabled.

Once the configuration is imported, you can run pulumi commands as usual.

> Note: Don't forget to unprotect the imported resource, since imported resources are protected by default. It is important to do this, since pulumi will not allow you to destroy a protected resource.

## IaC Codebase Components

The IaC is divided into seven subprojects and lib folder for re-usable code/functions/types.

- [auth](auth): Sets up the authentication infrastructure, which is a Firebase project and related DNS Record.
- [backend](backend): Sets up the backend application's infrastructure. API Gateway, Cloudrun and Docker image for the backend application.
- [frontend](frontend): Sets up the frontend application's infrastructure, which is a static website hosted on Google Cloud Storage.
- [aws-ns](aws-ns): Sets up the AWS name servers for the subdomains. It is used to set up domain delegation for the subdomains.
- [common](common): Sets up the foundational infrastructure such as DNS records for the entire application.
- [environment](environment): sets up the environment specific configuration, for more information you can check [environment/README.md](environment/README.md)
- [organization](organization): sets up the organization specific configuration, for more information you can check [organization/README.md](organization/README.md)
