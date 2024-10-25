#!/usr/bin/env bash
# comment out the set -x to enable debugging
# set -x

####################################
# Import the common functions
if false; then
  # IntelliJ Hack. This will never run, but it will make the IDE recognize the functions.
  # It is needed so that IntelliJ can resolve the common.sh location statically.
  source "./common.sh"
fi
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
####################################

function check_args() {
  if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <region> <project_id>"
    cat << EOF
  Upload templates for this source code version.

  This script uploads the templates to the Google Cloud Artifacts Repository.
    - env.template file.
    - stack_config.template.yaml file.

  Arguments:
    region: The region where the templates will be uploaded
    project_id: The project id where the templates will be uploaded.
                Typically it is the root project id.
EOF
    exit 1
  fi
}

#############################
# Main script starts here
#############################
check_args "$@"

#############################
# Set the variables
#############################

region=$1
echo "info: setting the region to $region"

project_id=$2
echo "info: setting the project id to $project_id"

if [ -z "$ROOT_PATH" ]; then
  echo "Error: \$ROOT_PATH is required. Should be set in the common.sh script."
  exit 1
fi

templates_path="$ROOT_PATH/iac/templates"
echo "info: setting the templates source path to $templates_path"

# use the file name env.template not .env.template
# because: GCP generic artifacts doesn't expect the file to start with a dot.
env_template_file="env.template"
if [ ! -e "$templates_path/$env_template_file"  ]; then
  echo "Error: file ($templates_path/$env_template_file) does not exist."
  exit 1
fi

# the stack config template file
stack_config_template_file="stack_config.template.yaml"
if [ ! -e "$templates_path/$stack_config_template_file"  ]; then
  echo "Error: file ($templates_path/$stack_config_template_file) does not exist."
  exit 1
fi

artifact_version="$(get_generic_artifacts_version)"
echo "info: setting the artifact version to $artifact_version"

#############################
# The pipeline starts here
#############################

# Ensure gcloud is authenticated
authenticate_gcloud

# Upload the templates
echo "info: uploading the templates"

upload_file "$region" "$project_id" "$artifact_version" "$templates_path" "$env_template_file"
upload_file "$region" "$project_id" "$artifact_version" "$templates_path" "$stack_config_template_file"

echo "info: finished uploading the templates"
