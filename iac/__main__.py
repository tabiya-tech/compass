import pulumi
from deploy_backend import deploy_backend
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

    # Deploy the backend
    deploy_backend(project, location)


if __name__ == "__main__":
    main()
