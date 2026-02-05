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

### Configuration

Create a `.env` file in the backend root directory with the following variables:

```dotenv
# Google Cloud Authentication
GOOGLE_APPLICATION_CREDENTIALS=<PATH_TO_SERVICE_ACCOUNT_KEY>
VERTEX_API_REGION=us-central1

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

- `VERTEX_API_REGION` - Vertex AI region (default: `us-central1`)
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
