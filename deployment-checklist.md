# Deployment Checklist

This is a checklist for deploying a new realm and setting up the first environment.

- [ ] Set up a working environment. [docs](deployment-procedure.md#step-0-set-up-the-working-environment)

- [ ] Create Realm.
  - [x] Create a GCP Organization and Link the Billing Account [docs](deployment-procedure.md#step-11-create-a-gcp-organization-and-link-the-billing-account)
  - [x] Create a Workspace Custom Role. [docs](deployment-procedure.md#step-12-create-a-workspace-custom-role)
  - [x] Create a Root Folder. [docs](deployment-procedure.md#step-13-create-a-root-folder)
  - [x] Create Google OAuth Projects Folders. [docs](deployment-procedure.md#step-14-create-google-oauth-project-folders)
  - [x] Create a Root Project. [docs](deployment-procedure.md#step-15-create-a-root-project)
  - [x] Create an Admin Service Account. [docs](deployment-procedure.md#step-16-create-an-admin-service-account)
  - [x] Set up the Realm Stack. [docs](deployment-procedure.md#step-17-set-up-the-realm-stack)
  - [x] Create and Upload the Stack Config YAML. [docs](deployment-procedure.md#step-18-create-and-upload-the-stack-config-yaml)
  - [x] Setup Sentry. [docs](deployment-procedure.md#step-19-setup-sentry)

- [ ] Create Google OAuth Project.
  - [x] Create a Google Project. [docs](deployment-procedure.md#step-21-create-a-google-project)
  - [x] Set up OAuth Consent Screen. [docs](deployment-procedure.md#step-22-set-up-oauth-consent-screen)
  - [x] Configure Branding. [docs](deployment-procedure.md#step-23-configure-branding)
  - [x] Submit for Verification. [docs](deployment-procedure.md#step-24-submit-for-verification)
  - [x] Configure Data Access. [docs](deployment-procedure.md#step-25-configure-data-access)


- [ ] Upload Artifacts.
  - [x] Build and Upload Backend Artifacts. [docs](deployment-procedure.md#step-31-build-and-upload-backend-artifacts)
  - [x] Build and Upload Frontend Artifacts. [docs](deployment-procedure.md#step-32-build-and-upload-frontend-artifacts)
  - [x] Upload Templates. [docs](deployment-procedure.md#step-33-upload-templates)

- [ ] Deploy the Environment.
  - [x] Create OAuth 2.0 Client. [docs](deployment-procedure.md#step-41-create-oauth-20-client)
  - [x] Set up the Databases. [docs](deployment-procedure.md#step-42-set-up-the-databases)
  - [x] Generate Embeddings. [docs](deployment-procedure.md#step-43-generate-embeddings)
  - [x] Generate Invitation Codes. [docs](deployment-procedure.md#step-44-generate-invitation-codes)
  - [x] Generate Encryption Keys. [docs](deployment-procedure.md#step-45-generate-encryption-keys)
  - [x] Update the Realm Environment Configurations. [docs](deployment-procedure.md#step-46-update-the-realm-environment-configurations)
  - [x] Construct .env and stack_config.yml. [docs](deployment-procedure.md#step-47-construct-env-and-stack_configyml)
  - [x] Run the setup_env.py script. [docs](deployment-procedure.md#step-48-run-the-setuppy-script)
  - [ ] Prepare and Deploy the Environment. [docs](deployment-procedure.md#step-49-prepare-and-deploy-the-environment)
  - [ ] Configure the Auth Domains & Email Templates. [docs](deployment-procedure.md#step-410-configure-the-auth-domains-and-email-templates-for-the-identity-platform)
