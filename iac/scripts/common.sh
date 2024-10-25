#!/usr/bin/env bash

# Global variables

# The directory where the script is located.
SCRIPT_DIR="$(realpath "$(dirname "${BASH_SOURCE[0]}")")" # The directory where the script is located.
echo "info: setting the script directory to $SCRIPT_DIR"

# Root path
ROOT_PATH="$(realpath "$SCRIPT_DIR/../../")"
echo "info: setting the root path to $ROOT_PATH"

# Global Functions
real_file_path() {
    local path="$1"

    # Remove trailing slash to ensure consistent behavior
    path="${path%/}"

    # Resolve the absolute path of the parent directory
    local abs_dir
    abs_dir=$(cd "$(dirname "$path")" 2>/dev/null && pwd -P)

    # Append the original filename to reconstruct the full absolute path
    echo "$abs_dir/$(basename "$path")"
}


function get_git_sha() {
  git rev-parse HEAD
}

function get_git_branch_tag_name() {
  git describe --exact-match --tags HEAD 2>/dev/null || git rev-parse --abbrev-ref HEAD
}

function get_docker_tag() {
  # get the tag name or branch name
  local _git_branch_tag_name
  _git_branch_tag_name="$(get_git_branch_tag_name)"

  local _git_commit_sha
  _git_commit_sha="$(get_git_sha)"

  _artifact_version="$("$SCRIPT_DIR/formatters.py" --branch-name="$_git_branch_tag_name" --git-sha="$_git_commit_sha" --version=docker-tag)"

  echo -n "$_artifact_version" # this is the return value
}

function get_generic_artifacts_version() {
  # get the tag name or branch name
  local _git_branch_tag_name
  _git_branch_tag_name="$(get_git_branch_tag_name)"

  local _git_commit_sha
  _git_commit_sha="$(get_git_sha)"

  local _artifact_version
  _artifact_version="$("${SCRIPT_DIR}/formatters.py" --branch-name="$_git_branch_tag_name" --git-sha="$_git_commit_sha" --version=generic-artifacts)"

  echo -n "$_artifact_version" # this is the return value
}

function upload_file() {
  local _region=$1
  local _project_id=$2
  local _artifact_version=$3
  local _directory_path=$4
  local _file_name=$5

  local _file_path="$_directory_path/$_file_name"

  echo "info uploading the file $_file_path"

  # Test if the files exists before deleting
  if [ -z "$(gcloud artifacts files list \
          --repository=generic-repository \
          --location="$_region" \
          --project="$_project_id" \
          --package=artifacts \
          --version="$_artifact_version" \
          --format="value(name)" \
          --filter="name:$_file_name")" ]; then
    echo "info: file does not exist, skipping deletion"
  else
    echo "info: deleting the existing file:$_artifact_version"
    gcloud artifacts files delete "artifacts:$_artifact_version:$_file_name" \
      --repository=generic-repository \
      --location="$_region" \
      --project="$_project_id" \
      --quiet
  fi

  # Then upload the file
  echo "info: uploading the file: $_file_name"

  if ! gcloud artifacts generic upload --package=artifacts \
           --repository=generic-repository \
           --location="$_region" \
           --source="$_file_path" \
           --project="$_project_id" \
           --version="$_artifact_version"; then
    echo "error: failed to upload the file"
    exit 1
  fi
}

function is_gcloud_authenticated() {
    # Checks if gcloud has an active authenticated account.
    # Returns the active account email if authentication exists, otherwise returns empty.
    local account
    account=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)
    echo "$account"
}

function authenticate_gcloud() {
    # Authenticates gcloud **only if necessary**.
    # - If already authenticated, do nothing.
    # - If GOOGLE_APPLICATION_CREDENTIALS is set, use it to authenticate.
    # - Otherwise, assume the CI/CD environment (GitHub/GitLab) has already authenticated externally.
    local auth_email
    auth_email=$(is_gcloud_authenticated)

    if [[ -n "$auth_email" ]]; then
        echo "info: gcloud is already authenticated with $auth_email"
        return 0  # Skip authentication
    fi

    echo "info: gcloud is not authenticated. Authenticating..."

    if [[ -n "$GOOGLE_APPLICATION_CREDENTIALS" ]]; then
        echo "info: Using GOOGLE_APPLICATION_CREDENTIALS: $GOOGLE_APPLICATION_CREDENTIALS"
        if gcloud auth activate-service-account --key-file="$GOOGLE_APPLICATION_CREDENTIALS"; then
            echo "info: gcloud authentication successful."
        else
            echo "error: Failed to authenticate gcloud."
            return 1
        fi
    else
        echo "warning: No GOOGLE_APPLICATION_CREDENTIALS found. Assuming external authentication is already configured."
    fi
}