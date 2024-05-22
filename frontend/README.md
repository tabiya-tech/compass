# Chabot for demo and local dev purposes only

## Deploying a new version

The chabot is deployed automatically whenever a new commit is pushed to the `main`.\
The chatbot can be found here: [Chatbot URL](http://compass-frontend-dev-418218-6a5e4c1.storage.googleapis.com/index.html)

## How to run the chatbot locally

To run the demo chat UI and connect to a local instance of the backend:

1. Start the compass backend locally. The current configuration assumes that the Uvicorn server is running on http://0.0.0.0:8080.
2. Clone this repository locally.\
   From the repository's main folder:
   ```sh
   yarn install
   yarn run dev