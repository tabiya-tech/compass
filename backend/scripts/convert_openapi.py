import yaml

# Simplified OpenAPI 3.1 to OpenAPI 2.0 converter
# This will only convert the paths that are appended to OpenAPI 2.0 template

with open('openapi3.yaml', 'r') as f:
    openapi3 = yaml.load(f, Loader=yaml.SafeLoader)

with open('openapi2_template.yaml', 'r') as f:
    openapi2 = yaml.load(f, Loader=yaml.SafeLoader)

for path in openapi3['paths']:
    for method in openapi3['paths'][path]:
        if 'parameters' in openapi3['paths'][path][method]:
            for param in openapi3['paths'][path][method]['parameters']:
                schema = param.pop('schema', {type: None})
                param['type'] = schema['type']
        
        # remove response contents as not required in GCP API Gateway configs
        if 'responses' in openapi3['paths'][path][method]:
            for response in openapi3['paths'][path][method]['responses']:
                openapi3['paths'][path][method]['responses'][response].pop('content',None)

openapi2['paths'] = openapi3['paths']

with open('openapi2.yaml', 'w') as f:
    yaml.dump(openapi2, f)