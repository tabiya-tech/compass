# Compass Backend

FastAPI application serving the Compass career guidance API with AI-powered conversational agents.

## Prerequisites

- [Python 3.11+](https://www.python.org/downloads/)
- [Poetry 1.8+](https://python-poetry.org/)
- [Google Cloud SDK (gcloud)](https://cloud.google.com/sdk/docs/install)
- MongoDB Atlas instance with ESCO taxonomy data

## Quick Start

### Installation

Create and activate a virtual environment:

```bash
python3 -m venv venv-backend
source venv-backend/bin/activate
```

Install dependencies:

```bash
poetry lock --no-update
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

#### Running the app locally

To run the application locally after installing dependencies to the local virtual environment, run the command:

```shell
poetry run python app/server.py
```


## Running the code locally

The backend is a FastAPI app that serves the Compass API.

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
docker run -v ~/.config/gcloud/:/root/.config/gcloud/ -e GCLOUD_PROJECT="$(gcloud config get project)" -p 8080:8080 compass-backend
```

### Environment Variables & Configuration

The backend uses the following environment variables:

- `GOOGLE_APPLICATION_CREDENTIALS`: The path to the service account key file.
- `TAXONOMY_MONGODB_URI`: The URI of the MongoDB Atlas instance where the ESCO taxonomy data is stored.
- `TAXONOMY_DATABASE_NAME`: The name of mongo db database where the ESCO taxonomy data with the embeddings is stored.
- `TAXONOMY_MODEL_ID`: The model ID of the ESCO model in the compass taxonomy database.
- `APPLICATION_MONGODB_URI`: The URI of the MongoDB Atlas instance for the application database.
- `APPLICATION_DATABASE_NAME`: The name of mongo db database used by the application to store data.
- `USERDATA_MONGODB_URI`: The URI of the MongoDB instance for the user data database.
- `USERDATA_DATABASE_NAME`: The name of the mongo db database used by the application to store user data.
- `METRICS_MONGODB_URI`: The URI of the MongoDB instance for the metrics database.
- `METRICS_DATABASE_NAME`: The name of the mongo db database used by the application to store metrics data.
- `VERTEX_API_EMBEDDINGS_REGION`: The region of the Vertex API to use for embedding models. Must be a regional location (e.g. `us-central1`) — embedding models such as `text-embedding-005` are not published in the global publisher catalog.
- `VERTEX_API_GEN_AI_REGION`: (optional) The region of the Vertex API to use for generative-AI calls (Gemini etc.). Can be a regional location or `global`. If not set, defaults to `us-central1`.
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
- `GLOBAL_DISABLE_REGISTRATION_CODE`: (optional) Set to `True` to bypass registration code validation for authenticated user registration. When enabled, authenticated users can create user preferences without providing an invitation code. Defaults to `False`. 
  > **Security Note:** This should only be enabled in controlled environments (testing, demos, or deployments with external access control).  
  > **Coordination:** When enabling this setting, also set the corresponding frontend variable `GLOBAL_DISABLE_REGISTRATION_CODE` to hide the registration code input from users. Mismatched configuration (frontend hides input but backend requires code, or vice versa) will lead to confusing user errors.

  > Note: The `FRONTEND_URL` should be set irrespective of the `TARGET_ENVIRONMENT` value.
- `GLOBAL_ENABLE_CV_UPLOAD`: (optional) Set to `True` to enable CV upload feature.

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
VERTEX_API_EMBEDDINGS_REGION=<REGIONAL_LOCATION>
VERTEX_API_GEN_AI_REGION=<REGIONAL_LOCATION_OR_GLOBAL>
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
GLOBAL_DISABLE_REGISTRATION_CODE=False

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

Create a `.env` file in the backend root directory with the following variables:

```dotenv
# Google Cloud Authentication
GOOGLE_APPLICATION_CREDENTIALS=<PATH_TO_SERVICE_ACCOUNT_KEY>
VERTEX_API_EMBEDDINGS_REGION=us-central1
VERTEX_API_GEN_AI_REGION=us-central1

# MongoDB Databases
TAXONOMY_MONGODB_URI=<MONGODB_URI>
TAXONOMY_DATABASE_NAME=<DATABASE_NAME>
TAXONOMY_MODEL_ID=<MODEL_ID>
APPLICATION_MONGODB_URI=<MONGODB_URI>
APPLICATION_DATABASE_NAME=<DATABASE_NAME>
USERDATA_MONGODB_URI=<MONGODB_URI>
USERDATA_DATABASE_NAME=<DATABASE_NAME>
METRICS_MONGODB_URI=<MONGODB_URI>
METRICS_DATABASE_NAME=<DATABASE_NAME>

# Embeddings Configuration
EMBEDDINGS_SERVICE_NAME=GOOGLE-VERTEX-AI
EMBEDDINGS_MODEL_NAME=<MODEL_NAME>

# Application URLs
BACKEND_URL=<BACKEND_URL>
FRONTEND_URL=<FRONTEND_URL>

# Environment & Features
TARGET_ENVIRONMENT_NAME=local
TARGET_ENVIRONMENT_TYPE=local
BACKEND_ENABLE_METRICS=False
BACKEND_ENABLE_SENTRY=False
BACKEND_FEATURES={}
BACKEND_EXPERIENCE_PIPELINE_CONFIG={}

# Optional: Logging configuration
LOG_CONFIG_FILE=logging.cfg.yaml
```

### Google Cloud Authentication

Authenticate using a service account key file:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=<PATH_TO_KEY_FILE>
```

Set your Google Cloud project:

```bash
gcloud config set project <PROJECT_ID>
```

Required roles for the service account:
- `roles/aiplatform.user` - AI Platform API access
- `roles/dlp.user` - Data de-identification

### Running Locally

Start the FastAPI server:

```bash
python server.py
```

The API will be available at `http://localhost:8080`. Visit `http://localhost:8080/docs` for interactive API documentation.

## Testing

Run unit tests:

```bash
poetry run pytest -v -m "not (smoke_test or evaluation_test)"
```

Run smoke tests:

```bash
poetry run pytest -v -m "smoke_test"
```

Run linters:

```bash
poetry run pylint --recursive=y .
poetry run bandit -c bandit.yaml -r .
```

Run all pre-merge checks:

```bash
./run-before-merge.sh
```

## Docker

Build the image:

```bash
docker build . -t compass-backend
```

Run with environment file:

```bash
docker run -v "$(pwd)/keys/credentials.json:/code/keys/credentials.json" \
  --env-file .env -p 8080:8080 compass-backend
```

## Additional Documentation

- [Evaluation Tests](EVALUATION_TESTS_README.md) - Detailed guide for evaluation testing
- [Project Architecture](../agent_docs/ARCHITECTURE_ANALYSIS.md) - Agent architecture and patterns
- [Logging Configuration](app/logging.cfg.yaml) - Default logging setup
- [Embeddings Generation](scripts/embeddings/) - Scripts for generating taxonomy embeddings
- [Conversation Export/Import](scripts/export_conversation/) - Tools for conversation data management
- [Feedback Export](scripts/export_feedback.py) - Export user feedback to CSV

## Preference Elicitation Agent

The Preference Elicitation Agent uses vignette-based choice modeling with Bayesian inference to learn user job preferences.

### System Architecture

The agent uses a hybrid vignette system combining:
- **Static vignettes** (beginning/end) - Manually curated for specific dimensions
- **Adaptive vignettes** - D-optimal selection based on Bayesian posterior
- **Best-Worst Scaling (BWS)** - Occupation ranking tasks

### Offline Optimization

Before using the agent in production, generate optimized vignette libraries:

```bash
cd app/agent/preference_elicitation_agent/offline_optimization
python run_offline_optimization.py
```

This generates three JSON files in `app/agent/offline_output/`:
- `static_vignettes_beginning.json` - Initial vignettes (5-10)
- `static_vignettes_end.json` - Final vignettes (5-10)
- `adaptive_vignettes_library.json` - D-optimal library (40 vignettes)

### Configuration

The agent automatically looks for vignette files in:
```
app/agent/offline_output/
├── static_vignettes_beginning.json
├── static_vignettes_end.json
└── adaptive_vignettes_library.json
```

To use custom paths, initialize the agent with:
```python
agent = PreferenceElicitationAgent(
    use_offline_with_personalization=True,
    offline_output_dir="/path/to/offline_output"
)
```

### Vignette Templates

Default templates are in `app/config/vignette_templates.json`. Each template defines:
- Trade-off dimensions (e.g., salary vs. flexibility)
- Attribute constraints
- Follow-up question prompts
- Targeted preference dimensions

### Testing the Agent

Interactive testing:
```bash
python scripts/test_preference_agent_interactive.py
```

Automated testing:
```bash
poetry run pytest app/agent/preference_elicitation_agent/ -v
```

### Output

The agent produces a 7-dimensional preference vector stored in the youth profile:
- Financial compensation importance
- Work environment importance
- Career advancement importance
- Work-life balance importance
- Job security importance
- Task preference importance
- Social impact importance

For more details, see [app/agent/preference_elicitation_agent/README.md](app/agent/preference_elicitation_agent/README.md).

## Environment Variables Reference

### Core Configuration

- `GOOGLE_APPLICATION_CREDENTIALS` - Path to service account key file
- `TAXONOMY_MONGODB_URI` - MongoDB URI for taxonomy database
- `TAXONOMY_DATABASE_NAME` - Taxonomy database name
- `TAXONOMY_MODEL_ID` - ESCO model identifier
- `APPLICATION_MONGODB_URI` - MongoDB URI for application data
- `APPLICATION_DATABASE_NAME` - Application database name
- `USERDATA_MONGODB_URI` - MongoDB URI for user data
- `USERDATA_DATABASE_NAME` - User data database name
- `METRICS_MONGODB_URI` - MongoDB URI for metrics
- `METRICS_DATABASE_NAME` - Metrics database name

### AI & Embeddings

- `VERTEX_API_EMBEDDINGS_REGION` - Vertex AI region for embedding models (must be a regional location, e.g. `us-central1`)
- `VERTEX_API_GEN_AI_REGION` - Vertex AI region for generative-AI calls (regional or `global`, default: `us-central1`)
- `EMBEDDINGS_SERVICE_NAME` - Embeddings service provider
- `EMBEDDINGS_MODEL_NAME` - Model for generating embeddings

### Application

- `BACKEND_URL` - Backend API URL (for Swagger UI and CORS)
- `FRONTEND_URL` - Frontend URL (for CORS policy)
- `TARGET_ENVIRONMENT_NAME` - Environment identifier
- `TARGET_ENVIRONMENT_TYPE` - Environment type (e.g., `local`, `dev`, `prod`)
- `LOG_CONFIG_FILE` - Path to logging configuration (default: `logging.cfg.yaml`)

### Optional Features

- `BACKEND_ENABLE_METRICS` - Enable metrics tracking (`True`/`False`)
- `BACKEND_ENABLE_SENTRY` - Enable Sentry error tracking (`True`/`False`)
- `BACKEND_SENTRY_DSN` - Sentry Data Source Name
- `BACKEND_SENTRY_CONFIG` - JSON configuration for Sentry behavior
- `BACKEND_FEATURES` - JSON dictionary for feature flags
- `BACKEND_EXPERIENCE_PIPELINE_CONFIG` - JSON configuration for experience pipeline
- `BACKEND_CV_STORAGE_BUCKET` - GCS bucket for CV storage
- `BACKEND_CV_MAX_UPLOADS_PER_USER` - Upload limit per user
- `BACKEND_CV_RATE_LIMIT_PER_MINUTE` - Rate limiting for CV uploads

## Development Workflow

1. Activate virtual environment: `source venv-backend/bin/activate`
2. Make your changes
3. Run tests: `poetry run pytest`
4. Run linters: `poetry run pylint --recursive=y .`
5. Run pre-merge checks: `./run-before-merge.sh`
6. Commit using conventional commits format

For detailed development guidelines, see the [project CLAUDE.md](../CLAUDE.md).
