#!/usr/bin/env python3
"""
Standalone script to test Google Cloud credentials and Vertex AI access.
This will help diagnose authentication issues.
"""
import os
import sys
import json
from pathlib import Path

# Add the backend directory to the path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

print("=" * 80)
print("Google Cloud Credentials Test")
print("=" * 80)

# Load environment variables from .env if it exists
try:
    from dotenv import load_dotenv
    env_file = backend_dir / ".env"
    if env_file.exists():
        print(f"✓ Loading .env file from: {env_file}")
        load_dotenv(env_file)
    else:
        print(f"⚠ No .env file found at: {env_file}")
except ImportError:
    print("⚠ python-dotenv not installed, skipping .env file")

print("\n" + "=" * 80)
print("Step 1: Check Environment Variables")
print("=" * 80)

credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
project_id = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT") or os.getenv("GCLOUD_PROJECT")
region = os.getenv("VERTEX_API_REGION")

print(f"GOOGLE_APPLICATION_CREDENTIALS: {credentials_path}")
print(f"GOOGLE_CLOUD_PROJECT: {project_id}")
print(f"VERTEX_API_REGION: {region}")

if not credentials_path:
    print("\n❌ ERROR: GOOGLE_APPLICATION_CREDENTIALS is not set!")
    sys.exit(1)

if not project_id:
    print("\n⚠ WARNING: GOOGLE_CLOUD_PROJECT is not set in environment")
    print("   Will try to read from credentials file...")

if not region:
    print("\n⚠ WARNING: VERTEX_API_REGION is not set, will use 'us-central1'")
    region = "us-central1"

print("\n" + "=" * 80)
print("Step 2: Check Credentials File")
print("=" * 80)

if not os.path.exists(credentials_path):
    print(f"❌ ERROR: Credentials file does not exist at: {credentials_path}")
    sys.exit(1)

print(f"✓ Credentials file exists: {credentials_path}")

try:
    with open(credentials_path, 'r') as f:
        creds_data = json.load(f)
    
    file_project_id = creds_data.get('project_id')
    service_account_email = creds_data.get('client_email')
    cred_type = creds_data.get('type')
    
    print(f"  Type: {cred_type}")
    print(f"  Project ID: {file_project_id}")
    print(f"  Service Account: {service_account_email}")
    
    if not project_id:
        project_id = file_project_id
        print(f"\n✓ Using project ID from credentials file: {project_id}")
    elif project_id != file_project_id:
        print(f"\n⚠ WARNING: Project ID mismatch!")
        print(f"  Environment: {project_id}")
        print(f"  Credentials file: {file_project_id}")
        print(f"  Will use: {project_id}")
    
except json.JSONDecodeError as e:
    print(f"❌ ERROR: Invalid JSON in credentials file: {e}")
    sys.exit(1)
except Exception as e:
    print(f"❌ ERROR: Could not read credentials file: {e}")
    sys.exit(1)

print("\n" + "=" * 80)
print("Step 3: Test Google Cloud Authentication")
print("=" * 80)

try:
    from google.oauth2 import service_account
    
    credentials = service_account.Credentials.from_service_account_file(
        credentials_path,
        scopes=['https://www.googleapis.com/auth/cloud-platform']
    )
    print("✓ Successfully loaded service account credentials")
    print(f"  Service account email: {credentials.service_account_email}")
    
except Exception as e:
    print(f"❌ ERROR: Failed to load credentials: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80)
print("Step 4: Test Vertex AI Initialization")
print("=" * 80)

try:
    import vertexai
    
    print(f"Initializing Vertex AI...")
    print(f"  Project: {project_id}")
    print(f"  Location: {region}")
    print(f"  Credentials: {credentials_path}")
    
    vertexai.init(
        project=project_id,
        location=region,
        credentials=credentials
    )
    print("✓ Vertex AI initialized successfully")
    
except Exception as e:
    print(f"❌ ERROR: Failed to initialize Vertex AI: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80)
print("Step 5: Test Vertex AI Model Access")
print("=" * 80)

try:
    from vertexai.language_models import TextEmbeddingModel
    
    model_name = "text-embedding-005"
    print(f"Attempting to load model: {model_name}")
    
    model = TextEmbeddingModel.from_pretrained(model_name)
    print(f"✓ Successfully loaded model: {model_name}")
    
except Exception as e:
    print(f"❌ ERROR: Failed to load model: {e}")
    print("\nThis usually means one of:")
    print("  1. The service account doesn't have the required permissions")
    print("     Required role: roles/aiplatform.user")
    print("  2. The Vertex AI API is not enabled in the project")
    print("  3. The project ID is incorrect")
    print("  4. The credentials are invalid or expired")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80)
print("Step 6: Test Embedding Generation")
print("=" * 80)

try:
    from vertexai.language_models import TextEmbeddingInput
    import asyncio
    
    test_text = "Hello, this is a test"
    print(f"Generating embedding for: '{test_text}'")
    
    inputs = [TextEmbeddingInput(test_text, "RETRIEVAL_QUERY")]
    
    async def test_embedding():
        result = await model.get_embeddings_async(inputs)
        return result
    
    embeddings = asyncio.run(test_embedding())
    
    if embeddings and len(embeddings) > 0:
        print(f"✓ Successfully generated embedding!")
        print(f"  Embedding dimension: {len(embeddings[0].values)}")
        print(f"  First 5 values: {embeddings[0].values[:5]}")
    else:
        print("⚠ WARNING: Got empty embedding result")
    
except Exception as e:
    print(f"❌ ERROR: Failed to generate embedding: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 80)
print("✅ ALL TESTS PASSED!")
print("=" * 80)
print("\nYour credentials are working correctly.")
print("If you're still getting errors in the application, the issue is likely")
print("in how the application initializes Vertex AI.")


