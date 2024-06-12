import os
import sys

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/common directory
sys.path.insert(0, libs_dir)

import pulumi
from deploy_aws_ns import deploy_aws_ns
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def main():
    domain_name = os.getenv("DOMAIN_NAME")
    pulumi.info(f"Using Domain: {domain_name}")
    if not domain_name:
        pulumi.error("environment variable DOMAIN_NAME is not set")
        sys.exit(1)
    environment = pulumi.get_stack()
    pulumi.info(f"Using Environment: {environment}")

    # Deploy the aws ns
    deploy_aws_ns(domain_name, environment)


if __name__ == "__main__":
    main()
