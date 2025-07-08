#!/usr/bin/env python3
import os

import yaml
from fastapi.openapi.utils import get_openapi


def export():
    # Set up the environment variables required for the FastAPI app.
    # Since the app won't actually be running, we only need to set the environment variables typically used for testing.
    # This is necessary because the app is initialized at the module level and doesn't currently support passing a configuration.
    # If these values are not set, the app won't start and will throw an error due to missing required environment variables.
    from common_libs.test_utilities.setup_env_vars import env_context
    with env_context():
        from app.server import app
        # Generate the OpenAPI 3.1 schema
        openapi3 = get_openapi(
            title=getattr(app, "title", None),
            version=getattr(app, "version", None),
            openapi_version=getattr(app, "openapi_version", None),
            description=getattr(app, "description", None),
            routes=app.routes
        )
        convert(openapi3)


# Simplified OpenAPI 3.1 to OpenAPI 2.0 converter
# This will only convert the paths that are appended to OpenAPI 2.0 template

def convert(openapi3: dict):
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

    # Write the config to the output folder
    # this name should match the constant in iac/backend/prepare_backend.py
    output_folder = os.path.join(current_dir, '_tmp')
    os.makedirs(output_folder, exist_ok=True)
    output_file = os.path.join(output_folder, 'api_gateway_config.yaml')

    with open(output_file, 'w') as f:
        yaml.dump(openapi2, f, encoding='utf-8', allow_unicode=True)


# add main

if __name__ == "__main__":
    export()
