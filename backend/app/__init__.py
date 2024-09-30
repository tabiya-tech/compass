import logging
import logging.config
import os
import sys
import traceback

import yaml
from dotenv import load_dotenv

from app.sentry_init import init_sentry

# Load environment variables from .env file
load_dotenv()


def _get_module_path():
    """
    This function returns the path of the module
    :return: module_path - the path of the module
    """
    module_path = os.path.abspath(__file__)
    module_path = os.path.normcase(module_path)
    module_path = os.path.dirname(module_path)  # get the directory

    return module_path

# setup logging

def _get_configuration_filename(file: str):
    # Check if the given file path is an absolute path
    if os.path.isabs(file):
        return file

    module_path = _get_module_path()
    return os.path.join(module_path, file)


def _setup_config(configuration_file):
    try:
        with open(configuration_file, 'r', encoding="utf-8") as stream:
            try:
                # Get the module path
                module_path = _get_module_path()

                # Read the configuration file,
                # we are changing the config to string first so that we can replace the PROJECT_BASE_PATH with the module path
                # to decide where logs are going to go, as this config is used by many submodules
                config = stream.read()

                # Replace the PROJECT_BASE_PATH with the module path,
                # this project base path is used to know where the logs are going to be placed in a file
                config = config.replace("PROJECT_BASE_PATH", module_path)

                # Load the configuration
                cfg = yaml.safe_load(config)

                # Configure the logging
                logging.config.dictConfig(cfg)  # just once
            except yaml.YAMLError as exc:
                print(f"An error occurred while parsing the yaml file:{configuration_file}\n", exc, file=sys.stderr)
            except Exception:  # pylint: disable=broad-except
                print("Unexpected error occurred while configuring logging\n", traceback.format_exc(),
                      file=sys.stderr)
    except IOError:
        print(f"An error occurred while opening the yaml file:{configuration_file}", traceback.format_exc(),
              file=sys.stderr)


# The configuration is loaded (once) when python imports the module.
# If the LOG_CONFIG_FILE environment variable is not set, then fallback to the production logging configuration
log_config_file = os.getenv("LOG_CONFIG_FILE", "logging.cfg.yaml")
_setup_config(_get_configuration_filename(log_config_file))
logging.debug("Logging initialized")

# Sentry should only be initialized if the environment variable ENABLE_SENTRY is set to true
# This environment will be set to false for local development or the CI/CD pipeline
# because the sentry initialization breaks the unit tests (specifically the ones that use the fastapi test client)
if os.getenv("ENABLE_SENTRY") == "True":
    backend_dsn = os.getenv("SENTRY_BACKEND_DSN")
    if backend_dsn:
        init_sentry(backend_dsn, os.getenv("TARGET_ENVIRONMENT"))
    else :
        logging.warning("SENTRY_BACKEND_DSN environment variable is not set. Sentry will not be initialized")
else:
    logging.warning("ENABLE_SENTRY environment variable is not set to True.  Sentry will not be initialized")