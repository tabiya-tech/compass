# Compass Frontend

## Prerequisites

To develop the frontend locally, you must install the following:

* [Node.js ^16.0](https://nodejs.org/dist/latest-v16.x/)
* [Yarn ^1.22](https://classic.yarnpkg.com/en/)
* A recent version of [git](https://git-scm.com/) (e.g. ^2.37 )

## Installation

To develop this application locally, follow these steps:

1. Ensure you have the [prerequisites](#prerequisites) installed before proceeding.

2. Clone the repository

3. Navigate to the frontend directory:

    ```
    cd ./frontend
    ```

4. Install the project's dependencies:
    ```shell
    yarn install
    ```
   
## Running the development server locally

After installing and setting up the project locally, run the development server with the following command:

```shell
yarn start
```

The server will run on port 3000, and you can preview the application in your browser by visiting [http://localhost:3000](http://localhost:3000).

## Testing

To run the test cases for the application, execute the following command:

```
yarn test 
```
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

In addition to the [contribution guidelines](/README.md#contribution-guidelines) mentioned in the parent directory, please follow these specific rules while working on the frontend project:

- Before pushing your work, make sure to:
    - [Run the linter](#linting)
    - [Build the application](#building)
    - [Test your code](#testing)

