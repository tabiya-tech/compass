#!/usr/bin/env bash

function save_report() {
  local _report_filename=$1
  local _deployable_version=$2
  local _version_json_filename=$3

  {
    echo "### Backend artifacts packaging summary"
    echo "**Date**: \`$(date -u +%F' %T.%3N UTC')\`     "
    echo "**status**: ✅ Successfully uploaded       "
    echo "**version**: \`$_deployable_version\`    "
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
  _artifact_name="$_region-docker.pkg.dev/$_project_id/docker-repository/backend:$_artifact_version"
  echo "info: building and uploading the docker image $_artifact_name"

  # it is required to specify the platform while build the backend image.
  # This is needed to tell which platform docker should build the image to run on, other than the platform the image is being built on.
  # For now the platform running the image is cloud run, which is linux/amd64
  # @ref: https://cloud.google.com/run/docs/container-contract
  echo "info: building and push the docker image for linux"
  docker build --platform linux/amd64 -t "$_artifact_name" "$_source_path" --push
  if [ $? -ne 0 ]; then
    echo "error: failed to build and push the backend docker image"
    exit 1
  fi
}

function upload_backend_config(){
  local _region=$1
  local _project_id=$2
  local _artifact_version=$3
  local _source_path=$4
  local _api_config_file_name=$5

  # First delete the existing version if it exists
  echo "info: deleting the existing backend-config:$_artifact_version version"
  gcloud artifacts versions delete "$_artifact_version" \
        --package=backend-config \
        --repository=generic-repository \
        --location="$_region" \
        --project="$_project_id" \
        --quiet

  # Then upload the backend config
  echo "info: uploading backend config"
  gcloud artifacts generic upload --package=backend-config \
      --repository=generic-repository \
      --location="$_region" \
      --source="$_source_path/scripts/export_api_gateway_config/_tmp/$_api_config_file_name" \
      --project="$_project_id" \
      --version="$_artifact_version"

  if [ $? -ne 0 ]; then
    echo "error: failed to upload backend configurations"
    exit 1
  fi
}

function check_args() {
  if [ "$#" -ne 5 ]; then
    echo "Usage: $0 <region> <project_id> <source_path> <report_filename> <build_run>"
    cat << EOF
  Build and Upload the backend artifacts,

  Requirements:
    - you are running the script in an already activated backend virtual environment.
    - Poetry and backend dependencies are already installed (because as part of building backend the script depends on it)

  Arguments:
    region: The region where the artifacts will be uploaded
    project_id: The project id where the artifacts will be uploaded.
                Typically it is the root project id.
    source_path: The path to the backend module from the place you are running the script.
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

source_path=$3
echo "info: setting the source path to $source_path"
if [ ! -d "$source_path" ]; then
  echo "Error: backend module path ($source_path) does not exist."
  exit 1
fi

report_filename=$4
echo "info: setting the report filename to $report_filename"

build_run=$5
echo "info: setting the build run to $build_run"

# @IMPORTANT: The filename of the api gateway config file name, must match the value used in backend/scripts/convert_to_openapi2.py:GCP_API_GATEWAY_CONFIG_FILE
api_gateway_config_file_name="api_gateway_config.yaml"
echo "info: setting the api gateway config file name to $api_gateway_config_file_name"

# get the tag name or branch name
git_branch_tag_name=$(git describe --exact-match --tags HEAD 2>/dev/null || git rev-parse --abbrev-ref HEAD)
echo "info: setting the branch/tag name to $git_branch_tag_name"

# parse the git branch name to filter out the invalid characters.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" # The directory where the script is located.
echo "info: setting the script directory to $script_dir"

formatted_git_branch_tag_name=$("$script_dir/parse_git_branch_name.py" --branch-name="$git_branch_tag_name" --module=be)
echo "info: setting the formatted branch/tag name to $formatted_git_branch_tag_name"

git_commit_sha=$(git rev-parse HEAD)
echo "info: setting the git commit sha to $git_commit_sha"

artifact_version="$formatted_git_branch_tag_name.$git_commit_sha"
echo "info: setting the artifact version to $artifact_version"

version_json_filename="$source_path/app/version/version.json"
echo "info: setting the version json filename to $version_json_filename"



#############################
# The pipeline starts here
#############################

echo "info: building and uploading backend:$artifact_version artifacts to $region/$project_id from $source_path"

# 1. Export the API Gateway Configuration
poetry run -C ./"$source_path"  python3 "./$source_path/scripts/export_api_gateway_config/export_config.py" || exit 1

# 2. Have a backup of the version json file name.
cp "$version_json_filename" "$version_json_filename.bak"
trap "echo info: cleaning up; mv \"$version_json_filename.bak\" \"$version_json_filename\"" EXIT

# 3. Write the version info
write_version_json "$version_json_filename" "$git_branch_tag_name" "$git_commit_sha" "$build_run"

# 4. Build and upload the backend artifacts
build_and_upload_be_docker_img "$region" "$project_id" "$artifact_version" "$source_path"

# 5. Upload backend config
upload_backend_config "$region" "$project_id" "$artifact_version" "$source_path" "$api_gateway_config_file_name"

# 6. Report the summary
save_report "$report_filename" "$artifact_version" "$version_json_filename"

# 7. Restore the version json file
#mv "$version_json_filename.bak" "$version_json_filename"
