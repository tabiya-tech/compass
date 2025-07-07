## Backend modules (Optional Features/Plugins)

Our backend supports optional features/plugins that are loaded at runtime based on configurations.

### How to add a new feature/plugin:

To add a new feature create a `FeatureImpl` class that implements the ABC class [Feature](./types.py#IFeature). For more information on the methods to implement refer to the ABC Class. From the environment variable `BACKEND_FEATURES` you can configure them.

1. **Schema:**
 
    ```json lines
    {
      "feature_id": {
        "enabled": true, // true/false,
        "class_path": "{{ the python module to the implementation of the feature class }}",
        "class_name": "{{ name of the class implenting IFeature }}",
        "config": {
          // ... configuration for the feature
        }
      }
    }
    ```

    Example:
    
    ```json lines
    {
      "963b42e6-cdb2-4100-84c7-68cc148ba1ed": {
        "enabled": true,
        "class_path": "modules.my_plugin.setup",
        "class_name": "MyPlugin",
        "config": {
          "param_1": 10,
          "param_2": 20
        }
      }
    }
    ```

2. **Add the config to the supported features file:**  
   
   For the GCP API Gateway to include the current feature APIs (paths), you need to specify them in the file [`/scripts/export_api_gateway_config/supported_features.json`](/backend/scripts/export_api_gateway_config/supported_features.json). This file is used to generate the OpenAPI spec and the API Gateway configuration. The format is the same as above.