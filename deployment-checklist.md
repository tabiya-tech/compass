# Deployment Checklist

This is a checklist for deploying a new realm and setting up the first environment.

- [ ] I. Create the realm: [here](/README.md#create-a-realm)
    - [ ] Billing account: [here](/README.md#step-1-organization-and-billing-account)
    - [ ] Workspace custom role: [here](/README.md#step-2-workspace-custom-role-for-managing-groups)
    - [ ] Root folder: [here](/README.md#1-root-folder)
    - [ ] Lower env identity project: [here](/README.md#2-identity-project-folders)
    - [ ] Upper env identity project: [here](/README.md#2-identity-project-folders)
    - [ ] Root project: [here](/README.md#step-4-root-project)
    - [ ] Admin Service Account: [here](/README.md#step-5-admin-service-account)
    - [ ] Activate the exported service account: [here](/README.md#step-5-admin-service-account)
    - [ ] Create the realm stack with the name `compass`. [here](/README.md#step-6-pulumi-stack)
    - [ ] Create the stack config yaml. [here](/README.md#step-7-environment-configuration)
    ```yaml
    environments:
      - environment_name: "dev"
        deployment_type: "auto"
        config:
          gcp:region: "us-central1"
          environment_type: "dev"
      - environment_name: "test"
        deployment_type: "auto"
        config:
          gcp:region: "us-central1"
          environment_type: "test"
      - environment_name: "demo"
        deployment_type: "auto"
        config:
          gcp:region: "us-central1"
          environment_type: "prod"
    ```

- [ ] II. Identity Project. [here](/README.md#google-identity-project)
    - [ ] Create the Google identity project [here](/README.md#setting-up-identity-project)

- [ ] III. Upload artifacts [here](/README.md#build-and-upload-artifacts)
    - [ ] Backend [here](/README.md#1-build-and-upload-backend-artifacts)
    - [ ] Frontend [here](/README.md#2-build-and-upload-frontend-artifacts)
    - [ ] Templates [here](/README.md#3-upload-templates)

- [ ] Iv. Set up the environment [here](/README.md#environment-deployment)
    - [ ] Create the OAuth 2.0 Client [here](/README.md#1-oauth-20-client)
    - [ ] Set up the databases [here](/README.md#2-databases)
    - [ ] Embeddings [here](/README.md#3-embeddings)
    - [ ] Invitation Codes [here](/README.md#4-invitation-codes)
    - [ ] Encryption Keys [here](/README.md#5-encryption-keys)
    - [ ] Add your environment in the realm config [here](/README.md#6-update-the-realm-environment-configurations)
    - [ ] Setup sentry [here](/README.md#7-setup-sentry)
    - [ ] Construct .env and stack_config.yml [here](/README.md#8-construct-env-and-stack-config-yaml)
    - [ ] Run the setup.py script [here](/README.md#9-run-set-up-env-script)
    - [ ] Prepare and deploy the environment [here](/README.md#10-prepare-and-deploy-the-environment)
- [ ] After words consider the actions if it is a new environment [here.](/README.md#11-post-deploy-actions)