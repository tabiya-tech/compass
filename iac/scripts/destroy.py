#!/usr/bin/env python3

import os

import argparse
import sys

# Determine the absolute path to the 'iac' directory
iac_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, iac_dir)

from _types import IaCModules
from lib import get_stack_name_from
from _common import add_select_environment_arguments, run_pulumi_destroy


def destroy_stack(stack_name: str):
    """
    Destroy the stack:

    :param stack_name:
    :return:
    """

    print(f"Destroying stack: {stack_name}")
    # Destroy the stacks in the reverse order of their dependencies.
    run_pulumi_destroy(stack_name=stack_name, module=IaCModules.COMMON)
    run_pulumi_destroy(stack_name=stack_name, module=IaCModules.FRONTEND)
    run_pulumi_destroy(stack_name=stack_name, module=IaCModules.BACKEND)
    run_pulumi_destroy(stack_name=stack_name, module=IaCModules.AUTH)
    run_pulumi_destroy(stack_name=stack_name, module=IaCModules.DNS)
    run_pulumi_destroy(stack_name=stack_name, module=IaCModules.ENVIRONMENT)

    print(f"Done destroying stack: {stack_name}")


def _main(*, realm_name: str, env_name: str):
    # 1. Get the stack name from the realm name and environment name.
    stack_name = get_stack_name_from(realm_name, env_name)

    # 2.  Destroy the stack.
    destroy_stack(stack_name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Destroy the given environment by running pulumi destroy on all the stacks of the environment."
    )

    # add the required arguments to select the environment to set up.
    add_select_environment_arguments(parser=parser)

    args = parser.parse_args()
    _main(realm_name=args.realm_name, env_name=args.env_name)
