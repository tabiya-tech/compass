# Compass Frontend

The deployed version can be found here: [Frontend URL](https://dev.compass.tabiya.tech)
## Prerequisites

To develop the frontend locally, you must install the following:

* [Node.js ^16.0](https://nodejs.org/dist/latest-v16.x/)
* [Yarn ^1.22](https://classic.yarnpkg.com/en/)
* A recent version of [git](https://git-scm.com/) (e.g. ^2.37 )

## Technologies

- [React](https://react.dev/)
- [MUI](https://mui.com/)
- [Typescript](https://www.typescriptlang.org/)
- [Storybook](https://storybook.js.org/)
- [Jest](https://jestjs.io/)

## Installation

To develop this application locally, follow these steps:

1. Ensure you have the [prerequisites](#prerequisites) installed before proceeding.

2. Clone the repository

3. Navigate to the frontend-new directory:

    ```shell
    cd ./frontend-new
    ```

4. Install the project's dependencies:
    ```shell
    yarn install
    ```
5. Set up the required environment variables:

   - Create a `env.js` file in the `public/data` directory. You can use the [`env.example.js`](public/data/env.example.js) file as a template.

     All values of these variables should be encoded in base64 format. You can use the following command to encode the values:
      ```shell
      echo -n "your_value" | base64
      ``` 
     Alternatively, you can use the `btoa()` function in the browser console, since this is a JavaScript file.

     Make sure to also read the documentation for the [getEnv()](./src/envService.ts) function, especially regarding the encoding of Unicode strings.
   - `SENTRY_AUTH_TOKEN`: (**Optional**) The Sentry authentication token, used to upload source maps

   - The following environment variables can be set in the `env.js` file:
     - `FIREBASE_API_KEY`: (**Mandatory**) The API key for Firebase authentication
     - `FIREBASE_AUTH_DOMAIN`: (**Mandatory**) The Firebase authentication domain
     - `BACKEND_URL`: (**Mandatory**) The URL of the backend API
     - `TARGET_ENVIRONMENT_NAME`: (Mandatory) The name of the environment (e.g. "dev", "test", "demo", ....)
     - `FRONTEND_SENTRY_DSN`: (**Optional**) The Sentry Data Source Name for error tracking (the frontend DSN is for the project used to track frontend errors)
     - `FRONTEND_ENABLE_SENTRY`: (**Optional**) A boolean value to enable or disable Sentry error tracking
     - `FRONTEND_SENTRY_CONFIG`: (**Optional**) A json object containing the Sentry configuration. This is used to configure Sentry for the frontend application. See [SentryConfig](./src/sentryInit.ts) for more details.
     - `FRONTEND_ENABLE_METRICS`: (**Optional**) A boolean value to enable or disable metrics tracking
     - `FRONTEND_ENABLE_CV_UPLOAD`: (**Optional**) A boolean value to enable or disable CV upload functionality. Defaults to `false` if not set.
     - `SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY`:(**Mandatory**) The RSA public key used to encrypt sensitive personal data. It is in the [PEM](https://www.rfc-editor.org/rfc/rfc7468) format.
     - `SENSITIVE_PERSONAL_DATA_RSA_ENCRYPTION_KEY_ID`: (**Mandatory**) The ID of the RSA public key. This is used to identify the key used to encrypt the sensitive personal data as it may be rotated over time.
     - `FRONTEND_LOGIN_CODE`: (**Optional**) The login code for the frontend application. It is optional, if not provided user will be prompted to enter the login code.
     - `FRONTEND_DISABLE_LOGIN_CODE`: (**Optional**) A boolean value to disable the login code prompt. If set to true, we disable the anonymous login code prompt and the user will only be able to log in using an existing account.
     - `FRONTEND_REGISTRATION_CODE`: (**Optional**) The registration code for the frontend application. It is optional, if not provided user will be prompted to enter the registration code.
     - `FRONTEND_DISABLE_REGISTRATION`: (**Optional**) A boolean value to disable the registration entirely.
     - `FRONTEND_DISABLE_SOCIAL_AUTH`: (**Optional**) A boolean value to disable social authentication options on the login and registration pages.
     - `FRONTEND_FEATURES`: (**optional**) A JSON like dictionary with the features enabled status and configurations specific to each feature.
     - `FRONTEND_SUPPORTED_LANGUAGES`:(**Mandatory**) A JSON array of enabled locale codes (e.g., ["en-GB", "en-US","es-ES","es-AR", "fr-FR"]). Refer to the constant [SupportedLocales](./src/i18n/constants.ts#SupportedLocales) for more about the supported locales. They must follow [IETF BCP 47](https://www.ietf.org/rfc/bcp/bcp47.txt) format.
     - `FRONTEND_DEFAULT_LOCALE`:(**Mandatory**) Default UI language to use if the user preference is not set. It must be one of the supported locales.

   Please request the necessary environment variable values from the project team.
   
   For Encryption keys, please refer to the [how to set up sensitive data protection keys](../sensitive-data-protection.md) documentation.

## Running the development server locally

After installing and setting up the project locally, run the development server with the following command:

```shell
yarn start
```

The server will run on port 3000, and you can preview the application in your browser by visiting [http://localhost:3000](http://localhost:3000).

## Authentication

The application currently uses Firebase for authentication. To read further about the authentication process, please refer to the [Authentication Hierarchy Documentation](authenticationHierarchyDoc.md).

Currently, only invited users can access the application as part of the Authentication and Authorization process. Invitation codes play a key role in this setup. For more details, please refer to this [documentation](/invitations.md).
## Storybook

We use Storybook to test and demonstrate components in the browser. To run Storybook, execute the following command:

```shell
yarn storybook
```
## Testing

To run the test cases for the application, execute the following command:

```shell
yarn test 
```

## Accessibility Testing

The application uses [Storybook](https://storybook.js.org/tutorials/ui-testing-handbook/react/en/accessibility-testing/) and [Axe-Playwright](
https://github.com/abhinaba-ghosh/axe-playwright) to test the accessibility of the components.

To run the accessibility tests cases locally, execute the following commands, open a shell and start storybook:

```shell
yarn storybook
```

Then, open another shell and run:

```
yarn test-storybook
```

Alternatively, you can run the following command in a single shell:
```
yarn build-storybook && yarn test:accessibility
```

Failing to comply to WAG 2.0 A rules will generate errors.

Failing to comply to WAG 2.0 AA, WAG 2.0 AAA, or Best Practice Rules will only generate warnings.

See [UI Guidlines](ui-guidelines.md#accessibility) for more information on accessibility.
## Building

To build the React application, execute the following command:

```shell
yarn build
```

## Linting

To run the linter, execute the following command:

```shell
yarn lint
```

## Contributing

Contributions are highly valued in this project.

In addition to the [contribution guidelines](../README.md#contribution-guidelines) mentioned in the parent directory, please follow these specific rules while working on the frontend project:

- Please consult our [UI Guidelines](ui-guidelines.md) before proceeding with frontend work.

- Before pushing your work, make sure to:
    - [Run the linter](#linting)
    - [Build the application](#building)
    - [Test your code](#testing)

