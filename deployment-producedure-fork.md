## Deployment Procedure (Forkout Brujula)

Run in this order: select GCP env → build and upload artifacts → download/configure env → run Pulumi. Replace placeholders with your values; examples are provided.

### Placeholder Legend

- `<PATH_TO_SA_KEY>`: Absolute path to the GCP service account key JSON (example: `/abs/path/iac/keys/dev-env-sa-key.json`).
- `<REGION>`: GCP region for builds (example: `us-central1`).
- `<PROJECT_ID>`: GCP project ID hosting artifacts (example: `compass-realm-root-hv2i4q59xm`).
- `<FE_REPORT_FILE>` / `<BE_REPORT_FILE>`: Local report output paths (example: `./fe-report.md`, `./be-report.md`).
- `<BUILD_RUN_NUMBER>`: Build run identifier; increment per run (example: `1` or `2`).
- `<REALM_NAME>`: Pulumi realm (example: `compass`).
- `<ENV_NAME>`: Target environment (example: `dev-brujula` or `test-brujula`).
- `<COMMIT_SHA>`: Git commit to deploy (take from `be-report.md`/`fe-report.md`).
- `<AWS_PROFILE>`: AWS profile configured for Pulumi (example: `compass-empujar`).

### 0) Select GCP Environment

Authenticate and set application credentials.

```bash
# dev example
gcloud auth activate-service-account --key-file <PATH_TO_DEV_SA_KEY>
export GOOGLE_APPLICATION_CREDENTIALS=<PATH_TO_DEV_SA_KEY>

# test example
gcloud auth activate-service-account --key-file <PATH_TO_TEST_SA_KEY>
export GOOGLE_APPLICATION_CREDENTIALS=<PATH_TO_TEST_SA_KEY>
```

If gcloud prompts for auth, rerun the `activate-service-account` command. If impersonation is set, clear it with `gcloud config unset auth/impersonate_service_account` and rerun, then re-export `GOOGLE_APPLICATION_CREDENTIALS`.

### 1) Build and Upload Artifacts

Environment is taken from the active gcloud auth above. Make sure to have created the virtual environment needed to run the scripts. 

Also before running the upload-templates.sh script, ensure that you have added all required environment variables to the .env.template

From the iac directory, run:

```bash
# Frontend
./scripts/build-and-upload-fe.sh <REGION> <PROJECT_ID> <FE_REPORT_FILE> <BUILD_RUN_NUMBER>
# Example
./scripts/build-and-upload-fe.sh us-central1 compass-realm-root-hv2i4q59xm ./fe-report.md 1

# Templates
./scripts/upload-templates.sh <REGION> <PROJECT_ID>
# Example
./scripts/upload-templates.sh us-central1 compass-realm-root-hv2i4q59xm

# Backend (Docker must be running)
./scripts/build-and-upload-be.sh <REGION> <PROJECT_ID> <BE_REPORT_FILE> <BUILD_RUN_NUMBER>
# Example
./scripts/build-and-upload-be.sh us-central1 compass-realm-root-hv2i4q59xm ./be-report.md 2
```

### 2) Environment Configuration

Two paths:

**A) `.env` changed? Run setup first.** Requires consolidated `stack_config` (combine module YAMLs before running) and `.env` files from prior `prepare.py` runs.

```bash
./scripts/setup_env.py --secrets-expire-time=never --realm-name=<REALM_NAME> --env-name=<ENV_NAME> --config-files-dir=./cfgs
# Example (dev)
./scripts/setup_env.py --secrets-expire-time=never --realm-name=compass --env-name=dev-brujula --config-files-dir=./cfgs
```

**B) No `.env` changes? Run prepare with target commit.**

```bash
./scripts/prepare.py --realm-name <REALM_NAME> --env-name <ENV_NAME> --target-git-sha <COMMIT_SHA> --target-git-branch forkout/main
# Example (test)
./scripts/prepare.py --realm-name compass --env-name test-brujula --target-git-sha 2494a96ca8b3095505e7a9cfc728a7cd14366ac6 --target-git-branch forkout/main
```

After `prepare.py`, confirm `.env` files were not overwritten unintentionally. The script logs which files were downloaded.

### 3) Run Pulumi Up

Export AWS profile and ensure Pulumi access token is configured (see Pulumi AWS setup docs). Use the same realm/env as above.

```bash
export AWS_PROFILE=<AWS_PROFILE>
# Example
export AWS_PROFILE=compass-empujar

./scripts/up.py --realm-name <REALM_NAME> --env-name <ENV_NAME>
# Examples
./scripts/up.py --realm-name compass --env-name dev-brujula
./scripts/up.py --realm-name compass --env-name test-brujula
```

### Troubleshooting

- **Where to store GCP SA keys?** Keep JSON keys in a secure local path (commonly `iac/keys/`). Point `<PATH_TO_SA_KEY>` to that absolute path.
- **gcloud auth errors**: Rerun `gcloud auth activate-service-account --key-file <PATH_TO_SA_KEY>`. If impersonation is set, run `gcloud config unset auth/impersonate_service_account`, re-auth, and re-export `GOOGLE_APPLICATION_CREDENTIALS`.
- **Missing consolidated stack_config**: Before `setup_env.py`, merge the per-module config_stack YAMLs into one file for the target env (see internal script/notion link) and place it under `./cfgs`.
- **Commit SHA source**: Use the SHA from the latest commit in github.

### Three Major Steps (recap)

1) Build and upload artifacts (frontend, templates, backend).
2) Download/configure environment (`setup_env.py` if env vars change; otherwise `prepare.py`).
3) Run Pulumi (`up.py`) with the correct AWS profile and Pulumi token.

### Done
