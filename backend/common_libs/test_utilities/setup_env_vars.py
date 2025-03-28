"""
This module is used to set up and teardown the environment variables for the tests.
It is important to set up the environment variables before running the tests and tear them down afterward.

WARNING: Not doing so will load the environment variables from the .env file, and the tests may not run as expected.
This can lead to side effects such as tests failing unpredictably, connecting to remote databases, writing production data, etc.

Usage
-----

You can use this module in two main ways:

1. Manual setup and teardown:

    from env_utils import setup_env_vars, teardown_env_vars

    def test_something():
        setup_env_vars({'APPLICATION_DATABASE_NAME': 'test_db'})
        # your test logic here
        teardown_env_vars()

2. As a context manager:

    from env_utils import env_context

    def test_with_context():
        with env_context({'BACKEND_ENABLE_METRICS': 'true'}):
            assert os.environ['BACKEND_ENABLE_METRICS'] == 'true'
        # After the context, the original environment is restored

3. Outside of test functions:

    from env_utils import setup_env_vars, teardown_env_vars

    setup_env_vars({'APPLICATION_DATABASE_NAME': 'test_db'})
    # ... do something at module-level
    teardown_env_vars()

4. As a pytest fixture:

    import pytest
    from env_utils import setup_env_vars, teardown_env_vars

    @pytest.fixture
    def setup_env():
        setup_env_vars({'APPLICATION_DATABASE_NAME': 'test_db'})
        yield
        teardown_env_vars()

    def test_with_fixture(setup_env):
        # your test logic here

5. As a dynamic pytest fixture:

    import pytest
    from env_utils import setup_env_vars, teardown_env_vars

    @pytest.fixture
    def setup_env():
        def _setup_env(env_vars=None):
            setup_env_vars(env_vars)
        yield _setup_env
        teardown_env_vars()

    def test_with_fixture(setup_env):
        setup_env({'APPLICATION_DATABASE_NAME': 'test_db'})
        # your test logic here
        assert os.environ['APPLICATION_DATABASE_NAME'] == 'test_db'

This module ensures:
- Any environment variable that was overwritten will be restored to its original value
- Any variable that didn’t exist before will be removed
- Can be used to set up environment variables for tests or other code
- Can be used as a context manager to ensure teardown is always called
"""

import os
from contextlib import contextmanager

from bson import ObjectId

from app.countries import Country

# local variable to store the original environment variables
_original_env_vars = {}


def setup_env_vars(*, env_vars: dict[str, str] = None):
    """
    Set up environment variables and store original values for later restoration.
    Can be used anywhere (inside or outside of test functions).
    :param env_vars:  Optionally, pass in a dictionary of environment variables to set up.
    :return:
    """
    # store the original environment variables
    global _original_env_vars

    if env_vars is None:
        env_vars = {}
    # setup the environment variables
    defaults = {
        'TAXONOMY_MONGODB_URI': "foo",
        'TAXONOMY_DATABASE_NAME': "foo",
        'APPLICATION_MONGODB_URI': "foo",
        'APPLICATION_DATABASE_NAME': "foo",
        'METRICS_MONGODB_URI': "foo",
        'METRICS_DATABASE_NAME': "foo",
        'USERDATA_MONGODB_URI': "foo",
        'USERDATA_DATABASE_NAME': "foo",
        'TAXONOMY_MODEL_ID': str(ObjectId()),
        'GOOGLE_APPLICATION_CREDENTIALS': "foo",
        'VERTEX_API_REGION': "foo",
        'EMBEDDINGS_SERVICE_NAME': "foo",
        'EMBEDDINGS_MODEL_NAME': "foo",
        'LOG_CONFIG_FILE': "logging.cfg.yaml",
        'FRONTEND_URL': "foo",
        'BACKEND_URL': "foo",
        'TARGET_ENVIRONMENT_TYPE': "foo",
        'TARGET_ENVIRONMENT_NAME': "foo",
        'BACKEND_SENTRY_DSN': "foo",
        'BACKEND_ENABLE_SENTRY': "false",
        'BACKEND_ENABLE_METRICS': "false",
        'DEFAULT_COUNTRY_OF_USER': Country.UNSPECIFIED.value,
        # Add more environment variables as needed here
    }

    combined = {**defaults, **env_vars}

    # Store original values
    for key, value in combined.items():
        if key not in _original_env_vars:
            _original_env_vars[key] = os.environ.get(key)

    # Set the new env vars
    os.environ.update(combined)


def teardown_env_vars():
    """
    Restore the environment variables to their original values.
    """
    global _original_env_vars
    for key, original_value in _original_env_vars.items():
        if original_value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = original_value
    _original_env_vars.clear()


@contextmanager
def env_context(*, env_vars: dict[str, str] = None):
    """
    Context manager version to use with `with` statement.
    """
    setup_env_vars(env_vars=env_vars)
    try:
        yield
    finally:
        teardown_env_vars()
