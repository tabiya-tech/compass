#!/usr/bin/env python3

import re
import argparse


def parse_git_branch_name(branch_name: str) -> tuple[str, str]:
    """
    Process the branch name to return a perfect name that meets the artifact repositories requirements.

    1. Frontend name (generic repository version name).
        a) it must start and end with a letter or number,
        b) can only contain lowercase letters, numbers, hyphens and periods, i.e. [a-z0-9-.] and
        c) cannot exceed a total of 128 characters.

        @ref: https://cloud.google.com/artifact-registry/docs/reference/rest/v1/projects.locations.repositories.genericArtifacts/upload

    2. Backend image name (docker repository tag name).
        a) The tag must be valid ASCII
        b) can contain lowercase and uppercase letters, digits, underscores, periods, and hyphens.
        c) It can't start with a period or hyphen
        d) it must be no longer than 128 characters.

        @ref: https://docs.docker.com/reference/cli/docker/image/tag/

    :param branch_name: The branch name to parse
    :return: the frontend version and backend version.
    """

    # 1. Process the frontend version
    # Convert to lowercase for frontend naming.
    _frontend_version = branch_name.lower()
    # Replace invalid characters with hyphen
    _frontend_version = re.sub(r"[^a-z0-9-.]", "-", _frontend_version)
    # Ensure it starts and ends with a letter or number
    _frontend_version = re.sub(r"(^[^a-z0-9]+)|([^a-z0-9]+$)", "", _frontend_version)
    # Trim to 128 characters
    _frontend_version = _frontend_version[:128]

    # 2. Process backend version
    # replace invalid characters with hyphen
    _backend_version = re.sub(r"[^a-zA-Z0-9_.-]", "-", branch_name)
    # Ensure it doesn't start with a period or hyphen
    _backend_version = re.sub(r"^[.-]+", "", _backend_version)
    # Trim to 128 characters
    _backend_version = _backend_version[:128]

    return _frontend_version, _backend_version


if __name__ == "__main__":
    # This part of the code is to be used by the build-and-upload-(be|fe).sh scripts
    # Because it is the only way of re-using this function on both python and bash scripts you need to run it and
    # parse the arguments.

    parser = argparse.ArgumentParser(description="Parse Git branch Name")
    parser.add_argument("--branch-name", type=str, help="Branch name", required=True)
    parser.add_argument("--module", type=str, help="Module", choices=["be", "fe"], required=True)
    args = parser.parse_args()
    frontend_version, backend_version = parse_git_branch_name(args.branch_name)

    # add the required module in the stdout so that the script can access it.
    if args.module == "fe":
        print(frontend_version)
    else:
        print(backend_version)
