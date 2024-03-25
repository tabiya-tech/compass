# Compass Backend

## Prerequisites
- A recent version of [git](https://git-scm.com/) (e.g. ^2.37 )
- [Python 3.8 or higher](https://www.python.org/downloads/)
- [Poerty](https://python-poetry.org/)
    > Note: When you install Poetry, you may encounter an `SSL: CERTIFICATE_VERIFY_FAILED`. See [here](https://github.com/python-poetry/install.python-poetry.org/issues/112#issuecomment-1555925766) on how to resolve the issue.
  
## Installation 
In the root directory of the backend project, run the following commands:

```shell
# create a virtual environment
python3 -m venv venv-backend

# activate the virtual environment
source venv-backend/bin/activate
```

Install the dependencies:

```shell
poetry install
```

> Note:
> Before running performing any tasks such as building the image or running the code locally, activate the virtual environment so that the installed dependencies are available:
>  ```shell
>  # activate the virtual environment
>  source venv-backend/bin/activate
>  ```
> To deactivate the virtual environment, run:
> ```shell
> # deactivate the virtual environment
> deactivate
> ```

## Running the code locally
The backend is a FastAPI, LangServe app that serves the Compass API.

When running the code locally, the backend will use the credentials and the project set in the Google Cloud SDK.

Before running the code locally you should configure the Google Cloud SDK to use the credentials of the principal that has the necessary permissions required by the backend. Additionally, set the project to used with the Google Cloud SDK.

### Roles required for the principal

The principal used to run the backend should have the following roles:

- `roles/aiplatform.user`

### Authenticate with Google Cloud
There are [multiple ways you can authenticate with Google Cloud](https://cloud.google.com/sdk/gcloud/reference/auth).

As a best practice, we recommend using service account impersonation when running the code locally.

Alternatively, you can use the service account key file to authenticate with Google Cloud and run the backend.
This is useful when you want to run the backend and at the same time use the Google Cloud SDK for other tasks (e.g. deploy the infrastructure).

Bellow you can find the steps to authenticate.

#### Option 1: Service Account Impersonation

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
> 
##### Set the Google Cloud Project

Set the project to use with the Google Cloud SDK:

```shell
gcloud config set project <PROJECT>
```

##### Launch LangServe locally

Start the LangServe server with the following command:

```shell
langchain serve --host 0.0.0.0 --port 8080
```
> NOTE: 
> Langchain will infer the project and the credentials from the Google Cloud SDK.

##### Running the Image Locally

To run the image, you'll need to map your local gcloud configuration to the container and set the `PROJECT_ID` environment variable.

We also expose port 8080 with the `-p 8080:8080` option.

```shell
docker run -v ~/.config/gcloud/:/root/.config/gcloud/ -e GCLOUD_PROJECT="$(gcloud config get project)" -p 8080:8080 compass-backend
```

#### Option 2: Using Service Account Key File

You can use the service account key file to authenticate with Google Cloud and run the backend.

>ATTENTION: The service account key file should be kept secure and not shared with others.
> It should not be committed to the repository.
>

##### Launch LangServe locally
Start the LangServe server with the following command:

```shell
GOOGLE_APPLICATION_CREDENTIALS="<PATH_TO_KEY_FILE>" langchain serve --host 0.0.0.0 --port 8080
```

##### Running the Image Locally

To run the image, you'll need to supply the service account key file as an environment variable and mount the file to the container.

```shell
docker run -v "<PATH_TO_KEY_FILE>:/root/credentials.json" -e GOOGLE_APPLICATION_CREDENTIALS="/root/credentials.json" -p 8080:8080 compass-backend
```

### Building the Image locally

To build the image:

```shell
docker build . -t compass-backend
```






