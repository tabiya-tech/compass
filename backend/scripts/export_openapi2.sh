#/bin/bash
python3 export_openapi.py
python3 convert_to_openapi2.py
cp openapi2.yaml ../../iac/backend/config/gcp_api_gateway_config.yaml