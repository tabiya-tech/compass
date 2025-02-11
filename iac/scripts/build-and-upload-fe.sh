#!/usr/bin/env bash

function write_version_json() {
  local _version_json_filename=$1
  local _git_branch_tag_name=$2
  local _git_commit_sha=$3
  local _build_run=$4

  echo "info: setting the version info in $_version_json_filename"
  sed -i -e "s|\###date###|$(date -u +%F' %T.%3N UTC')|g" "${_version_json_filename}"
  sed -i -e "s|\###GITHUB_REF_NAME###|$_git_branch_tag_name|g" "${_version_json_filename}"
  sed -i -e "s|\###GITHUB_RUN_NUMBER###|$_build_run|g" "${_version_json_filename}"
  sed -i -e "s|\###GITHUB_SHA###|$_git_commit_sha|g" "${_version_json_filename}"
  cat "$_version_json_filename"
}

function save_report() {
  local _report_filename=$1
  local _deployable_version=$2
  local _version_json_filename=$3

  {
    echo "### Frontend artifacts packaging summary"
    echo "**Date**: \`$(date -u +%F' %T.%3N UTC')\`     "
    echo "**Status**: ✅ Successfully uploaded       "
    echo "**Version**: \`$_deployable_version\`    "
    echo "**version.json**:     "
    echo  "\`\`\`json"
    cat "$_version_json_filename"
    echo  "\`\`\`"
    echo "-------"
  } >> "$_report_filename"
}

function upload_frontend_artifacts {
  local _region=$1
  local _project_id=$2
  local _frontend_build_artifact_filename=$3
  local _artifact_version=$4

  # First delete the existing version if it exists
  echo "info: deleting the existing frontend:$_artifact_version version"
  gcloud artifacts versions delete "$_artifact_version" \
    --package=frontend \
    --repository=generic-repository \
    --location="$region" \
    --project="$project_id" \
    --quiet

  # Then upload the frontend artifacts
  echo "info: uploading frontend artifacts"

  if ! gcloud artifacts generic upload --package=frontend \
           --repository=generic-repository \
           --location="$_region" \
           --source=./"$_frontend_build_artifact_filename" \
           --project="$_project_id" \
           --version="$_artifact_version"; then
    echo "error: failed to upload frontend artifacts"
    exit 1
  fi
}

function check_args() {
  if [ "$#" -ne 5 ]; then
    echo "Usage: $0 <region> <project_id> <source_path> <report_filename> <build_run>"
    cat << EOF
  Build and Upload the frontend artifacts,

  Requirements:
    - in the frontend module yarn install is already run.
  Arguments:
    region: The region where the artifacts will be uploaded
    project_id: The project id where the artifacts will be uploaded.
                Typically it is the root project id.
    source_path: The path to the frontend module source code either relative or absolute path.
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
  echo "Error: frontend module path ($source_path) does not exist."
  exit 1
fi

report_filename=$4
echo "info: setting the report filename to $report_filename"

build_run=$5
echo "info: setting the build run to $build_run"

# @IMPORTANT: The filename of the build artifact must match the value used in iac/frontend/prepare_frontend.py:FRONTEND_BUILD_NAME
frontend_build_artifact_filename="build.tar.gz"
echo "info: setting the frontend build artifact filename to $frontend_build_artifact_filename"

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

version_json_filename="$source_path/build/data/version.json"
echo "info: setting the version json filename to $version_json_filename"


#############################
# The pipeline starts here
#############################

echo "info: building and uploading frontend:$artifact_version artifacts to $region/$project_id from $source_path"

# 1. Build the frontend artifacts
echo "info: building frontend artifacts"
yarn --cwd "$source_path" run build || exit 1

if [ -n "$SENTRY_AUTH_TOKEN" ]; then
  echo "info: uploading sourcemaps to sentry"
  yarn --cwd "$source_path" run sentry:sourcemaps || exit 1
else
  echo "warning: SENTRY_AUTH_TOKEN is not set, skipping uploading sourcemaps to sentry"
fi

# 2. Write the version info
write_version_json "$version_json_filename" "$git_branch_tag_name" "$git_commit_sha" "$build_run"

# 3. Compress the frontend artifacts
echo "info: compressing frontend artifacts"
tar -czf "./$frontend_build_artifact_filename" -C "$source_path"/build . || exit 1

# shellcheck disable=SC2064
trap "echo info: cleaning up; rm \"./$frontend_build_artifact_filename\"" EXIT

# 4. Upload the frontend artifacts
upload_frontend_artifacts "$region" "$project_id" "$frontend_build_artifact_filename" "$artifact_version"

# 5. Report the summary
save_report "$report_filename" "$artifact_version" "$version_json_filename"
