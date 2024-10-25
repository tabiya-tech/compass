
------ 
# Deploy a full working test-realm with actual DB and configurations
- [x] (@ANSELME) run embeddings to create the search indexes
  - Add argument to the generate_esco_embeddings.py script to only generate the indexes for the target database. (0)
- [x] Generate indexes for the test-realm.test database. (0)
- [x] (@APOSTOLOS) change AUTO_REGISTER -> LOGIN for invitation code type enum and merge origin/fix/rename-AUTO_REGISTER->LOGIN
- [x] (@APOSTOLOS/@ANSELME) Setup Invitation codes manually (think about using mongo cli to import a json file with invitation or better extend repository to save invitation and use repo from a script. eventually the config may become part of the env config). Move md file to the top level. (0)
- [X] Setup invitation codes for the test-realm.test database. (0)
- [X] Deployment of test-realm.test manually.
- [X] Do a conversation
- [X] Deployment of test-realm.dev2 by pushing with '[pulumi up]' 
- [ ] ~~Deployment of the test-realm.demo (create indexes)~~
- [ ] ~~Do a conversation~~
- [X] Deploy a release.
  - [X] tag and push
  - [X] Show the actual secret pulled for when preparing ( it is not enough to say which was not found) (1)
  - [X] run setup.py for each dev/test/prod auto env with a release specific env and yaml file. (1)
  - [X] deploy the release on test environments and expect them to pick the correct secret files (see logs)


-----
# Deploy to the compass realm.
- [X] Move_setup_auth_subdomain and _setup_email_templates_dns to the Auth module.   
  The DNS_ZONE and the AWS Route53 record-set should be setup even before the Auth module (add DNS module).  
  (DNS module: DNS_ZONE <- AWS Route53) <- Auth module <- Backend module <- Frontend module <- Common module (Load balancer <- record sets for the LB)
- [X] build-and-upload-be.sh, build-and-upload-fe.sh, upload-templates.sh should perform a gcloud auth login --key-file=<GOOGLE_APPLICATION_CREDENTIALS> before running the script. (0)
- [x] Verification emails do not work, "invalid action"-> fix callback url 
- [X] Verify email template.
- [X] !!! Recreate the **compass-realm** as some api where enabled during manual work,
- [x] Redeploy a clean compass environment (dev, test, demo)
  - [x] @Anselme restrict API keys for test, demo 
  - [x] @Anselme App name for email verification of test, demo 
- [x] @Anselme Document:
  - `iac/README.md`
  - [x] How to set up
  - [x] Create Realm
  - [x] Google OAuth Projects and Folders.
- [x] Set up GitHub environment secrets for the **compass realm**.
- [x] Run a commit with [pulumi up] To ensure that the dev environments are deployed.
- @Apostolos & Anseleme Review of Test/Demo environments & Documentation & GitHub environment  
- [ ] Apostolos & Anseleme  Important: Think about cloudrun config, apigateway timeout in stack_config/backend/config (0)
- [ ] Apostolos & Anseleme **merge to the main** (0)
  -   expect dev to be deployed
---------------------
 - [ ] Ajira
   - [ ] @Apostolos setup MongoDB
     - [ ] Setup Cluster, Users, Import embeddings taxonomy 
   - [ ] Pub/Private keys
   - [ ] Invitation codes
   - [ ] Deploy test-ajira.compass.tabiya.tech, ajira.compass.tabiya.tech
 ---------------------
- [ ] Clean up compass dev-old.compass. (0)
  - Delete old pulumi stacks 
  - also clean up all the google project that we do not need anymore!
  - rename everywhere identity project to google auth.
  - Add the how to authenticate to gcp docs on the deployment-procedure. Add the three ways: using the personal email (you have to set the google quota project.). using service account. Impersonating the service account.
  - Clean up unused env variables in github

- [ ] when doing authenticate to gcloud unset the project to avoid using the wrong project. (0)
- [ ]                                     # TODO: Is this needed?
                                    aliases=[pulumi.Alias(name="identity-platform-config")],
- [ ] Add documentation : gcloud config unset project,  gcloud auth revoke before running locally !!!! (0)
- 
- [ ] Dev work should be done on the **development-realm**. The compass-realm should not be "touched manually" (1)
---------------------
# Next Steps
-[ ] Create new real for dev work an (1)
- [ ] Test the manual deployment gia via GitHub (1) Feature(1)
  - Checkout should be changed to checkout the provided branch name to run the right pulumi code.
- [ ] Password reset email template (1)
- [ ] Remove excess permissions from the firebase api key and set browser restrictions (web only, origin) (1)
  ```
    # Use https://cloud.google.com/python/docs/reference/apikeys/latest client to get the key's name
      # from the displayName: Browser key (auto created by Firebase)
      # or from the api_key_value
      #  projects/140239358428/locations/global/keys/f863d912-fd46-42b8-8de6-caa1aea491d6
      # Update the restrictions of api key using the
      # https://cloud.google.com/python/docs/reference/apikeys/latest/google.cloud.api_keys_v2.services.api_keys.ApiKeysClient#google_cloud_api_keys_v2_services_api_keys_ApiKeysClient_update_key
      # or
      # gcp.projects.ApiKey(
      #    get_resource_name(resource="api-key", resource_type="update"),
      #    project=basic_config.project,
      #    opts=pulumi.ResourceOptions(import_="projects/{{project}}/locations/global/keys/f863d912-fd46-42b8-8de6-caa1aea491d6"))
      # )
      # Use   gcloud services api-keys list --project=<project_id> to get information about the key e.g. restrictions, browserKeyRestrictions:
  ```

# Documentation

- Documentation** (1)
    - [ ] Release Process (0)
    - [ ] Scripts (0)
    - [ ] Lucid (1)
      - Github Pipeline
      - GCP Infrastructure.

------------------------------------------------------------------------------------------------

- [ ] Firebase allowed domains does not work if the environment type is local (an environment type Output is a string)
- [ ] Clean up the environment variables in github. (1)
- [ ] Clean up the pulumi stacks which are no longer in need.
- [ ] Log all the values used in the functions, for debug purposes. (1)
- [ ] use python logging instead of print and fix the todo
- [ ] Logging should be less verbose and have the right needed information. (1)
    - Replace project number with the project id.
    - Add a separator (Banner) for the steps in a script in the logs (1)
- [ ] All the scripts should have a general try and catch so that our errors are logged. (1)
- [ ] A project should be protected from deletion (1)
- [ ] Up should verify that all the required files are there. (1)

---------------------

- [ ] If the domain name has changed, Ensure common works by re-creating necessary resources. (2)
- [ ] If overwriting a file have a backup and add a log a warning,
  If the backup file already exists, add an incrementing suffix. (2)
- [ ] If the pipeline fails or finishes successfully remember to delete all the temporarily files created. (2)
- [ ] Compare dictionaries, should be improved in logging (2):  
  Expected Error Messages:
    - Error: in the template stack config yml key: config/gcp:region is not in the actual stack_config.yml from the environment.
- [ ] Get the latest version should return the latest enabled version (2)
- [X] Smoke tests should have a retry and timeout support for 2 minutes maximum and retries every after 30 seconds incrementing 1 minute every time. (2)
    - 2 minutes timeout. (2)
    - Check if the certificate is in provisioning state (by querying status from GCP/gcloud) and wait for it to be active.
      , Or the creationTimestamp. (2)
- [ ] when we deploy a version to an environment, we need to know the previous and run sanity checks. Only deploy if the version is not up. (2)
---------------------
- [ ] if an environment from the stack_config.yml is not setup (e.g. not in pulumi then warn and skip it (3)
- [ ] upload description.txt (3)
- [ ] add metadata on the docker image (3)
- [ ] only specific environments are indexed by search engines. (3)
- [ ] different environments have different SEO meta tags (3)
- [ ] Clean up policy for the realm artifact repositories. (4)
    - Untagged Images should be deleted
    - delete artifacts older than 30 days
    - keep all artifacts starting with v
    - untagged should be deleted.
- [ ] **Embeddings generations:**
    - When generating the embeddings, delete the excluded at the end of the process (for occupations and for skills) to ensure that newly added ones to the exclusion list are removed. (3)
    - Relations of excluded should not be copied
    - If the source_db_uid (ignoring the credentials) have changed, then issue a warning. (3)
    - add options to regenerate embeddings for a specific database. (3)
    - add md5 signature check to regenerate documents that have changed. (3)
    - refactor to be able to run the --help command without first having to set up the environment variables and authenticating to the google cloud. (3) 
- [ ] Use colored logging (3)

---------------------
Up for discussion:
How to populate data in new deployments e.g. 
- [ ] Invitation Codes
- [ ] Embeddings 

How to test copy of the data from the prod to test environments and run tests e.g.
integration repository/db, rest api, or e2e tests.


---------------------

# Older tasks completed
- [x] On formatters: when transforming the branch name and commit sha to version,  
  add a Hash so that the escaped versions don't match at the end. (0)
- [x] Formatter functions should be global: they won't be called by other functions to format again,  
  Ensure that they return the final value given all inputs. eg: for secret id formatter,  
  we will give secret_id_prefix, branch_name and sha to get a valid secret_id (0)
- [x] Clean up policy of the secrets (0)
    - when creating a secret specify when it will expire.