# Compass Backend

## Prerequisites

- A recent version of [git](https://git-scm.com/) (e.g. ^2.37 )
- [Python 3.11 or higher](https://www.python.org/downloads/)
- [Poetry 1.3.0 or higher](https://python-poetry.org/)
  > Note: `apt-get install python3-poetry` is deprecated, use `curl -sSL https://install.python-poetry.org | python3 -`(assuming: you have a debian-like os).
  > Note: use `poetry env use <PYTHON_VERSION>` to set the python used if needed.

  > Note: When you install Poetry, you may encounter an `SSL: CERTIFICATE_VERIFY_FAILED`.
  See [here](https://github.com/python-poetry/install.python-poetry.org/issues/112#issuecomment-1555925766) on how to
  resolve the issue.
- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install)
- Access to a MongoDB Atlas instance with the ESCO data.
- optionally, [Docker](https://www.docker.com/) if you want to build and run the backend in a container.

## Installation

#### Set up virtualenv
In the **root directory** of the backend project (so, the same directory as this README file), run the following commands:

```shell
# create a virtual environment
python3 -m venv venv-backend

# activate the virtual environment
source venv-backend/bin/activate
```

#### Install the dependencies

```shell
# Use the version of the dependencies specified in the lock file
poetry lock --no-update
# Install missing and remove unreferenced packages
poetry install --sync
```

> Note: Install poetry system-wide (not in a virtualenv).

> Note:
> Before running performing any tasks such as building the image or running the code locally, activate the virtual
> environment so that the installed dependencies are available:
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

Before running the code locally you should configure the Google Cloud SDK to use the credentials of the principal that
has the necessary permissions required by the backend. Additionally, set the project to used with the Google Cloud SDK.

### Roles required for the principal

The principal used to run the backend should have the following roles:

- `roles/aiplatform.user`, needed to use the AI Platform API for embeddings and LLM.
- `roles/dlp.user`, needed to use the DLP API to de-identify the data.

### Authenticate with Google Cloud

There are [multiple ways you can authenticate with Google Cloud](https://cloud.google.com/sdk/gcloud/reference/auth).

As a best practice, we recommend using service account impersonation when running the code locally.

Alternatively, you can use the service account key file to authenticate with Google Cloud and run the backend. This second option is used to start as intern dev.
This is useful when you want to run the backend and at the same time use the Google Cloud SDK for other tasks (e.g. deploy the infrastructure).

Bellow you can find the steps to authenticate.

#### Option 1: Service Account Impersonation

Initially authenticate with your personal Google Cloud account:

 ```shell
 gcloud auth application-default login
 ```

Then, impersonate the service account that has the necessary roles to manage the infrastructure. To impersonate a
service account, run the following command:

 ```shell
 gcloud config set auth/impersonate_service_account <SERVICE_ACCOUNT_EMAIL>
```

> Note:
> When using service account impersonation, your account should be granted access with
> the `roles/iam.serviceAccountTokenCreator` to that service account. Ask the project owner to grant you that role.
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

To run the image, you'll need to map your local gcloud configuration to the container and set the `PROJECT_ID`
environment variable.

We also expose port 8080 with the `-p 8080:8080` option.

```shell
docker run -v ~/.config/gcloud/:/root/.config/gcloud/ -e GCLOUD_PROJECT="$(gcloud config get project)" -p 8080:8080 compass-backend
```

#### Option 2: Using Service Account Key File

You can use the service account key file to authenticate with Google Cloud and run the backend.
This is the most convenient way to run the backend locally, but it is less secure than service account impersonation. It
is recommended to use this method only for development purposes.

> ATTENTION: The service account key file should be kept secure and not shared with others.
> It should not be committed to the repository.
>

To authenticate with the service account key file, set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the
path of the service account key file and run the backend.

### Environment Variables & Configuration

The backend uses the following environment variables:

- `GOOGLE_APPLICATION_CREDENTIALS`: The path to the service account key file.
- `MONGODB_URI`: The URI of the MongoDB Atlas instance to use where the ESCO data is stored.
- `VERTEX_API_REGION`: The region of the Vertex API to use.

The backend supports the use of a `.env` file to set the environment variables. Create a `.env` file in the root
directory of the backend project and set the environment variables as follows:

```dotenv
# .env file
GOOGLE_APPLICATION_CREDENTIALS=<PATH_TO_KEY_FILE>
MONGODB_URI=<URI_TO_MONGODB>
VERTEX_API_REGION=<REGION>
```

> ATTENTION: The .env file should be kept secure and not shared with others as it contains sensitive information.
> It should not be committed to the repository.
>

### Building the Image locally

To build the image:

```shell
docker build . -t compass-backend
```

### Running the Image Locally

To run the image, you'll need to mount a volume with the service account key and the supply an environment variables to
the container:

```shell
docker run -v "<PATH_TO_KEY_FILE>:/code/credentials.json" -e GOOGLE_APPLICATION_CREDENTIALS="/code/credentials.json" -e MONGODB_URI="<URI_TO_MONGODB>" -e VERTEX_API_REGION="<REGION>" -p 8080:8080 compass-backend
```

If you have set up the `.env` file, you can run the image using the `--env-file` option.

For example:

Assuming the `.env` file is in the root directory of the project and the service account key file
named `credentials.json` is in a folder named `keys` in the root directory:

```dotenv
MONGODB_URI=<URI_TO_MONGODB>
GOOGLE_APPLICATION_CREDENTIALS=keys/credentials.json
VERTEX_API_REGION=<REGION>
```

Run the image using the following command:

```shell
 docker run -v "$(pwd)/keys/credentials.json:/code/keys/credentials.json" --env-file .env compass-backend
```

### Logging

The backend uses the Python logging module to log messages.

By default, the backend will load the logger configuration from the [logging.cfg.yaml](app/logging.cfg.yaml) file in the `app/` directory.

It is possible to override the logging configuration by setting the `LOG_CONFIG_FILE` environment variable to the path of the logging configuration file.

For example for the local development environment, you can set the `LOG_CONFIG_FILE` environment variable to the path of the `logging.cfg.dev.yaml`

```dotenv
# .env file
LOG_CONFIG_FILE=logging.cfg.dev.yaml
```

## Testing Locally

### Running the linter

The project uses `pylint` as the linter. To run the linter, use the following command

```shell
# Run the linter recursively in the backend directory
 poetry run pylint --recursive=y . 
```

Additionally, the project uses `bandit` to check for security vulnerabilities. To run `bandit`, use the following
command:

```shell
# Run bandit on the app and esco_search directories
poetry run bandit -c bandit.yaml -r .
```

### Running the tests

To run the unit tests, use the following command:

```shell
 poetry run pytest -v -m "not (smoke_test or evaluation_test)" 
```

### Running the smoke tests

To run the smoke tests, use the following command:

```shell
 poetry run pytest -v -m "smoke_test" 
```

### Running the evaluation tests

Evaluation tests will be run separately from other tests, full documentation [here](EVALUATION_TESTS_README.md).

### Live Logs

The default log level is `INFO` and set in the `pytest.ini` file.

You can change the logging level by passing a `--log-cli-level` argument to the `pytest` command.

For example, to set the log level to `DEBUG`, run the following command:

```shell
poetry run pytest --log-cli-level=DEBUG -v -m "not (smoke_test or evaluation_test)"
```

> Note: See [here](https://docs.pytest.org/en/latest/how-to/logging.html) for more information on logging in pytest.
