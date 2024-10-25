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

function save_report() {
  local _report_filename=$1
  local _deployable_generic_tag=$2
  local _deployable_docker_tag=$3
  local _version_json_filename=$4

  {
    echo "### Backend artifacts packaging summary"
    echo "**Date**: \`$(date -u +%F' %T.%3N UTC')\`     "
    echo "**status**: ✅ Successfully uploaded       "
    echo "**Config version**: \`$_deployable_generic_tag\`    "
    echo "**Docker version**: \`$_deployable_docker_tag\`    "
    echo "**version.json**:     "
    echo  "\`\`\`json"
    cat "$_version_json_filename"
    echo  "\`\`\`"
    echo "-------"
  } >> "$_report_filename"
}

function write_version_json() {
  local _version_json_filename=$1
  local _git_branch_tag_name=$2
  local _git_commit_sha=$3
  local _build_run=$4

  echo "info: setting the version info in $_version_json_filename"
  sed -i -e "s|\###date###|$(date -u '+%F %T.%3N UTC')|g" "${_version_json_filename}"
  sed -i -e "s|\###GITHUB_REF_NAME###|$_git_branch_tag_name|g" "${_version_json_filename}"
  sed -i -e "s|\###GITHUB_RUN_NUMBER###|$_build_run|g" "${_version_json_filename}"
  sed -i -e "s|\###GITHUB_SHA###|$_git_commit_sha|g" "${_version_json_filename}"
  cat "$_version_json_filename"
}

function build_and_upload_be_docker_img() {
  local _region=$1
  local _project_id=$2
  local _artifact_version=$3
  local _source_path=$4

  # 1. set the docker image
  echo "info: set docker region"
  gcloud auth configure-docker "$region-docker.pkg.dev"

  # 2. set the artifact label
  local _artifact_name
  _artifact_name="$_region-docker.pkg.dev/$_project_id/docker-repository/backend:$_artifact_version"
  echo "info: building and uploading the docker image $_artifact_name"

  # it is required to specify the platform while build the backend image.
  # This is needed to tell which platform docker should build the image to run on, other than the platform the image is being built on.
  # For now the platform running the image is cloud run, which is linux/amd64
  # @ref: https://cloud.google.com/run/docs/container-contract
  echo "info: building and push the docker image for linux"
  if ! docker build --platform linux/amd64 -t "$_artifact_name" "$_source_path" --push; then
    echo "error: failed to build and push the backend docker image"
    exit 1
  fi
}

function check_args() {
  if [ "$#" -ne 4 ]; then
    echo "Usage: $0 <region> <project_id> <report_filename> <build_run>"
    cat << EOF
  Build and Upload the backend artifacts,
  The artifacts are versioned based on the current git branch/tag name and the commit sha.

  This script builds the backend Docker image and pushes it to the docker repository.
  It also exports the API Gateway configuration and uploads it to the GCP Artifact repository.

  Requirements:
    - this script needs to run from the within the git repository.
    - the intended branch/tag has been checked out.
    - the backend virtual environment is activated.
    - Poetry and backend dependencies are installed.

  Arguments:
    region: The region where the artifacts will be uploaded.
    project_id: The project id where the artifacts will be uploaded.
                Typically it is the root project id.
    report_filename: The filename of the report file. Typically it is the GITHUB_STEP_SUMMARY when running in GitHub Actions.
    build_run: The build run number. Typically it is the GITHUB_RUN_NUMBER when running in GitHub Actions.

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

report_filename="$(real_file_path "$3")"
echo "info: setting the report filename to $report_filename"

build_run=$4
echo "info: setting the build run to $build_run"

if [ -z "$ROOT_PATH" ]; then
  echo "Error: \$ROOT_PATH is required. Should be set in the common.sh script."
  exit 1
fi

source_path="$ROOT_PATH/backend"
echo "info: setting the source path to $source_path"
if [ ! -d "$source_path" ]; then
  echo "Error: backend module path ($source_path) does not exist."
  exit 1
fi

# @IMPORTANT: The filename of the api gateway config file name, must match the value used in backend/scripts/convert_to_openapi2.py:GCP_API_GATEWAY_CONFIG_FILE
api_gateway_config_file_name="api_gateway_config.yaml"
echo "info: setting the api gateway config file name to $api_gateway_config_file_name"

git_branch_tag_name="$(get_git_branch_tag_name)"
echo "info: setting the git branch/tag name to $git_branch_tag_name"

git_commit_sha="$(get_git_sha)"
echo "info: setting the git commit sha to $git_commit_sha"

docker_artifact_version="$(get_docker_tag)"
echo "info: setting the docker artifact version to $docker_artifact_version"

generic_artifact_version="$(get_generic_artifacts_version)"
echo "info: setting the generic artifact version to $docker_artifact_version"

version_json_filename="$source_path/app/version/version.json"
echo "info: setting the version json filename to $version_json_filename"

#############################
# The pipeline starts here
#############################

echo "info: building and uploading backend:$docker_artifact_version artifacts to $region/$project_id from $source_path"

# Export the API Gateway Configuration
poetry run -C "$source_path"  python3 "$source_path/scripts/export_api_gateway_config/export_config.py" || exit 1

# Make a backup of the version json file name and restore it when the script exits
cp "$version_json_filename" "$version_json_filename.bak"

# shellcheck disable=SC2064
trap "echo info: cleaning up; mv \"$version_json_filename.bak\" \"$version_json_filename\"" EXIT

# Write the version info
write_version_json "$version_json_filename" "$git_branch_tag_name" "$git_commit_sha" "$build_run"

# Ensure gcloud is authenticated
authenticate_gcloud

# Build and upload the backend artifacts
build_and_upload_be_docker_img "$region" "$project_id" "$docker_artifact_version" "$source_path"

# Upload backend config
upload_file "$region" "$project_id" "$generic_artifact_version" "$source_path/scripts/export_api_gateway_config/_tmp" "$api_gateway_config_file_name"

# Report the summary
save_report "$report_filename" "$generic_artifact_version" "$docker_artifact_version" "$version_json_filename"
