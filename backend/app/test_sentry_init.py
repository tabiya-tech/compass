import math

import pytest
from unittest.mock import patch, MagicMock
import sentry_sdk
from app.sentry_init import init_sentry
from app.context_vars import session_id_ctx_var, user_id_ctx_var

@pytest.fixture
def mock_sentry():
    with patch('sentry_sdk.init') as mock_init, \
         patch('sentry_sdk.set_user') as mock_set_user:
        yield {
            'init': mock_init,
            'set_user': mock_set_user
        }

def test_init_sentry_with_environment(mock_sentry):
    """
    Test sentry initialization with environment parameter
    """
    # GIVEN an sentry dsn and environment
    dsn = "https://test-dsn@sentry.io/123"
    environment = "test"

    # WHEN init_sentry is called with the environment
    init_sentry(dsn, environment)

    # THEN sentry is initialized with the environment
    mock_sentry['init'].assert_called_once()
    init_args = mock_sentry['init'].call_args[1]
    assert init_args['dsn'] == dsn
    assert init_args['environment'] == environment
    assert init_args['send_default_pii'] is False
    assert math.isclose(init_args['traces_sample_rate'], 1.0)

def test_init_sentry_without_environment(mock_sentry):
    """
    Test sentry initialization without environment parameter
    """
    # GIVEN a sentry dsn
    dsn = "https://test-dsn@sentry.io/123"

    # WHEN init_sentry is called without the environment
    init_sentry(dsn)

    # THEN sentry is initialized without the environment
    mock_sentry['init'].assert_called_once()
    init_args = mock_sentry['init'].call_args[1]
    assert init_args['dsn'] == dsn
    assert init_args['environment'] is None

def test_sentry_integrations_configured(mock_sentry):
    """
    Test that sentry is initialized with the correct integrations
    """
    # GIVEN an sentry dsn
    dsn = "https://test-dsn@sentry.io/123"

    # WHEN init_sentry is called
    init_sentry(dsn)

    # THEN sentry is initialized with the correct integrations
    mock_sentry['init'].assert_called_once()
    init_args = mock_sentry['init'].call_args[1]
    integrations = init_args['integrations']
    
    # Check that we have exactly 2 integrations
    assert len(integrations) == 2
    
    # Check integration types
    integration_types = [type(integration) for integration in integrations]
    assert 'FastApiIntegration' in str(integration_types[0])
    assert 'LoggingIntegration' in str(integration_types[1])