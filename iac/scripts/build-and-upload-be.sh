#!/usr/bin/env bash

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <region> <project_id> <source_path>"
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
EOF
  exit 1
fi

region=$1
project_id=$2
source_path=$3

# 1. construct the deployable version.
_git_ref_name=$(git describe --exact-match --tags HEAD 2>/dev/null || git rev-parse --abbrev-ref HEAD)

# parse the git branch name to the allowed frontend version name.
_formatted_git_ref_name=$("$script_dir"/parse_git_branch_name.py --branch-name="$_git_ref_name" --module=be)
_git_commit_sha=$(git rev-parse HEAD)

# deployable_version = <git_ref_name>.<git_commit_sha>
deployable_version="$_formatted_git_ref_name.$_git_commit_sha"

if [ ! -d "$source_path" ]; then
  echo "Error: backend module path ($source_path) does not exist."
  exit 1
fi

echo "info: uploading backend:$deployable_version artifacts to $region/$project_id"

# 1. set the version info

FILENAME="$source_path/app/version/version.json"
# copy the version.json into a temporally file so that we can roll it back in the clean up process.
# otherwise when you run this script multiple times, the version.json will not be overwritten, because the version.json is already updated.

cp "$FILENAME" "$FILENAME.bak"

echo "info: setting the version info in $FILENAME"
sed -i -e "s|\###date###|$(date -u +%F' %T.%3N UTC')|g" "${FILENAME}"
sed -i -e "s|\###GITHUB_REF_NAME###|$_git_ref_name|g" "${FILENAME}"
sed -i -e "s|\###GITHUB_RUN_NUMBER###|$GITHUB_RUN_NUMBER|g" "${FILENAME}"
sed -i -e "s|\###GITHUB_SHA###|$_git_commit_sha|g" "${FILENAME}"

cat "$FILENAME"

# 2. upload backend artifacts to the docker registry
echo "info: set docker region"
gcloud auth configure-docker "$region-docker.pkg.dev"

# image label
artifact_label="$region-docker.pkg.dev/$project_id/docker-repository/backend:$deployable_version"

echo "info: building and push the docker image for linux"

# it is required to specify the platform while build the backend image.
# This is needed to tell which platform docker should build the image to run on, other than the platform the image is being built on.
# For now the platform running the image is cloud run, which is linux/amd64
# @ref: https://cloud.google.com/run/docs/container-contract
docker build --platform linux/amd64 -t "$artifact_label" "$source_path" --push

# 3. export api gateway config
poetry run -C ./"$source_path"  python3 "./$source_path/scripts/export_api_gateway_config/export_config.py" || exit

# 4. upload the backend configs
#    if the configs already exists, delete it and re-upload it.

# 4.1. api gateway config
function upload_api_gateway_config {
  gcloud artifacts generic upload --package=backend-config \
     --repository=generic-repository \
     --location="$region" \
     --source="$source_path/scripts/export_api_gateway_config/_tmp/api_gateway_config.yaml" \
     --project="$project_id" \
     --version="$deployable_version"
}

upload_api_gateway_config

# shellcheck disable=SC2181
if [ $? -ne 0 ]; then
  echo "Backend version backend:$deployable_version/api_gateway_config already exists"
  echo "Deleting the existing version"
  gcloud artifacts versions delete "$deployable_version" \
      --package=backend-config \
      --repository=generic-repository \
      --location="$region" \
      --project="$project_id" \
      --quiet

  echo "Re-uploading the backend api config"
  upload_api_gateway_config
fi


{
  echo "## Backend artifacts preparation summary"
  echo "**status**: ✅ Successfully uploaded"
  echo "**version**: \`$deployable_version\`"
  echo "**version.json**: "
  echo  "\`\`\`json"
  cat "$FILENAME"
  echo  "\`\`\`"
} >> "$GITHUB_STEP_SUMMARY"

# cleanup
# restore the version.json
cp "$FILENAME.bak" "$FILENAME"
