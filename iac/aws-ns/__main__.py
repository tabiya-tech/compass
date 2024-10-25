import os
import sys

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/aws-ns directory
sys.path.insert(0, libs_dir)

import pulumi
from deploy_aws_ns import deploy_aws_ns
from dotenv import load_dotenv

from lib.std_pulumi import getenv

# Load environment variables from .env file
load_dotenv()


def main():
    environment = pulumi.get_stack()
    pulumi.info(f"Using Environment: {environment}")

    # Get the domain name
    domain_name = getenv("DOMAIN_NAME")
    pulumi.info(f"Using Domain: {domain_name}")

    # Deploy the aws ns
    deploy_aws_ns(domain_name, environment)


if __name__ == "__main__":
    main()
