import pytest
from unittest.mock import patch, MagicMock, call

from app.app_config import ApplicationConfig
from app.sentry_init import init_sentry, set_sentry_contexts
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


def test_before_send_hook(mock_sentry):
    """
    Test that before_send hook is configured correctly
    """
    # GIVEN an sentry dsn
    dsn = "https://test-dsn@sentry.io/123"

    # WHEN init_sentry is called
    init_sentry(dsn)

    # AND the before_send hook is called
    before_send = mock_sentry['init'].call_args[1]['before_send']

    # AND the before_send hook is called with an event and hint
    event = {}
    hint = MagicMock()
    event = before_send(event, hint)

    event_tags = event.get('tags', {})

    assert event_tags.get("session_id") == session_id_ctx_var.get()
    assert event_tags.get("user_id") == user_id_ctx_var.get()
    assert event_tags.get("client_id") == client_id_ctx_var.get()


def test_set_sentry_contexts(mock_sentry , setup_application_config: ApplicationConfig):
    # GIVEN application is loaded,
    # AND set_sentry_contexts is called.
    set_sentry_contexts()

    # AND the set_context should be called with the right backend version from application_config
    mock_sentry['set_context'].assert_called_once()
    mock_sentry['set_context'].assert_called_with(
        'Backend Version',  setup_application_config.version_info.model_dump()
    )
