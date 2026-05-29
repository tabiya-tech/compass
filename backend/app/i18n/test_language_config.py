import os
import pytest

from app.i18n.language_config import (
    _LANGUAGE_CONFIG_ENV,
    load_language_config_from_env,
    reset_language_config_cache,
)
from app.i18n.types import Locale


@pytest.fixture(autouse=True)
def _clear_cache_and_env(monkeypatch):
    """Ensure each test starts with a clean cache and controlled env."""
    reset_language_config_cache()
    # Remove env var by default; tests will set it explicitly when needed.
    monkeypatch.delenv(_LANGUAGE_CONFIG_ENV, raising=False)
    yield
    reset_language_config_cache()


def _set_config(monkeypatch, value: str) -> None:
    monkeypatch.setenv(_LANGUAGE_CONFIG_ENV, value)


def test_missing_env_raises_runtime_error(monkeypatch):
    # GIVEN BACKEND_LANGUAGE_CONFIG is not set
    monkeypatch.delenv(_LANGUAGE_CONFIG_ENV, raising=False)

    # THEN loading the config should fail with a runtime error
    with pytest.raises(RuntimeError):
        load_language_config_from_env()


def test_invalid_json_raises_value_error(monkeypatch):
    # GIVEN invalid JSON in env
    _set_config(monkeypatch, "not-json")

    # THEN loading the config should fail with a value error
    with pytest.raises(ValueError):
        load_language_config_from_env()


def test_invalid_date_format_rejected(monkeypatch):
    # GIVEN a config with an invalid date_format token
    cfg = {
        "conversation_fallback_locale": "en-US",
        "reporting_locale": "en-US",
        "available_locales": [
            {"locale": "en-US", "date_format": "YYYY/AA"},  # AA is invalid
        ],
    }
    _set_config(monkeypatch, __import__("json").dumps(cfg))

    with pytest.raises(ValueError):
        load_language_config_from_env()


def test_duplicate_token_type_rejected(monkeypatch):
    # GIVEN a config with duplicate year token types
    cfg = {
        "conversation_fallback_locale": "en-US",
        "reporting_locale": "en-US",
        "available_locales": [
            {"locale": "en-US", "date_format": "YYYY-YY"},
        ],
    }
    _set_config(monkeypatch, __import__("json").dumps(cfg))

    with pytest.raises(ValueError):
        load_language_config_from_env()


def test_single_token_allowed(monkeypatch):
    # GIVEN a config with a single-token format (year-only)
    cfg = {
        "conversation_fallback_locale": "en-US",
        "reporting_locale": "en-US",
        "available_locales": [
            {"locale": "en-US", "date_format": "YYYY"},
        ],
    }
    _set_config(monkeypatch, __import__("json").dumps(cfg))

    cfg_obj = load_language_config_from_env()

    assert cfg_obj.conversation_fallback_locale == Locale.EN_US
    assert cfg_obj.reporting_locale == Locale.EN_US
    assert len(cfg_obj.available_locales) == 1
    assert cfg_obj.available_locales[0].date_format.upper() == "YYYY"


def test_lowercase_tokens_allowed(monkeypatch):
    # GIVEN a config with lowercase tokens (thanks to IGNORECASE)
    cfg = {
        "conversation_fallback_locale": "en-US",
        "reporting_locale": "en-US",
        "available_locales": [
            {"locale": "en-US", "date_format": "dd/mm/yyyy"},
        ],
    }
    _set_config(monkeypatch, __import__("json").dumps(cfg))

    cfg_obj = load_language_config_from_env()

    assert cfg_obj.conversation_fallback_locale == Locale.EN_US
    assert cfg_obj.available_locales[0].date_format == "dd/mm/yyyy"


def test_fallback_locale_must_be_in_available_locales(monkeypatch):
    # GIVEN conversation_fallback_locale that is not listed in available_locales
    cfg = {
        "conversation_fallback_locale": "en-US",
        "reporting_locale": "en-GB",
        "available_locales": [
            {"locale": "en-GB", "date_format": "DD/MM/YYYY"},
        ],
    }
    _set_config(monkeypatch, __import__("json").dumps(cfg))

    with pytest.raises(ValueError):
        load_language_config_from_env()


def test_reporting_locale_must_be_in_available_locales(monkeypatch):
    # GIVEN reporting_locale that is not listed in available_locales
    cfg = {
        "conversation_fallback_locale": "en-US",
        "reporting_locale": "es-ES",
        "available_locales": [
            {"locale": "en-US", "date_format": "MM/DD/YYYY"},
        ],
    }
    _set_config(monkeypatch, __import__("json").dumps(cfg))

    with pytest.raises(ValueError):
        load_language_config_from_env()


def test_successful_load(monkeypatch):
    # GIVEN a valid configuration
    cfg = {
        "conversation_fallback_locale": "en-US",
        "reporting_locale": "en-US",
        "available_locales": [
            {"locale": "en-US", "date_format": "MM/DD/YYYY"},
            {"locale": "en-GB", "date_format": "DD/MM/YYYY"},
        ],
    }
    _set_config(monkeypatch, __import__("json").dumps(cfg))

    cfg_obj = load_language_config_from_env()

    assert cfg_obj.conversation_fallback_locale == Locale.EN_US
    assert cfg_obj.reporting_locale == Locale.EN_US
    assert {e.locale for e in cfg_obj.available_locales} == {Locale.EN_US, Locale.EN_GB}
