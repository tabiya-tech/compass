import os
import sys
from urllib.parse import urlparse

# Determine the absolute path to the 'iac' directory
libs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Add this directory to sys.path,
# so that we can import the iac/lib module when we run pulumi from withing the iac/common directory
sys.path.insert(0, libs_dir)

import pulumi
from deploy_common import deploy_common
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def main():
    # Get the config values
    config = pulumi.Config("gcp")
    project = config.require("project")
    pulumi.info(f'Using project:{project}')
    location = config.require("region")
    pulumi.info(f'Using location:{location}')
    environment = pulumi.get_stack()
    pulumi.info(f"Using Environment: {environment}")
    domain_name = os.getenv("DOMAIN_NAME")
    pulumi.info(f"Using Domain: {domain_name}")
    if not domain_name:
        pulumi.error("environment variable DOMAIN_NAME is not set")
        sys.exit(1)

    frontend_domain = os.getenv("FRONTEND_DOMAIN")
    if not frontend_domain:
        pulumi.error("environment variable FRONTEND_DOMAIN is not set")
        sys.exit(1)
    pulumi.info(f"Frontend Domain: {frontend_domain}")

    if frontend_domain != domain_name and not frontend_domain.endswith("." + domain_name):
        pulumi.error(f"Frontend domain {frontend_domain} is not conforming to the given domain {domain_name}")
        sys.exit(1)

    frontend_url = os.getenv("FRONTEND_URL")
    if not frontend_url:
        pulumi.error("environment variable FRONTEND_URL is not set")
        sys.exit(1)
    pulumi.info(f"Frontend URL: {frontend_url}")

    frontend_parsed_url = urlparse(frontend_url)
    if frontend_parsed_url.hostname != frontend_domain:
        pulumi.error(f"Frontend URL domain {frontend_url} does not match the given domain {frontend_domain}")
        sys.exit(1)

    backend_domain = os.getenv("BACKEND_DOMAIN")
    if not backend_domain:
        pulumi.error("environment variable BACKEND_DOMAIN is not set")
        sys.exit(1)
    pulumi.info(f"Backend Domain: {backend_domain}")

    if backend_domain != frontend_domain:
        pulumi.error(f"Backend domain {backend_domain} is not equal to the frontend domain {frontend_domain}")
        sys.exit(1)

    backend_url = os.getenv("BACKEND_URL")
    if not backend_url:
        pulumi.error("environment variable BACKEND_URL is not set")
        sys.exit(1)
    if backend_url == frontend_url:
        pulumi.error("environment variable BACKEND_URL should not be equal to FRONTEND_URL")
        sys.exit(1)
    pulumi.info(f"Backend URL: {backend_url}")

    backend_parsed_url = urlparse(backend_url)
    if backend_parsed_url.hostname != backend_domain:
        pulumi.error(f"Backend URL domain {backend_url} does not match the given domain {backend_domain}")
        sys.exit(1)


    # Deploy common
    deploy_common(project, location, environment, domain_name, frontend_domain, frontend_url, backend_url)


if __name__ == "__main__":
    main()
