#!/usr/bin/env python3

import re
import argparse


def filter_invalid_chars_for_artifact_version(input_string: str) -> str:
    """
    Format the string to follow the artifact version naming conventions.

        a) it must start and end with a letter or number,
        b) can only contain lowercase letters, numbers, hyphens and periods, i.e. [a-z0-9-.] and
        c) cannot exceed a total of 128 characters.

        @ref: https://cloud.google.com/artifact-registry/docs/reference/rest/v1/projects.locations.repositories.genericArtifacts/upload
    """

    # Convert to lowercase for generic artifact version naming.
    valid_string = input_string.lower()

    # Replace invalid characters with hyphen
    valid_string = re.sub(r"[^a-z0-9-.]", "-", valid_string)

    # Ensure it starts and ends with a letter or number
    valid_string = re.sub(r"(^[^a-z0-9]+)|([^a-z0-9]+$)", "", valid_string)

    # Trim to 128 characters starting from the end
    valid_string = valid_string[-128:]
    return valid_string


def filter_invalid_chars_for_docker_tag(input_string: str) -> str:
    """
    Format the string to follow the docker tag naming conventions.

        a) The tag must be valid ASCII
        b) can contain lowercase and uppercase letters, digits, underscores, periods, and hyphens.
        c) It can't start with a period or hyphen
        d) it must be no longer than 128 characters.

        @ref: https://docs.docker.com/reference/cli/docker/image/tag/
    """

    # replace invalid characters with hyphen
    valid_string = re.sub(r"[^a-zA-Z0-9_.-]", "-", input_string)

    # Ensure it doesn't start with a period or hyphen
    valid_string = re.sub(r"^[.-]+", "", valid_string)

    # Trim to 128 characters starting from the end
    valid_string = valid_string[-128:]

    return valid_string


def filter_invalid_chars_for_secret_id(input_string: str) -> str:
    """
    Format the string to follow secret id naming conventions.

    3. Secret version id
        a) it must be a valid ASCII string that contains only
        a) Upper case and lower case letters.
        b) Numerals,
        c) hyphen (-) and underscore (_).
        d) It must be no longer than 255 characters.

        @ref: https://cloud.google.com/secret-manager/docs/reference/rest/v1/projects.secrets/create

    """

    # replace invalid characters with an underscore.
    valid_string = re.sub(r"[^a-zA-Z0-9_-]", "_", input_string)

    # Trim to 255 characters starting from the end
    valid_string = valid_string[-255:]

    return valid_string


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

    # add the required module in the stdout so that the script can access it.
    if args.version == "generic-artifacts":
        print(filter_invalid_chars_for_artifact_version(args.branch_name))
    elif args.version == "docker-tag":
        print(filter_invalid_chars_for_docker_tag(args.branch_name))
    elif args.version == "secret-id":
        print(filter_invalid_chars_for_secret_id(args.branch_name))
