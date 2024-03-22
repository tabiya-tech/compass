# Infrastructure as Code

https://www.pulumi.com/ai/answers/15xDqB9xyu6D17Kb297Dfi/configuring-google-cloud-project-with-python

## Prerequisites

- A recent version of [git](https://git-scm.com/) (e.g. ^2.37 )
- [Python 3.8 or higher](https://www.python.org/downloads/)
- [Pulumi CLI](https://www.pulumi.com/docs/install/).
- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install)


## Installation
In the root directory of the project, run the following commands:

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


## Running the code locally


Before running the code, you need to configure the Google Cloud SDK to use the credentials of the principal that will manage the infrastructure. That principal should have the necessary roles to manage the infrastructure in the particular project that we target. Also, you need to authenticate with Docker to push the images to the Google Cloud Artifact Registry.

### Roles required for the principal

The principal used to manage the infrastructure should have the following roles:

The account should have the following roles:

- `role/editor`

### Authenticate with Google Cloud

There are [multiple ways you can authenticate with Google Cloud](https://cloud.google.com/sdk/gcloud/reference/auth). 

As a best practice, we recommend using service account impersonation when running the code locally.

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

#### Using the Service account keys (CI/CD)
Using the [service account credentials, authenticate with Google Cloud](https://cloud.google.com/sdk/gcloud/reference/auth/activate-service-account) is the way preferred when running in a CI/CD environment

 ```shell
gcloud auth activate-service-account <SERVICE_ACCOUNT_EMAIL> --key-file=<KEY_FILE> --project=<PROJECT_ID>
 ```

### Authenticate to Docker

Add credentials to docker:

```shell
# add credentials to docker
# replace <LOCATION> with the location of the Google Cloud Artifact Registry
gcloud auth configure-docker <LOCATION>-docker.pkg.dev
```

### Running pulumi locally
The deployment requires the following environment variables to be set:
- `MONGO_URI`: The URI of the MongoDB instance to use where the ESCO data is stored.

It is recommended to use a `.env` file to set the environment variables. Create a `.env` file in the root directory of the project and add the following content:

```shell
# .env file
MONGO_URI="<URI_TO_MONGODB>"
```

Run the pulumi code locally, using the appropriate commands. For example, to preview the changes for the dev stack, run the following command:

```shell
# preview the changes for the dev stack
pulumi preview --stack dev
```

See the [Pulumi documentation](https://www.pulumi.com/docs/) for more information on how to use Pulumi.