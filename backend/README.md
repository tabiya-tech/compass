# backend

## Prerequisites
- A recent version of [git](https://git-scm.com/) (e.g. ^2.37 )
- [Python 3.8 or higher](https://www.python.org/downloads/)
- [Poerty](https://python-poetry.org/)
    > Note: When you install Poetry, you may encounter an `SSL: CERTIFICATE_VERIFY_FAILED`. See [here](https://github.com/python-poetry/install.python-poetry.org/issues/112#issuecomment-1555925766) on how to resolve the issue.
  
## Installation 
In the root directory of the project, run the following commands:

```shell
# create a virtual environment
python3 -m venv venv-backend

# activate the virtual environment
source venv-backend/bin/activate
```

Install the dependencies:

```shell
poetry install
```

> Note:
> Before running performing any tasks such as building the image or running the code locally, activate the virtual environment so that the installed dependencies are available:
>  ```shell
>  # activate the virtual environment
>  source venv-backend/bin/activate
>  ```
> To deactivate the virtual environment, run:
> ```shell
> # deactivate the virtual environment
> deactivate
> ```


## Launch LangServe locally

```shell
langchain serve
```

## Running in Docker

This project folder includes a Dockerfile that allows you to easily build and host your LangServe app.

### Building the Image locally

To build the image:

```shell
docker build . -t compass-backend
```

### Running the Image Locally

To run the image, you'll need to include a `.env` file in the root directory of the project. 

We also expose port 8080 with the `-p 8080:8080` option.

```shell
docker run -v "$(pwd)/.env:/code/.env" -p 8080:8080 compass-backend
```


