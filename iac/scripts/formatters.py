#!/usr/bin/env python3

import re
import string
import hashlib
import argparse
from typing import Optional


def hash_string(input_string: str) -> str:
    """
    Generate a unique hash of a given string using MD5, convert it to a base with the given allowed characters.

    :param input_string: The input string to be hashed.
    :return: A truncated, unique hash representation of the input string.
    """
    allowed_chars = string.ascii_lowercase + string.digits  # base36 chars

    # Step 1: Compute the MD5 hash of the input string
    md5_hash = hashlib.md5(input_string.encode()).hexdigest()  # Generates a 32-character hexadecimal MD5 hash
    # Step 2: Convert the hexadecimal hash into an integer
    hash_int = int(md5_hash, 16)  # Converts the hex (16) string to an integer

    # Step 3: Convert the integer to a custom base using allowed characters.
    base = len(allowed_chars)  # Determine the base from the length of allowed characters

    # Step 4: Convert the integer into the base36 representation to shorten the hash length to 25 chars
    result = []
    while hash_int > 0:
        hash_int, remainder = divmod(hash_int, base)  # Get quotient and remainder
        result.append(allowed_chars[remainder])  # Map remainder to allowed character

    # Step 5: Reverse the result since it was built in reverse order.
    return ''.join(result[::-1])


def construct_artifacts_version(*, git_branch_name: str, git_sha: str) -> str:
    """
    Format the string to follow the artifact version naming conventions.

        a) it must start and end with a letter or number,
        b) can only contain lowercase letters, numbers, hyphens and periods, i.e. [a-z0-9-.] and
        c) cannot exceed a total of 128 characters.

        @ref: https://cloud.google.com/artifact-registry/docs/reference/rest/v1/projects.locations.repositories.genericArtifacts/upload
    """
    if len(git_sha) > 40:
        raise ValueError("The length of the git sha must be less than 40 chars")

    hashed_input_string = hash_string("".join([git_branch_name, git_sha]))

    # Convert to lowercase for generic artifact version naming.
    valid_branch_name = git_branch_name.lower()

    # Replace invalid characters with hyphen
    valid_branch_name = re.sub(r"[^a-z0-9-.]", "-", valid_branch_name)

    # Ensure it starts and ends with a letter or number
    valid_branch_name = re.sub(r"(^[^a-z0-9]+)|([^a-z0-9]+$)", "", valid_branch_name)

    # assuming the length of the git sha is not greater than 40.
    # the max branch name length should be 128 -- len(hashed_input_string) -- 2 (separators) - len(git_sha).
    branch_name_max_length = 128 - len(hashed_input_string) - 2 - len(git_sha)

    trimmed_valid_branch_name = valid_branch_name[:branch_name_max_length]

    return ".".join([trimmed_valid_branch_name, git_sha.lower(), hashed_input_string])


def construct_docker_tag(*, git_branch_name: str, git_sha: str) -> str:
    """
    Format the string to follow the docker tag naming conventions.

        a) The tag must be valid ASCII
        b) can contain lowercase and uppercase letters, digits, underscores, periods, and hyphens.
        c) It can't start with a period or hyphen
        d) it must be no longer than 128 characters.

        @ref: https://docs.docker.com/reference/cli/docker/image/tag/
    """
    if len(git_sha) > 40:
        raise ValueError("The length of the git sha must be less than 40 chars")

    hashed_input_string = hash_string("".join([git_branch_name, git_sha]))

    # replace invalid characters with hyphen
    valid_branch_name = re.sub(r"[^a-zA-Z0-9_.-]", "-", git_branch_name)

    # Ensure it doesn't start with a period or hyphen
    valid_branch_name = re.sub(r"^[.-]+", "", valid_branch_name)

    # assuming the length of the git sha is not greater than 40.
    # the max branch name length should be 128 -- len(hashed_input_string) -- 2 (separators) - len(git_sha).
    branch_name_length = 128 - len(hashed_input_string) - 2 - len(git_sha)

    trimmed_valid_branch_name = valid_branch_name[:branch_name_length]

    return ".".join([trimmed_valid_branch_name, git_sha, hashed_input_string])


def construct_secret_id(*, git_branch_name: str, prefix: str, git_sha: Optional[str] = None) -> str:
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
    # if the branch name is main, and no git sha was provided, return <prefix>-<main>
    if git_branch_name == "main" and not git_sha:
        return "-".join([prefix, git_branch_name])

    # replace everything in the branch name that is not there.
    valid_branch_name = re.sub(r"[^a-zA-Z0-9_-]", "-", git_branch_name)

    if git_sha is None:
        hashed_input_string = hash_string(git_branch_name)

        # assuming the length of the git sha is not greater than 40.
        # the max branch length should be 128 -- len(hashed_input_string) -- 2 (separators) - len(git_sha) - len(prefix)
        branch_name_length = 255 - len(hashed_input_string) - 2 - len(prefix)
        trimmed_valid_branch_name = valid_branch_name[:branch_name_length]

        return "-".join([prefix, trimmed_valid_branch_name, hashed_input_string])
    else:
        if len(git_sha) > 40:
            raise ValueError("The length of the git sha must be less than 40 chars")

        hashed_input_string = hash_string("".join([git_branch_name, git_sha]))
        # assuming the length of the git sha is not greater than 40.
        # the max branch length should be 128 -- len(hashed_input_string) -- 3 (separators) - len(git_sha) - len(prefix)
        branch_name_length = 255 - len(hashed_input_string) - 3 - len(git_sha) - len(prefix)
        trimmed_valid_branch_name = valid_branch_name[:branch_name_length]

        return "-".join([prefix, trimmed_valid_branch_name, git_sha, hashed_input_string])


if __name__ == "__main__":
    # This part of the code is to be used by the build-and-upload-(be|fe).sh scripts
    # Because it is the only way of re-using this function on both python and bash scripts you need to run it and
    # parse the arguments.

    parser = argparse.ArgumentParser(description="Parse Git branch Name")
    parser.add_argument("--branch-name", type=str, help="Branch name", required=True)
    parser.add_argument("--git-sha", type=str, help="Git commit sha", required=True)
    parser.add_argument(
        "--version",
        type=str,
        help="Module",
        choices=["generic-artifacts", "docker-tag", "secret-id"],
        required=True)

    args = parser.parse_args()

    # add the required module in the stdout so that the script can access it.
    if args.version == "generic-artifacts":
        print(construct_artifacts_version(git_branch_name=args.branch_name, git_sha=args.git_sha))
    elif args.version == "docker-tag":
        print(construct_docker_tag(git_branch_name=args.branch_name, git_sha=args.git_sha))
    elif args.version == "secret-id":
        print(construct_secret_id(git_branch_name=args.branch_name, prefix="tabiya-tech"))
