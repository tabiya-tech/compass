import yaml
import collections
from yaml.representer import Representer
yaml.add_representer(collections.defaultdict, Representer.represent_dict)

# Simplified OpenAPI 3.1 to OpenAPI 2.0 converter
# This will only convert the paths that are appended to OpenAPI 2.0 template

def convert():
    with open('openapi3.yaml', 'r') as f:
        openapi3 = yaml.load(f, Loader=yaml.SafeLoader)

    with open('openapi2_template.yaml', 'r') as f:
        openapi2 = yaml.load(f, Loader=yaml.SafeLoader)

    for path in openapi3['paths']:
        for method in openapi3['paths'][path]:

            # OpenAPI 3 and OpenAPI 2 has different way to handle the schema/type
            if 'parameters' in openapi3['paths'][path][method]:
                for param in openapi3['paths'][path][method]['parameters']:
                    schema = param.pop('schema', {type: None})
                    param['type'] = schema['type']
            
            # Add quota/rate-limiter
            metric_costs = collections.defaultdict(dict)
            metric_costs['metricCosts']['request-metric'] = 1
            openapi3['paths'][path][method]['x-google-quota'] = metric_costs

            # remove response contents as not required in GCP API Gateway configs
            if 'responses' in openapi3['paths'][path][method]:
                for response in openapi3['paths'][path][method]['responses']:
                    openapi3['paths'][path][method]['responses'][response].pop('content',None)

            # remove response contents as not required in GCP API Gateway configs
            if 'requestBody' in openapi3['paths'][path][method]:
                openapi3['paths'][path][method].pop('requestBody')

    openapi2['paths'].update(openapi3['paths'])
    
    with open('openapi2.yaml', 'w') as f:
        yaml.dump(openapi2, f)
