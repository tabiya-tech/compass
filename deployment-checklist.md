# Deployment Checklist

This is a checklist for deploying a new realm and setting up the first environment.

- [ ] Set up a working environment. [docs](deployment-procedure.md#step-0-set-up-the-working-environment)

- [ ] Create Realm.
  - [ ] Create a GCP Organization and Link the Billing Account [docs](deployment-procedure.md#step-11-create-a-gcp-organization-and-link-the-billing-account)
  - [ ] Create a Workspace Custom Role. [docs](deployment-procedure.md#step-12-create-a-workspace-custom-role)
  - [ ] Create a Root Folder. [docs](deployment-procedure.md#step-13-create-a-root-folder)
  - [ ] Create Google OAuth Projects Folders. [docs](deployment-procedure.md#step-14-create-google-oauth-project-folders)
  - [ ] Create a Root Project. [docs](deployment-procedure.md#step-15-create-a-root-project)
  - [ ] Create an Admin Service Account. [docs](deployment-procedure.md#step-16-create-an-admin-service-account)
  - [ ] Set up the Realm Stack. [docs](deployment-procedure.md#step-17-set-up-the-realm-stack)
  - [ ] Create and Upload the Stack Config YAML. [docs](deployment-procedure.md#step-18-create-and-upload-the-stack-config-yaml)
  - [ ] Setup Sentry. [docs](deployment-procedure.md#step-19-setup-sentry)

- [ ] Create Google OAuth Project.
  - [ ] Create a Google Project. [docs](deployment-procedure.md#step-21-create-a-google-project)
  - [ ] Set up OAuth Consent Screen. [docs](deployment-procedure.md#step-22-set-up-oauth-consent-screen)
  - [ ] Configure Branding. [docs](deployment-procedure.md#step-23-configure-branding)
  - [ ] Submit for Verification. [docs](deployment-procedure.md#step-24-submit-for-verification)
  - [ ] Configure Data Access. [docs](deployment-procedure.md#step-25-configure-data-access)


- [ ] Upload Artifacts.
  - [ ] Build and Upload Backend Artifacts. [docs](deployment-procedure.md#step-31-build-and-upload-backend-artifacts)
  - [ ] Build and Upload Frontend Artifacts. [docs](deployment-procedure.md#step-32-build-and-upload-frontend-artifacts)
  - [ ] Upload Templates. [docs](deployment-procedure.md#step-33-upload-templates)

- [ ] Deploy the Environment.
  - [ ] Create OAuth 2.0 Client. [docs](deployment-procedure.md#step-41-create-oauth-20-client)
  - [ ] Set up the Databases. [docs](deployment-procedure.md#step-42-set-up-the-databases)
  - [ ] Generate Embeddings. [docs](deployment-procedure.md#step-43-generate-embeddings)
  - [ ] Generate Invitation Codes. [docs](deployment-procedure.md#step-44-generate-invitation-codes)
  - [ ] Generate Encryption Keys. [docs](deployment-procedure.md#step-45-generate-encryption-keys)
  - [ ] Update the Realm Environment Configurations. [docs](deployment-procedure.md#step-46-update-the-realm-environment-configurations)
  - [ ] Construct .env and stack_config.yml. [docs](deployment-procedure.md#step-47-construct-env-and-stack_configyml)
  - [ ] Run the setup_env.py script. [docs](deployment-procedure.md#step-48-run-the-setuppy-script)
  - [ ] Prepare and Deploy the Environment. [docs](deployment-procedure.md#step-49-prepare-and-deploy-the-environment)
  - [ ] Configure the Auth Domains & Email Templates. [docs](deployment-procedure.md#step-410-configure-the-auth-domains-and-email-templates-for-the-identity-platform)
