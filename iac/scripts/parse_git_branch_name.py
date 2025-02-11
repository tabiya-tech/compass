#!/usr/bin/env python3

import re
import argparse


def parse_git_branch_name(branch_name: str) -> tuple[str, str, str]:
    """
    Process the branch name to return a perfect name that meets the artifact repositories requirements.

    1. Generic artifact version
        a) it must start and end with a letter or number,
        b) can only contain lowercase letters, numbers, hyphens and periods, i.e. [a-z0-9-.] and
        c) cannot exceed a total of 128 characters.

        @ref: https://cloud.google.com/artifact-registry/docs/reference/rest/v1/projects.locations.repositories.genericArtifacts/upload

    2. Docker tag name
        a) The tag must be valid ASCII
        b) can contain lowercase and uppercase letters, digits, underscores, periods, and hyphens.
        c) It can't start with a period or hyphen
        d) it must be no longer than 128 characters.

        @ref: https://docs.docker.com/reference/cli/docker/image/tag/

    3. Secret version id
        a) it must be a valid ASCII string that contains only
        a) Upper case and lower case letters.
        b) Numerals,
        c) hyphen (-) and underscore (_).
        d) It must be no longer than 255 characters.

        @ref: https://cloud.google.com/secret-manager/docs/reference/rest/v1/projects.secrets/create

    :param branch_name: The branch name to parse
    :return: the generic artifact version, Docker tag name, secret id version.
    """

    # 1. Process the generic artifact version
    # Convert to lowercase for generic artifact version naming.
    _generic_artifact_version = branch_name.lower()
    # Replace invalid characters with hyphen
    _generic_artifact_version = re.sub(r"[^a-z0-9-.]", "-", _generic_artifact_version)
    # Ensure it starts and ends with a letter or number
    _generic_artifact_version = re.sub(r"(^[^a-z0-9]+)|([^a-z0-9]+$)", "", _generic_artifact_version)
    # Trim to 128 characters
    _generic_artifact_version = _generic_artifact_version[:128]

    # 2. Process docker tag version
    # replace invalid characters with hyphen
    _docker_tag_version = re.sub(r"[^a-zA-Z0-9_.-]", "-", branch_name)
    # Ensure it doesn't start with a period or hyphen
    _docker_tag_version = re.sub(r"^[.-]+", "", _docker_tag_version)
    # Trim to 128 characters
    _docker_tag_version = _docker_tag_version[:128]

    # 3. Process the secret id
    # replace invalid characters with an underscore.
    _secret_id_version = re.sub(r"[^a-zA-Z0-9_-]", "_", branch_name)
    # Trim to 255 characters
    _secret_id_version = _secret_id_version[:255]

    return _generic_artifact_version, _docker_tag_version, _secret_id_version


if __name__ == "__main__":
    # This part of the code is to be used by the build-and-upload-(be|fe).sh scripts
    # Because it is the only way of re-using this function on both python and bash scripts you need to run it and
    # parse the arguments.

    parser = argparse.ArgumentParser(description="Parse Git branch Name")
    parser.add_argument("--branch-name", type=str, help="Branch name", required=True)
    parser.add_argument(
        "--version",
        type=str,
        help="Module",
        choices=["generic-artifacts", "docker-tag", "secret-id"],
        required=True)

    args = parser.parse_args()
    generic_artifact_version, docker_tag_version, secret_id_version = parse_git_branch_name(args.branch_name)

    # add the required module in the stdout so that the script can access it.
    if args.version == "generic-artifacts":
        print(generic_artifact_version)
    elif args.version == "docker-tag":
        print(docker_tag_version)
    elif args.version == "secret-id":
        print(secret_id_version)
