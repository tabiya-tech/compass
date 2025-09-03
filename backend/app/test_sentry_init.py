import pytest
import logging
from unittest.mock import patch

from app.app_config import ApplicationConfig
from app.sentry_init import init_sentry, set_sentry_contexts, _determine_event_level
from app.context_vars import session_id_ctx_var, user_id_ctx_var, client_id_ctx_var


@pytest.fixture
def mock_sentry():
    with patch('sentry_sdk.init') as mock_init, \
            patch('sentry_sdk.set_tag') as mock_set_tag, \
            patch('sentry_sdk.set_context') as mock_set_context:
        yield {
            'init': mock_init,
            'set_tag': mock_set_tag,
            'set_context': mock_set_context
        }


def test_init_sentry_with_environment(mock_sentry):
    """
    Test sentry initialization with environment parameter
    """
    # GIVEN a sentry dsn and environment
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
    # GIVEN a sentry dsn
    dsn = "https://test-dsn@sentry.io/123"

    # WHEN init_sentry is called
    init_sentry(dsn)

    # THEN sentry is initialized with the correct integrations
    mock_sentry['init'].assert_called_once()
    init_args = mock_sentry['init'].call_args[1]
    integrations = init_args['integrations']

    # Check that we have 1 or 2 integrations depending on enableLogs
    assert len(integrations) >= 1

    # Check integration types
    integration_types = [type(integration) for integration in integrations]
    assert any('FastApiIntegration' in str(t) for t in integration_types)


def test_before_send_hook(mock_sentry):
    """
    Test that before_send hook is configured correctly
    """
    # GIVEN a sentry dsn
    dsn = "https://test-dsn@sentry.io/123"

    # WHEN init_sentry is called
    init_sentry(dsn)

    # AND the before_send hook is called
    before_send = mock_sentry['init'].call_args[1]['before_send']

    # AND the before_send hook is called with an event and hint
    event = {}
    hint = None
    event = before_send(event, hint)

    # THEN the event should have the correct tags
    event_tags = event.get('tags', {})
    assert event_tags.get("session_id") == session_id_ctx_var.get()
    assert event_tags.get("user_id") == user_id_ctx_var.get()
    assert event_tags.get("client_id") == client_id_ctx_var.get()


def test_set_sentry_contexts(mock_sentry , setup_application_config: ApplicationConfig):
    # GIVEN application is loaded
    # WHEN set_sentry_contexts is called
    set_sentry_contexts()

    # THEN the set_context should be called with the right backend version from application_config
    mock_sentry['set_context'].assert_called_once()
    mock_sentry['set_context'].assert_called_with(
        'Backend Version',  setup_application_config.version_info.model_dump()
    )


@patch('app.sentry_init.LoggingIntegration')
def test_init_sentry_with_custom_config(mock_logging_integration, mock_sentry):
    """
    Test sentry initialization with custom configuration including logLevels
    """
    # GIVEN a sentry dsn and custom config
    dsn = "https://test-dsn@sentry.io/123"
    config = {
        "tracesSampleRate": 0.5,
        "enableLogs": True,
        "logLevel": "info",
        "eventLevel": "warning",
    }

    # WHEN init_sentry is called with the custom config
    init_sentry(dsn, config=config)

    # THEN sentry is initialized with the custom config
    mock_sentry['init'].assert_called_once()
    init_args = mock_sentry['init'].call_args[1]
    assert init_args['traces_sample_rate'] == 0.5
    
    # AND LoggingIntegration was called with correct parameters
    mock_logging_integration.assert_called_once()
    logging_integration_args = mock_logging_integration.call_args[1]
    assert logging_integration_args['sentry_logs_level'] == logging.INFO
    assert logging_integration_args['event_level'] == logging.WARNING


def test_determine_event_level():
    """
    Test the _determine_event_level function with various configurations
    """
    # GIVEN various log level configurations
    # WHEN _determine_event_level is called
    # THEN it should return the correct logging level
    
    assert _determine_event_level("debug") == logging.DEBUG
    assert _determine_event_level("info") == logging.INFO
    assert _determine_event_level("warning") == logging.WARNING
    # Python logging recognizes WARN as alias of WARNING
    assert _determine_event_level("warn") == logging.WARNING
    assert _determine_event_level("error") == logging.ERROR
    assert _determine_event_level("critical") == logging.CRITICAL


    # removed: we do not support separate context level capture in backend
