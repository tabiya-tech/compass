
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
  - 
~~- [ ] Deployment of the test-realm.demo (create indexes)~~
~~- [ ] Do a conversation~~
- [X] Deploy a release.
  - [X] tag and push
  - [ ] Sow the actual secret pulled for when preparing ( it is not enough to say which was not found) (1)
  - [ ] run setup.py for each dev/test/prod auto env with a release specific env and yaml file. (1)
  - deploy the release on all the environments and expect them to pick the correct secret files (see logs)

-----
# Deploy to the compass realm.
- [ ] Replace compass dev with new compass realm.
  - also clean up all the google project that we do not need anymore!
- [ ] merge to the main
- [ ] Test the manual deployment. (0)
    - Checkout should be changed to checkout the provided branch name. to run the right pulumi code.
---------------------

# Documentation
- Documentation** (1)
    - [ ] `iac/README.md`
        - How to set up
        - Create Realm
        - Identity Projects and Folders.
        - Release Process
    - [ ] Lucid
        - Github Pipeline
        - GCP Infrastructure.
    - [ ] Scripts
- [ ] Think about cloudrun config in stack_config/backend/config (1)
- [ ] Clean up the environment variables in github. (1)
- [ ] Log all the values used in the functions, for debug purposes. (1)
- [ ] Logging should be less verbose and have the right needed information. (1)
    - Replace project number with the project id.
    - Add a separator (Banner) for the steps in a script in the logs (1)
- [ ] All the scripts should have a general try and catch so that our errors are logged. (1)
- [ ] A project should be protected from deletion (1)
- [ ] Up should verify that all the required files are there. (1)

---------------------


- [ ] If overwriting a file have a backup and add a log a warning,
  If the backup file already exists, add an incrementing suffix. (2)
- [ ] If the pipeline fails or finishes successfully remember to delete all the temporarily files created. (2)
- [ ] Compare dictionaries, should be improved in logging (2):  
  Expected Error Messages:
    - Error: in the template stack config yml key: config/gcp:region is not in the actual stack_config.yml from the environment.
- [ ] Get the latest version should return the latest enabled version (2)
- [ ] Smoke tests should have a retry and timeout support for 2 minutes maximum and retries every after 30 seconds incrementing 1 minute every time. (2)
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
