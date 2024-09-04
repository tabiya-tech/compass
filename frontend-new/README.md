# Compass Frontend

The deployed version can be found here: [Frontend URL](http://compass-frontend-dev-418218-6a5e4c1.storage.googleapis.com/newUI/index.html)
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

    ```
    cd ./frontend-new
    ```

4. Install the project's dependencies:
    ```shell
    yarn install
    ```
5. Set up the required environment variables:

   - Create a `env.js` file in the `public/data` directory. You can use the [`env.example.js`](public/data/env.example.js) file as a template.
   - The following environment variables are required:
     - `FIREBASE_API_KEY`: The API key for Firebase authentication
     - `FIREBASE_AUTH_DOMAIN`: The Firebase authentication domain
     - `BACKEND_URL`: The URL of the backend API
     - `SENTRY_DSN`: The Sentry Data Source Name for error tracking
     - `SENTRY_AUTH_TOKEN`: The Sentry authentication token, used to upload source maps
     - `FRONTEND_URL`: The URL of the frontend application

   Please request the necessary environment variable values from the project team.


## Running the development server locally


After installing and setting up the project locally, run the development server with the following command:

```shell
yarn start
```

The server will run on port 3000, and you can preview the application in your browser by visiting [http://localhost:3000](http://localhost:3000).

## Storybook

We use Storybook to test and demonstrate components in the browser. To run Storybook, execute the following command:

```
yarn storybook
```
## Testing

To run the test cases for the application, execute the following command:

```
yarn test 
```

## Accessibility Testing

The application uses [Storybook](https://storybook.js.org/tutorials/ui-testing-handbook/react/en/accessibility-testing/) and [Axe-Playwright](
https://github.com/abhinaba-ghosh/axe-playwright) to test the accessibility of the components.

To run the accessibility tests cases locally, execute the following commands, open a shell and start storybook:

```
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

