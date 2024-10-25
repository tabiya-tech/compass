#!/usr/bin/env bash

# @important: this constant should match iac/frontend/prepare_frontend.py:FRONTEND_BUILD_NAME
FRONTEND_BUILD_NAME="build.tar.gz"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <region> <project_id> <source_path>"
  cat << EOF
Build and Upload the frontend artifacts,

Requirements:
  - in the frontend module yarn install is already run.
Arguments:
  region: The region where the artifacts will be uploaded
  project_id: The project id where the artifacts will be uploaded.
              Typically it is the root project id.
  source_path: The path to the frontend module from the place you are running the script.
EOF
  exit 1
fi

region=$1
project_id=$2
source_path=$3

# 1. construct the deployable version.
_git_ref_name=$(git describe --exact-match --tags HEAD 2>/dev/null || git rev-parse --abbrev-ref HEAD)

# parse the git branch name to the allowed docker tag name.
_formatted_git_ref_name=$("$script_dir"/parse_git_branch_name.py --branch-name="$_git_ref_name" --module=fe)
_git_commit_sha=$(git rev-parse HEAD)

# deployable_version = <git_ref_name>.<git_commit_sha>
deployable_version="$_formatted_git_ref_name.$_git_commit_sha"

echo "info: building and uploading frontend:$deployable_version artifacts to $region/$project_id from $source_path"

if [ ! -d "$source_path" ]; then
  echo "Error: frontend module path ($source_path) does not exist."
  exit 1
fi

#1 yarn build in the source file.

yarn --cwd "$source_path" run build || exit 1

##2 Set the version info

FILENAME="$source_path/build/data/version.json"
echo "info: setting the version info in $FILENAME"
sed -i -e "s|\###date###|$(date -u +%F' %T.%3N UTC')|g" "${FILENAME}"
sed -i -e "s|\###GITHUB_REF_NAME###|$_git_ref_name|g" "${FILENAME}"
sed -i -e "s|\###GITHUB_RUN_NUMBER###|$GITHUB_RUN_NUMBER|g" "${FILENAME}"
sed -i -e "s|\###GITHUB_SHA###|$_git_commit_sha|g" "${FILENAME}"
cat "$FILENAME"

# 3. upload frontend artifacts
#    if the configs already exists, delete it and re-upload it.

echo "info: compressing frontend artifacts"
tar -czf ./$FRONTEND_BUILD_NAME -C "$source_path"/build . || exit 1

echo "info: uploading frontend -C frontend artifacts"
function upload_frontend_artifacts {
  # re usable function to upload frontend artifacts
  gcloud artifacts generic upload --package=frontend \
    --repository=generic-repository \
    --location="$region" \
    --source=./$FRONTEND_BUILD_NAME \
    --project="$project_id" \
    --version="$deployable_version"
}

upload_frontend_artifacts

# shellcheck disable=SC2181
if [ $? -ne 0 ]; then
  echo "Frontend version frontend:$deployable_version already exists"
  echo "Deleting the existing version"
  gcloud artifacts versions delete "$deployable_version" \
      --package=frontend \
      --repository=generic-repository \
      --location="$region" \
      --project="$project_id" \
      --quiet

  echo "Re-uploading the frontend artifacts"
  upload_frontend_artifacts
fi

# cleanup
echo "info: removing compressed frontend artifacts"
rm ./$FRONTEND_BUILD_NAME
echo "info: frontend:$deployable_version artifacts uploaded successfully"


{
  echo "## Frontend artifacts preparation summary"
  echo "**status**: ✅ Successfully uploaded"
  echo "**version**: \`$deployable_version\`"
  echo "**version.json**: "
  echo  "\`\`\`json"
  cat "$FILENAME"
  echo  "\`\`\`"
} >> "$GITHUB_STEP_SUMMARY"
