#!/usr/bin/env python3

import os

import argparse
import sys

# Determine the absolute path to the 'iac' directory
iac_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/scripts directory.
sys.path.insert(0, iac_dir)

from lib import get_stack_name_from
from _common import add_select_environment_arguments, run_pulumi_destroy


def destroy_stack(stack_name: str):
    """
    Destroy the stack:

    :param stack_name:
    :return:
    """

    print(f"Destroying stack: {stack_name}")

    run_pulumi_destroy(stack_name=stack_name, module="aws-ns")
    run_pulumi_destroy(stack_name=stack_name, module="common")
    run_pulumi_destroy(stack_name=stack_name, module="frontend")
    run_pulumi_destroy(stack_name=stack_name, module="backend")
    run_pulumi_destroy(stack_name=stack_name, module="auth")
    run_pulumi_destroy(stack_name=stack_name, module="environment")

    print(f"Done destroying stack: {stack_name}")


def _main(args):
    stack_name = get_stack_name_from(args.realm_name, args.env_name)
    destroy_stack(stack_name)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Destroy the given environment by running pulumi destroy on all the stacks of the environment."
    )

    # add the required arguments to select the environment to set up.
    add_select_environment_arguments(parser=parser)

    _main(parser.parse_args())
