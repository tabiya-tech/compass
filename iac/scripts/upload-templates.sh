#!/usr/bin/env bash

# use the file name env.template not .env.template
# because: GCP generic artifacts doesn't expect the file to start with a dot.
env_template_file="env.template"

# the stack config template file
stack_config_template_file="stack_config.template.yml"


function check_args() {
  if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <region> <project_id> <templates_path>"
    cat << EOF
  Upload templates for this source code version.

  Arguments:
    region: The region where the templates will be uploaded
    project_id: The project id where the templates will be uploaded.
                Typically it is the root project id.
    templates_path: The path to the directory Where the templates are going to be found.
                 For now we are interested in.
                   1. $env_template_file
                   2. $stack_config_template_file
EOF
    exit 1
  fi
}

function upload_file {
  local _region=$1
  local _project_id=$2
  local _artifact_version=$3
  local _directory_path=$4
  local _file_name=$5

  local _file_path="$_directory_path/$_file_name"

  echo "info uploading the file $_file_path"

  # First delete the existing version if it exists
  echo "info: deleting the existing templates:$_artifact_version version"

  gcloud artifacts files delete "artifacts:$_artifact_version:$_file_name" \
          --repository=generic-repository \
          --location="$_region" \
          --project="$_project_id" \
          --quiet

  # Then upload the templates
  echo "info: uploading the template file: $_file_name"

  if ! gcloud artifacts generic upload --package=artifacts \
           --repository=generic-repository \
           --location="$_region" \
           --source="$_file_path" \
           --project="$_project_id" \
           --version="$_artifact_version"; then
    echo "error: failed to upload templates"
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

templates_path=$3
echo "info: setting the templates source path to $templates_path"
if [ ! -e "$templates_path/$env_template_file"  ]; then
  echo "Error: file ($templates_path/$env_template_file) does not exist."
  exit 1
fi

if [ ! -e "$templates_path/$stack_config_template_file"  ]; then
  echo "Error: file ($templates_path/$stack_config_template_file) does not exist."
  exit 1
fi

# get the tag name or branch name
git_branch_tag_name=$(git describe --exact-match --tags HEAD 2>/dev/null || git rev-parse --abbrev-ref HEAD)
echo "info: setting the branch/tag name to $git_branch_tag_name"

# parse the git branch name to filter out the invalid characters.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" # The directory where the script is located.
echo "info: setting the script directory to $script_dir"

formatted_git_branch_tag_name=$("$script_dir/parse_git_branch_name.py" --branch-name="$git_branch_tag_name" --version=generic-artifacts)
echo "info: setting the formatted branch/tag name to $formatted_git_branch_tag_name"

git_commit_sha=$(git rev-parse HEAD)
echo "info: setting the git commit sha to $git_commit_sha"

artifact_version="$formatted_git_branch_tag_name.$git_commit_sha"
echo "info: setting the artifact version to $artifact_version"


#############################
# The pipeline starts here
#############################

echo "info: uploading the templates"

upload_file "$region" "$project_id" "$artifact_version" "$templates_path" "$env_template_file"
upload_file "$region" "$project_id" "$artifact_version" "$templates_path" "$stack_config_template_file"

echo "info: finished uploading the templates"
