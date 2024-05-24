import pulumi
from deploy_frontend import deploy_frontend
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

    # Deploy the frontend
    deploy_frontend(project, location)

if __name__ == "__main__":
    main()
