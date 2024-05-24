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
      The client ID and client secret used to authenticate the application with Firebase are passed to pulumi as environment variables:
      ```shell
      GCP_OAUTH_CLIENT_ID="<GCP_OAUTH_CLIENT_ID>"
      GCP_OAUTH_CLIENT_SECRET="<GCP_OAUTH_CLIENT_SECRET>"
      ```
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
- `MONGODB_URI`: The URI of the MongoDB instance to use where the ESCO data is stored.
- `GITHUB_SHA`: GitHub commit SHA that will be used as the docker image label. This does not have to be an actual git commit SHA, but using a static SHA (like `latest`) might have weird consequences (like the service not picking up the latest version).
- `GCP_OAUTH_CLIENT_ID`: The OAuth client ID used to authenticate the application with Firebase.
- `GCP_OAUTH_CLIENT_SECRET`: The OAuth client secret used to authenticate the application with Firebase.

It is recommended to use a `.env` file to set the environment variables. Create a `.env` file in the root directory of the project and add the following content:

```shell
# .env file
MONGODB_URI="<URI_TO_MONGODB>"
GITHUB_SHA="<GIT_COMMIT_SHA>"
GCP_OAUTH_CLIENT_ID="<GCP_OAUTH_CLIENT_ID>"
GCP_OAUTH_CLIENT_SECRET="<GCP_OAUTH_CLIENT_SECRET>"
```

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