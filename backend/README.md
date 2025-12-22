# Brújula Backend

## Prerequisites

- A recent version of [git](https://git-scm.com/) (e.g. ^2.37 )
- [Python 3.11 or higher](https://www.python.org/downloads/)
- [Poerty 1.8 or higher](https://python-poetry.org/)
  > Note: to install Poetry consult the [Poetry documentation](https://python-poetry.org/docs/#installing-with-the-official-installer)
  >
  > Note: When you install Poetry, you may encounter an `SSL: CERTIFICATE_VERIFY_FAILED`.
  See [here](https://github.com/python-poetry/install.python-poetry.org/issues/112#issuecomment-1555925766) on how to
  resolve the issue.
- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install)
- Access to a MongoDB Atlas instance with the ESCO data.
- Optionally, [Docker](https://www.docker.com/) if you want to build and run the backend in a container.

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

The backend is a FastAPI app that serves the Brújula API.

When running the code locally, the backend will use the credentials and the project set in the Google Cloud SDK.

Before running the code locally you should configure the Google Cloud SDK to use the credentials of the principal that
has the necessary permissions required by the backend. Additionally, set the project to used with the Google Cloud SDK.

### Roles required for the principal

The principal used to run the backend should have the following roles:

- `roles/aiplatform.user`, needed to use the AI Platform API for embeddings and LLM.
- `roles/dlp.user`, needed to use the DLP API to de-identify the data.

### Authenticate with Google Cloud

There are [multiple ways you can authenticate with Google Cloud](https://cloud.google.com/sdk/gcloud/reference/auth).

Using the [service account credentials, authenticate with Google Cloud](https://cloud.google.com/sdk/gcloud/reference/auth/activate-service-account) is the way
preferred when running in a CI/CD environment and the most convenient method for running pulumi locally.

The best practice is to use [service account impersonation](#option-2-service-account-impersonation) when running the code locally, it can be more complex to
operate as it requires a more complex setup and additionally the user is required to refresh the authentication token occasionally.

Bellow you can find the steps to authenticate.

#### Option 1: Authenticate via service account keys (preferred method)

You can use the service account key file to authenticate with Google Cloud and run the backend.
This is the most convenient way to run the backend locally, but it is less secure than service account impersonation. It
is recommended to use this method for development purposes.

> ATTENTION: The service account key file should be kept secure and not shared with others.
> It should not be committed to the repository.
>

To authenticate with the service account key file, set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the
path of the service account key file and run the backend.

#### Option 2: Service Account Impersonation

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
python app/server.py
```

> NOTE:
> Langchain will infer the project and the credentials from the Google Cloud SDK.

##### Running the Image Locally

To run the image, you'll need to map your local gcloud configuration to the container and set the `PROJECT_ID`
environment variable.

We also expose port 8080 with the `-p 8080:8080` option.

```shell
docker run -v ~/.config/gcloud/:/root/.config/gcloud/ -e GCLOUD_PROJECT="$(gcloud config get project)" -p 8080:8080 brujula-backend
```

### Environment Variables & Configuration

The backend uses the following environment variables:

- `GOOGLE_APPLICATION_CREDENTIALS`: The path to the service account key file.
- `TAXONOMY_MONGODB_URI`: The URI of the MongoDB Atlas instance where the ESCO taxonomy data is stored.
- `TAXONOMY_DATABASE_NAME`: The name of mongo db database where the ESCO taxonomy data with the embeddings is stored.
- `TAXONOMY_MODEL_ID`: The model ID of the ESCO model in the brujula taxonomy database.
- `APPLICATION_MONGODB_URI`: The URI of the MongoDB Atlas instance for the application database.
- `APPLICATION_DATABASE_NAME`: The name of mongo db database used by the application to store data.
- `USERDATA_MONGODB_URI`: The URI of the MongoDB instance for the user data database.
- `USERDATA_DATABASE_NAME`: The name of the mongo db database used by the application to store user data.
- `METRICS_MONGODB_URI`: The URI of the MongoDB instance for the metrics database.
- `METRICS_DATABASE_NAME`: The name of the mongo db database used by the application to store metrics data.
- `VERTEX_API_REGION`: (optional) The region of the Vertex API to use. If not set defaults to `us-central1`.
- `EMBEDDINGS_SERVICE_NAME`: The name of the embeddings service to use. Currently, the only supported service is `GOOGLE-VERTEX-AI`.
- `EMBEDDINGS_MODEL_NAME`: The name of the embeddings model to use. See https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings#supported-models for the list of supported models.
- `LOG_CONFIG_FILE`: (Optional) See the [Logging](#logging) section for more information. If not set defaults to `logging.cfg.yaml`.
- `BACKEND_URL`: The URL of the backend. It is used to correctly configure Swagger UI and the CORS policy.
- `FRONTEND_URL`: The URL of the frontend. It is used to set the CORS policy.
- `BACKEND_ENABLE_METRICS`: Set to `True` to enable metrics tracking.
- `BACKEND_ENABLE_SENTRY`: Set to `True` to enable Sentry error tracking. Set to `False`to disable locally or on CI/CD pipeline so that the unit tests can run successfully.
- `BACKEND_SENTRY_DSN`: (optional) The Sentry Data Source Name used to track backend errors.
- `BACKEND_SENTRY_CONFIG`: (optional) A JSON object controlling backend Sentry behavior. Supported fields:
  - `tracesSampleRate` (number): Transaction tracing sample rate (default: 1.0)
  - `enableLogs` (boolean): When true, LoggingIntegration is enabled
  - `logLevel` (string): Capture Python logs at or above this level via LoggingIntegration (`debug|info|warning|error|critical`; default `info`)
  - `eventLevel` (string): Send Python logs at or above this level to Sentry as events (`debug|info|warning|error|critical`; default `error`)
- `TARGET_ENVIRONMENT`: (optional) The target environment where the backend is running. When set to `dev` or `local`, CORS will be set to allow all origins.
- `BACKEND_FEATURES`: (optional) A JSON like dictionary with the features enabled status and configurations specific to each feature.
- `BACKEND_EXPERIENCE_PIPELINE_CONFIG`: (optional) The configuration for the experience pipeline as a JSON like dictionary. See `class ExperiencePipelineConfig`.
  > Note: The `FRONTEND_URL` should be set irrespective of the `TARGET_ENVIRONMENT` value.



The backend supports the use of a `.env` file to set the environment variables. Create a `.env` file in the root
directory of the backend project and set the environment variables as follows:

```dotenv
# .env file
GOOGLE_APPLICATION_CREDENTIALS=<PATH_TO_KEY_FILE>
TAXONOMY_MONGODB_URI=<URI_TO_MONGODB>
TAXONOMY_MODEL_ID=<TAXONOMY_MODEL_ID>
TAXONOMY_DATABASE_NAME=<TAXONOMY_DATABASE_NAME>
APPLICATION_MONGODB_URI=<URI_TO_MONGODB>
APPLICATION_DATABASE_NAME=<APPLICATION_DATABASE_NAME>
USERDATA_MONGODB_URI=<URI_TO_MONGODB>
USERDATA_DATABASE_NAME=<USERDATA_DATABASE_NAME>
METRICS_MONGODB_URI=<URI_TO_MONGODB>
METRICS_DATABASE_NAME=<METRICS_DATABASE_NAME>
VERTEX_API_REGION=<REGION>
EMBEDDINGS_SERVICE_NAME=<EMBEDDINGS_SERVICE_NAME>
EMBEDDINGS_MODEL_NAME=<EMBEDDINGS_MODEL_NAME>
LOG_CONFIG_FILE=<YAML_FILE>
BACKEND_URL=<URL>
FRONTEND_URL=<URL>
TARGET_ENVIRONMENT_NAME=<TARGET_ENVIRONMENT_NAME>
TARGET_ENVIRONMENT_TYPE=<TARGET_ENVIRONMENT_TYPE>
BACKEND_ENABLE_METRICS=False|True
BACKEND_ENABLE_SENTRY=False|True
BACKEND_SENTRY_DSN=<BACKEND_SENTRY_DSN>
BACKEND_SENTRY_CONFIG='{"tracesSampleRate": 0.2, "enableLogs": true, "logLevel": "info", "eventLevel": "error"}'
BACKEND_FEATURES=<BACKEND_FEATURES>
BACKEND_EXPERIENCE_PIPELINE_CONFIG=<BACKEND_EXPERIENCE_PIPELINE_CONFIG>

# CV storage and limits (optional; required to persist uploads)
BACKEND_CV_STORAGE_BUCKET=<GCS_BUCKET_NAME>
BACKEND_CV_MAX_UPLOADS_PER_USER=<INTEGER>
BACKEND_CV_RATE_LIMIT_PER_MINUTE=<INTEGER>
```

> ATTENTION: The .env file should be kept secure and not shared with others as it contains sensitive information.
> It should not be committed to the repository.
>

### Logging

The backend uses the Python logging module to log messages.

By default, the backend will load the logger configuration from the [logging.cfg.yaml](app/logging.cfg.yaml) file in the `app/` directory.

It is possible to override the logging configuration by setting the `LOG_CONFIG_FILE` environment variable to the path of the logging configuration file.

For example for the local development environment, you can set the `LOG_CONFIG_FILE` environment variable to the path of the `logging.cfg.dev.yaml`

```dotenv
# .env file
LOG_CONFIG_FILE=logging.cfg.dev.yaml
```

### Running the backend

To run the backend, use the following command from the root directory of the backend project:

```shell
python server.py
```

> NOTE: when running the backend locally, make sure to set the environment variables as described in
> the [Environment Variables & Configuration](#environment-variables--configuration) section.
> You should set the `TABIYA_MONGODB_URI` and `TABIYA_DB_NAME` environment variables to point to the mongodb cloud instance where the ESCO embeddings are
> stored.
> For the application database, set the `APPLICATION_MONGODB_URI` and `APPLICATION_DATABASE_NAME` environment variables to point a local running mongodb
> instance.

### Running the backend with Docker

#### Building the Image locally

To build the image:

```shell
docker build . -t brujula-backend
```

#### Running the Image Locally

To run the image, you'll need to mount a volume with the service account key and the supply an environment variables to
the container:

```shell
docker run -v "<PATH_TO_KEY_FILE>:/code/credentials.json" -e GOOGLE_APPLICATION_CREDENTIALS="/code/credentials.json" -e MONGODB_URI="<URI_TO_MONGODB>" -e VERTEX_API_REGION="<REGION>" -p 8080:8080 brujula-backend
```

If you have set up the `.env` file, you can run the image using the `--env-file` option.

For example:

Assuming the `.env` file is in the root directory of the project and the service account key file
named `credentials.json` is in a folder named `keys` in the root directory and a mongodb instance is running locally (`mongodb://localhost:27017`).

```dotenv
TAXONOMY_MONGODB_URI=mongodb+srv://<USERNAME>:<PASSORD>@<CLUSTER>/?retryWrites=true&w=majority&appName=Brújula-Dev
TAXONOMY_DATABASE_NAME=brujula-taxonomy-dev
TAXONOMY_MODEL_ID=<MODEL_ID>
APPLICATION_MONGODB_URI=mongodb://localhost:27017
APPLICATION_DATABASE_NAME=_compass-application-local
USERDATA_MONGODB_URI=mongodb://localhost:27017
USERDATA_DATABASE_NAME=_compass-users-local
METRICS_MONGODB_URI=mongodb://localhost:27017
METRICS_DATABASE_NAME=<METRICS_DATABASE_NAME>
GOOGLE_APPLICATION_CREDENTIALS=keys/credentials.json
VERTEX_API_REGION=<REGION>
EMBEDDINGS_SERVICE_VERSION=<EMBEDDINGS_SERVICE_VERSION>
LOG_CONFIG_FILE=logging.cfg.dev.yaml
# allow all origins
BACKEND_URL=*
# allow all origins
FRONTEND_URL=*
BACKEND_ENABLE_METRICS=False
# will add CORS policy to allow all origins
TARGET_ENVIRONMENT_NAME=local
TARGET_ENVIRONMENT_TYPE=local
BACKEND_ENABLE_SENTRY=False
BACKEND_SENTRY_DSN=<BACKEND_SENTRY_DSN>
BACKEND_FEATURES='{}'
BACKEND_EXPERIENCE_PIPELINE_CONFIG='{}'
```

Run the image using the following command:

```shell
 docker run -v "$(pwd)/keys/credentials.json:/code/keys/credentials.json" -v "$(pwd)/logs/:/code/logs/" --env-file .env -p 8080:8080 brujula-backend
```

> Note: The `-v "$(pwd)/logs/:/code/logs/"` option is used to mount a volume to store the logs specified in `logging.cfg.dev.yaml`
>

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

## Generating Embeddings

Use the [generate_taxonomy_embeddings.py](scripts/embeddings/generate_taxonomy_embeddings.py) to generate the embeddings for the taxonomy occupations and
skills.

The script reads
the occupations and skills from the Platform Taxonomy MongoDB database and generates the embeddings for the Brújula Taxonomy database.

The script requires environment variables, please refer to the [class ScriptSettings](scripts/embeddings/_base_data_settings.py)  for more information.
The environment variables **must** be run before running the script. Also, the script **must** be authenticated with the Google Cloud SDK and have permissions
to access the vertex AI Platform API.

Run the script use the following command to get the help message:

```shell
 python3 scripts/embeddings/generate_taxonomy_embeddings.py --help
```
### Copy Embeddings

The [copy_embeddings.py](scripts/embeddings/copy_embeddings.py) script facilitates the duplication of embeddings for taxonomy occupations and skills from a source MongoDB database to a target MongoDB database. This method is efficient when you need to replicate embeddings without regenerating them.

The script requires environment variables. Run the script with the following command to see a help message that explains, among other things, which environment variables are needed:

```shell
 python3 scripts/embeddings/copy_embeddings.py --help
```

## Export & Import conversations

We have scripts for exporting and importing conversations for analysis and later importing like in CI/CD integration tests setup.

1. `export.py`: used for exporting conversations from DataBase/JSON to Markdown/JSON.  
    For more information run the help command.  
    `./scripts/export_conversation/export_script.py --help`

2. `import.py`: used for importing conversations from source format (DB/JSON) to target store.  
    For more information run the help command.  
   `./scripts/export_conversation/import_script.py --help`

**Possible use cases for these scripts. (Not limited to).**

1. Export a conversation from db to markdown for analysis
2. Import a conversation from one database(dev) to another database(demo) for demo purposes.
3. Import a conversation for Integration tests setup.
4. Export a conversation from db to JSON for conversation state analysis.

## Export users feedback

The script `export_feedback.py` is used to export the feedback data from the database to a CSV file.

For the source database the script uses the following environment variables:

```dotenv
# The URI of the MongoDB instance where the feedback data is stored
FEEDBACK_MONGO_URI=<MONGODB_URI>
# The name of the database in the feedback MongoDB instance where the feedback data is stored
FEEDBACK_DATABASE_NAME=<FEEDBACK_DATABASE_NAME>
```

To run the script use the following command:

```shell
 python3 scripts/export_feedback.py
```

The script will export the feedback data to a CSV file in the `/feedback-reports` directory.