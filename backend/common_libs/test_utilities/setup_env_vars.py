"""
This module is used to set up and teardown the environment variables for the tests.
It is important to set up the environment variables before running the tests and teardown the environment variables after running the tests.

WARNING: Not doing so will load the environment variables from the .env file and the tests will not run as expected, leading to side effects
such as the tests failing, connecting to remote databases, etc.
"""
import os


def setup_env_vars(*, env_vars: dict = None):
    """
    Set up the environment variables for the tests.
    :param env_vars:  Optionally, pass in a dictionary of environment variables to set up.
    :return:
    """
    if env_vars is None:
        env_vars = {}
    # setup the environment variables
    os.environ['TAXONOMY_MONGODB_URI'] = env_vars.get('TAXONOMY_MONGODB_URI', "foo")
    os.environ['TAXONOMY_DATABASE_NAME'] = env_vars.get('TAXONOMY_DATABASE_NAME', "foo")
    os.environ['APPLICATION_MONGODB_URI'] = env_vars.get('APPLICATION_MONGODB_URI', "foo")
    os.environ['APPLICATION_DATABASE_NAME'] = env_vars.get('APPLICATION_DATABASE_NAME', "foo")
    os.environ['METRICS_MONGODB_URI'] = env_vars.get('METRICS_MONGODB_URI', "foo")
    os.environ['METRICS_DATABASE_NAME'] = env_vars.get('METRICS_DATABASE_NAME', "foo")
    os.environ['USERDATA_MONGODB_URI'] = env_vars.get('USERDATA_MONGODB_URI', "foo")
    os.environ['USERDATA_DATABASE_NAME'] = env_vars.get('USERDATA_DATABASE_NAME', "foo")
    os.environ['TAXONOMY_MODEL_ID'] = env_vars.get('TAXONOMY_MODEL_ID', "foo")
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = env_vars.get('GOOGLE_APPLICATION_CREDENTIALS', "foo")
    os.environ['VERTEX_API_REGION'] = env_vars.get('VERTEX_API_REGION', "foo")
    os.environ['LOG_CONFIG_FILE'] = env_vars.get('LOG_CONFIG_FILE', "logging.cfg.yaml")
    os.environ['FRONTEND_URL'] = env_vars.get('FRONTEND_URL', "foo")
    os.environ['BACKEND_URL'] = env_vars.get('BACKEND_URL', "foo")
    os.environ['TARGET_ENVIRONMENT_TYPE'] = env_vars.get('TARGET_ENVIRONMENT_TYPE', "foo")
    os.environ['TARGET_ENVIRONMENT_NAME'] = env_vars.get('TARGET_ENVIRONMENT_NAME', "foo")
    os.environ['SENTRY_BACKEND_DSN'] = env_vars.get('SENTRY_BACKEND_DSN', "foo")
    os.environ['ENABLE_SENTRY'] = env_vars.get('ENABLE_SENTRY', "false")
    os.environ['BACKEND_ENABLE_METRICS'] = env_vars.get('BACKEND_ENABLE_METRICS', "false")
    # Add more environment variables as needed here


def teardown_env_vars():
    # teardown the environment variables
    del os.environ['TAXONOMY_MONGODB_URI']
    del os.environ['TAXONOMY_DATABASE_NAME']
    del os.environ['APPLICATION_MONGODB_URI']
    del os.environ['APPLICATION_DATABASE_NAME']
    del os.environ['METRICS_MONGODB_URI']
    del os.environ['METRICS_DATABASE_NAME']
    del os.environ['USERDATA_MONGODB_URI']
    del os.environ['USERDATA_DATABASE_NAME']
    del os.environ['TAXONOMY_MODEL_ID']
    del os.environ['GOOGLE_APPLICATION_CREDENTIALS']
    del os.environ['VERTEX_API_REGION']
    del os.environ['LOG_CONFIG_FILE']
    del os.environ['FRONTEND_URL']
    del os.environ['BACKEND_URL']
    del os.environ['TARGET_ENVIRONMENT_TYPE']
    del os.environ['TARGET_ENVIRONMENT_NAME']
    del os.environ['SENTRY_BACKEND_DSN']
    del os.environ['ENABLE_SENTRY']
    del os.environ['BACKEND_ENABLE_METRICS']
    # Add more environment variables as needed here
