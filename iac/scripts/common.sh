
# Global variables

# The directory where the script is located.
SCRIPT_DIR="$(realpath "$(dirname "${BASH_SOURCE[0]}")")" # The directory where the script is located.
echo "info: setting the script directory to $SCRIPT_DIR"

# Root path
ROOT_PATH="$(realpath "$SCRIPT_DIR/../../")"
echo "info: setting the root path to $ROOT_PATH"

# Global Functions
function get_git_sha() {
  git rev-parse HEAD
}

function get_git_branch_tag_name() {
  git describe --exact-match --tags HEAD 2>/dev/null || git rev-parse --abbrev-ref HEAD
}

function filter_invalid_chars_for_artifact_version {
  local _text=$1
  "${SCRIPT_DIR}/parse_git_branch_name.py" --branch-name="$_text" --version=generic-artifacts
}

function filter_invalid_chars_for_docker_tag {
  local _text=$1
  "$SCRIPT_DIR/parse_git_branch_name.py" --branch-name="$_text" --version=docker-tag
}

function get_docker_tag {
  # get the tag name or branch name
  git_branch_tag_name=$(get_git_branch_tag_name)
  echo "info: setting the branch/tag name to $git_branch_tag_name" > /dev/tty
  formatted_git_branch_tag_name=$(filter_invalid_chars_for_docker_tag "$git_branch_tag_name")
  echo "info: setting the formatted branch/tag name to $formatted_git_branch_tag_name for docker tag" > /dev/tty
  git_commit_sha=$(get_git_sha)
  echo "info: setting the git commit sha to $git_commit_sha" > /dev/tty
  echo -n "$formatted_git_branch_tag_name.$git_commit_sha" # this is the return value
}

function get_generic_artifacts_version {
  # get the tag name or branch name
    git_branch_tag_name=$(get_git_branch_tag_name)
    echo "info: setting the branch/tag name to $git_branch_tag_name" > /dev/tty
    formatted_git_branch_tag_name=$(filter_invalid_chars_for_artifact_version "$git_branch_tag_name")
    echo "info: setting the formatted branch/tag name to $formatted_git_branch_tag_name for generic artifact version" > /dev/tty
    git_commit_sha=$(get_git_sha)
    echo "info: setting the git commit sha to $git_commit_sha" > /dev/tty
    echo -n "$formatted_git_branch_tag_name.$git_commit_sha" # this is the return value
}

function upload_file {
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