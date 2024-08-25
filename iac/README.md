tes# Infrastructure as Code
The infrastructure for Compass is managed using [Pulumi](https://www.pulumi.com/). The infrastructure is defined in code and can be deployed to Google Cloud Platform (GCP) using Pulumi. 

## Prerequisites
### General

- A recent version of [git](https://git-scm.com/) (e.g. ^2.37 )
- [Python 3.8 or higher](https://www.python.org/downloads/)
- [Pulumi CLI](https://www.pulumi.com/docs/install/).
- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install)

### GCP project setup

To use Pulumi to manage the Compass infrastructure in GCP, the following setup must be performed manually:
#### Root Project

The root project is used to manage the resources of the target projects where the resources will be created. The root project must be created manually and the service account used to run pulumi must be granted access to the root project. Here are the steps to set up the root project:

- Create a root GCP project (`ROOT-PROJECT-ID`). The same root project can be used to manage the resources of other target projects.
- The service account used to run pulumi must be granted access to the root project (see the [Target Project](#target-project) section bellow for details on the service account). \
  The service account must have permissions to use Service Usage API in the root project:
  - `roles/serviceusage.serviceUsageAdmin`
- The Service Usage API must be enabled manually using Google Cloud Console in the root project.
- The root project is specified in the `Pulumi.<ENVIRONMENT>.yaml` file:
    ```yaml
    # e.g .Pulumi.dev.yaml
  
    gcp_root_project: <ROOT-PROJECT-ID>
    ```  
  
> **Explanation**:
> When a new GCP project is created, the Service Usage API will be in a disabled state. This API is required for managing (enabling/disabling) other APIs in GCP. If the Service Usage API is disabled, Pulumi will throw an error. The current workaround for this issue is to have a root project with the Service Usage API enabled. Pulumi will then call the Service Usage API of the root project to enable the Service Usage API of the target GCP project where the resources are to be created.

#### Target Project
The target project is the project where the Compass resources are to be created. The service account used to run pulumi must be created in the target project. The target project must be created manually:
- Create a new GCP target project (`TARGET-PROJECT-ID`)  
- Create a service account in the target project and grant it the necessary roles to manage the resources in the target project:
  - `roles/editor`
  - `roles/resourcemanager.projectIamAdmin`
  - `roles/cloudfunctions.admin`

  This is the service account that will be used to run pulumi and manage the resources in the target project. This account should be added to the [Root Project](#root-project) as well.
  >**Note:** It is important to create the service account in the target project because any subsequent service accounts created via Pulumi using that service account will be created in the project where the initial service account was created. Not doing so will result in service accounts being incorrectly created in projects other than the target project.

- For deploying the firebase authentication via pulumi, the following steps must be performed manually in the target project:
    - Set up a consent screen in the Google Cloud Console 
    - Set up an OAuth 2.0 client ID in the Google Cloud Console. \
      When creating the OAuth 2.0 client ID, the **Authorized redirect URIs** must be set to `https://<TARGET-PROJECT-ID>.firebaseapp.com/__/auth/handler`. In the future, they should be adjusted to the actual authentication domain of the environment e.g. `https://auth.<ENVIRONMENT>.compass.tabiya.tech/__/auth/handler`. \
      The client ID and client secret used to authenticate the application with Firebase are passed to pulumi as environment variables:
      ```shell
      GCP_OAUTH_CLIENT_ID="<GCP_OAUTH_CLIENT_ID>"
      GCP_OAUTH_CLIENT_SECRET="<GCP_OAUTH_CLIENT_SECRET>"
      ```
      > Note: To the best of our knowledge, the OAuth 2.0 client ID and client secret cannot be created via pulumi/terraform. They must be created manually in the Google Cloud Console as the there is no API for creating/reading or updating OAuth 2.0 client IDs.

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
- `APPLICATION_MONGODB_URI`: The URI of the MongoDB Atlas instance for the application database.
- `APPLICATION_DATABASE_NAME`: The name of mongo db database used by the application to store data.
- `VERTEX_API_REGION`: The region of the Vertex API that will be used by the backend.

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
APPLICATION_MONGODB_URI="<URI_TO_MONGODB>"
APPLICATION_DATABASE_NAME="<DATABASE_NAME>"
VERTEX_API_REGION="<REGION>"
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