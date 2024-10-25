# Required services for the backend module
# These should be enabled when a new environment is created
REQUIRED_SERVICES = [
    # Required for VertexAI see https://cloud.google.com/vertex-ai/docs/start/cloud-environment
    "aiplatform.googleapis.com",
    # GCP API Gateway
    "apigateway.googleapis.com",
    # GCP Cloud Build
    "cloudbuild.googleapis.com",
    # Cloud Data Loss Prevention - Required for de-identifying data
    "dlp.googleapis.com",
    # GCP Cloud Run
    "run.googleapis.com",
]
