# Infrastructure as Code - Environment

The purpose of this Pulumi micro-stack is to create a new project (~read `environment`).
_"A combination between partner and environment"_

### What does this micro-stack do?

The `environment` Pulumi micro-stack creates a new project under the target folder in the `tabiya.org` GCP organization. It will then enable a set of base APIs for this new project using the `"root project"`. After the project has been created, Pulumi enables a set of required base APIs for the project.\
\
The target folder is determined based on the `environment_type` configuration parameter. Check `organization` micro-stack for more information about `folders, projects, and environments`\
\
After the new `project/environment` has been created, the next micro-stacks can be set up
- auth
- backend
- frontend
- common
- aws-ns

## Prerequisites


## Required permissions

The user account or the service account used to run `pulumi up` on this micro-stack requires the following roles on the organization level

* Owner
* Project Creator
* Project Deleter

## Required configuration

The configurations should be added to a file called `Pulumi.<ENV>.yaml`
* `gcp:region`: <This might actually not be necessary>
* `environment`: Technical name for the environment. This will also be used for domain names, etc.
* `environment_name`: Display name for the environemnt, mostly used in the Google Cloud Console
* `environment_type`: Used for determining the type of the environment, which will be used for choosing the folder where this environment will be created. Valid values are `dev`, `test` and `prod`. (To understand the `projects, folders, and environments`, check the `README.md` in the `organization` micro-stack).

```yaml
config:
  gcp:region: "us-central1"
  environment: "apostolos-dev"
  environment_name: "Compass Apostolos Dev Env"
  environment_type: "dev"
```

## Setting up the environment

To run this micro-stack, use the following command in the parent directory (`compass/iac`)

`pulumi up -C environment -s <ENV>`
