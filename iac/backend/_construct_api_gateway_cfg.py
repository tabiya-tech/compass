import os
import time

import pulumi
import yaml
import requests

import google
from google.oauth2 import id_token
from google.auth.transport.requests import Request

from lib import Version


def _convert_open_api_3_to_2(openapi3: dict):
    """
    Convert OpenAPI 3.1 to OpenAPI 2.0 format for GCP API Gateway configuration.

    :param openapi3: Open API 3.1 specification as a dictionary.
    :return:
    """
    current_dir = os.path.dirname(__file__)

    # Open the OpenAPI 2.0 template
    template_file = os.path.join(current_dir, 'openapi2_template.yaml')
    with open(template_file, 'r') as f:
        openapi2 = yaml.load(f, Loader=yaml.SafeLoader)

    # Transform the OpenAPI 3.1 to OpenAPI 2.0
    for path in openapi3['paths']:
        for method in openapi3['paths'][path]:

            # OpenAPI 3 and OpenAPI 2 has different way to handle the schema/type
            if 'parameters' in openapi3['paths'][path][method]:
                for param in openapi3['paths'][path][method]['parameters']:
                    schema = param.pop('schema', {type: None})
                    param['type'] = schema['type']

            # Add quota/rate-limiter
            metric_costs = {'metricCosts': {}}  # set the default value
            metric_costs['metricCosts']['request-metric'] = 1
            openapi3['paths'][path][method]['x-google-quota'] = metric_costs

            # remove response contents as not required in GCP API Gateway configs
            if 'responses' in openapi3['paths'][path][method]:
                for response in openapi3['paths'][path][method]['responses']:
                    openapi3['paths'][path][method]['responses'][response].pop('content', None)

            # remove response contents as not required in GCP API Gateway configs
            if 'requestBody' in openapi3['paths'][path][method]:
                openapi3['paths'][path][method].pop('requestBody')

    openapi2['paths'].update(openapi3['paths'])

    return openapi2


def _get_open_api_config(cloud_run_url: str, _id_token: str, expected_version: Version):
    """
    Get the OpenAPI 3 specification from the Cloud Run service (Backend FastAPI App).

    Does a retry mechanism to ensure that the OpenAPI JSON fetched is of the expected version.
    This was added because cloud run service might not be ready immediately on all instances spin up.
    And we may want to ensure that the OpenAPI JSON fetched is of the expected version.

    :param cloud_run_url: The URL of the Cloud Run service.
    :param _id_token: The ID token for authenticating the request to the Cloud Run service.
    :param expected_version: The expected version of the artifacts.
    :return:
    """
    attempts = 5

    open_api_3_json = None
    for attempt in range(attempts):
        # Run the http request to fetch the OpenAPI JSON from the Cloud Run service
        # do a timeout
        response = requests.get(f"{cloud_run_url}/openapi.json",
                                headers={
                                    'Authorization': f'Bearer {_id_token}',
                                })

        if response.status_code == 200:
            open_api_3_json = response.json()
        else:
            raise ValueError(f"Failed to fetch OpenAPI JSON from {cloud_run_url}")

        versions_match = open_api_3_json.get("info").get("version") == f"{expected_version.git_branch_name}-{expected_version.git_sha}"

        # check if the version matches the expected version
        # if we are in preview or dry run mode, we do not check the version
        if pulumi.runtime.is_dry_run() or versions_match:
            return open_api_3_json

        # wait before retrying
        if attempt < attempts - 1:
            # 4 retries - 5 attempts

            # 1 retry - wait 3 sec
            # 2 retry - wait 6 sec
            # 3 retry - wait 12 sec
            # 4 retry - wait 24 sec
            wait_time = 3 * (2 ** attempt)
            pulumi.info(f"Waiting for {wait_time} seconds before retrying...")
            time.sleep(wait_time)
            pulumi.info(f"Retrying to fetch OpenAPI JSON, attempt {attempt + 1} of {attempts}...")
            pulumi.info(f"Expected version: {expected_version}, got: {open_api_3_json.get('info').get('version')}")

    return open_api_3_json


def construct_api_gateway_cfg(*,
                              cloud_run_url: str,
                              expected_version: Version) -> str:
    """
    Construct the API Gateway configuration from the Cloud Run service's (Backend App) OpenAPI 3 specification.
    """
    pulumi.info("Constructing API Gateway configuration...")
    pulumi.info(f"cloud_run_url: {cloud_run_url}")

    # Get the current credentials; pulumi is using to create resources,
    # specifically with the scope of Cloud Platform.
    # For more information about scopes see: https://developers.google.com/identity/protocols/googlescopes
    _credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])

    # Initialize the ID token Feather
    request = Request()
    _credentials.refresh(Request())

    # Fetch the ID token for the Cloud Run URL
    _id_token = id_token.fetch_id_token(request, cloud_run_url)

    # get the open api JSON content from the cloud run url
    open_api_3_json = _get_open_api_config(cloud_run_url, _id_token, expected_version)

    # convert the openapi JSON to YAML bytes
    yaml_config = yaml.dump(_convert_open_api_3_to_2(open_api_3_json),
                            None,
                            encoding='utf-8',
                            allow_unicode=True,
                            indent=2)

    # return the YAML config as a string
    return yaml_config.decode('utf-8')
