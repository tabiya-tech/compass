# Chabot for demo and local dev purposes only

## Deploying a new version

The chabot is deployed automatically whenever a new commit is pushed to the `main`.\
The chatbot can be found here: [Chatbot URL(dev.compass.tabiya.tech)](http://dev.compass.tabiya.tech)

## How to run the chatbot locally

To run the demo chat UI and connect to a local instance of the backend:

1. Start the compass backend locally. The current configuration assumes that the Uvicorn server is running on http://0.0.0.0:8080.
2. Clone this repository locally.\
   From the repository's main folder:
   ```sh
   yarn install
   yarn run dev
   
## Use the conversation sandbox UI

The UI can be configured to use an alternative path for the conversation backend.
This is useful for testing and reviewing an individual agent's conversation manually in a configurable way without having to conduct a full conversation.

To do this, ensure your backend is running and the desired path agent is available at the specified endpoint.

For the development environment, you can simply set the `NEXT_PUBLIC_DEFAULT_COMPASS_ENDPOINT` environment variable to the desired path in the `.env.development` file:

```
NEXT_PUBLIC_DEFAULT_COMPASS_ENDPOINT=/conversation
```

On the deployed version you can acheive the same by adding the `?compass_endpoint` query parameter to the URL:

```
http://dev.compass.tabiya.tech?compass_endpoint=/conversation_sandbox
```

> The `?compass_endpoint` query parameter should be one of the paths defined in the separate `NEXT_PUBLIC_COMPASS_AVAILABLE_ENDPOINTS` environment variable, or the `NEXT_PUBLIC_DEFAULT_COMPASS_ENDPOINT` environment variable  will be used instead.