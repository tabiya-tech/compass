import pytest

from app.i18n.locale_date_format import (
    _derive_patterns,
    reset_date_format_cache,
    get_locale_date_format,
    format_date_value_for_locale,
)
from app.i18n.types import Locale
from app.i18n.language_config import LanguageConfig, LocaleDateFormatEntry


@pytest.fixture(autouse=True)
def _clear_cache(monkeypatch):
    """Ensure each test runs with a clean date-format cache."""
    reset_date_format_cache()
    yield
    reset_date_format_cache()


def _mock_app_config_with_locales(monkeypatch, available_locales: list):
    """Helper to mock application config with specific locale date formats."""
    # Create a mock LanguageConfig
    mock_language_config = LanguageConfig(
        conversation_fallback_locale=available_locales[0].locale,
        reporting_locale=available_locales[0].locale,
        available_locales=available_locales
    )
    
    # Create a mock ApplicationConfig
    mock_app_config = type("ApplicationConfig", (), {
        "language_config": mock_language_config
    })()
    
    # Mock get_application_config
    monkeypatch.setattr("app.i18n.locale_date_format.get_application_config", lambda: mock_app_config)


def _mock_i18n_manager_locale(monkeypatch, locale: Locale):
    """Helper to mock get_i18n_manager to return a specific locale."""
    fake_i18n_manager = type("I18nManager", (), {"get_reporting_locale": lambda: locale})()
    monkeypatch.setattr("app.i18n.locale_date_format.get_i18n_manager", lambda: fake_i18n_manager)


def test_derive_patterns_full_month_year_and_year_only_from_dd_mm_yyyy():
    # GIVEN a full pattern with day, month, year
    fmt = _derive_patterns("DD/MM/YYYY")

    assert fmt.full == "DD/MM/YYYY"
    # month_year drops the day token, keeps month+year
    assert fmt.month_year == "MM/YYYY"
    assert fmt.year_only == "YYYY"


def test_derive_patterns_from_mm_dd_yy():
    # GIVEN a pattern with 2-digit year
    fmt = _derive_patterns("MM-DD-YY")

    assert fmt.full == "MM-DD-YY"
    assert fmt.month_year == "MM-YY"
    assert fmt.year_only == "YY"


def test_derive_patterns_requires_year_and_month():
    # GIVEN pattern without month
    with pytest.raises(ValueError):
        _derive_patterns("YYYY-DD")

    # GIVEN pattern without year
    with pytest.raises(ValueError):
        _derive_patterns("MM-DD")


def test_get_locale_date_format_uses_configured_locale(monkeypatch):
    # GIVEN EN_US locale with configured format MM/DD/YYYY
    available_locales = [
        LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY")
    ]
    _mock_app_config_with_locales(monkeypatch, available_locales)
    _mock_i18n_manager_locale(monkeypatch, Locale.EN_US)

    fmt = get_locale_date_format(Locale.EN_US)

    assert fmt.full == "MM/DD/YYYY"
    assert fmt.month_year == "MM/YYYY"
    assert fmt.year_only == "YYYY"


def test_get_locale_date_format_falls_back_to_default_when_locale_missing(monkeypatch):
    # GIVEN EN_GB locale is requested with configured format DD/MM/YYYY
    available_locales = [
        LocaleDateFormatEntry(locale=Locale.EN_GB, date_format="DD/MM/YYYY")
    ]
    _mock_app_config_with_locales(monkeypatch, available_locales)
    _mock_i18n_manager_locale(monkeypatch, Locale.EN_GB)

    fmt = get_locale_date_format(Locale.EN_GB)

    # THEN we get the EN_GB configured pattern
    assert fmt.full == "DD/MM/YYYY"


def test_format_date_value_for_locale_full_date_en_us(monkeypatch):
    # GIVEN EN_US locale with full pattern MM/DD/YYYY
    available_locales = [
        LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY")
    ]
    _mock_app_config_with_locales(monkeypatch, available_locales)
    _mock_i18n_manager_locale(monkeypatch, Locale.EN_US)

    value = "2020/06/05"  # canonical (YYYY/MM/DD)
    formatted = format_date_value_for_locale(value, locale=Locale.EN_US)

    assert formatted == "06/05/2020"


def test_format_date_value_for_locale_year_month_only(monkeypatch):
    # GIVEN EN_US locale with MM/DD/YYYY (month_year derived as MM/YYYY)
    available_locales = [
        LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY")
    ]
    _mock_app_config_with_locales(monkeypatch, available_locales)
    _mock_i18n_manager_locale(monkeypatch, Locale.EN_US)

    value = "2020/06"
    formatted = format_date_value_for_locale(value, locale=Locale.EN_US)

    assert formatted == "06/2020"


def test_format_date_value_for_locale_year_only(monkeypatch):
    # GIVEN EN_US locale with year-only pattern
    available_locales = [
        LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY")
    ]
    _mock_app_config_with_locales(monkeypatch, available_locales)
    _mock_i18n_manager_locale(monkeypatch, Locale.EN_US)

    value = "2020"
    formatted = format_date_value_for_locale(value, locale=Locale.EN_US)

    assert formatted == "2020"


def test_format_date_value_for_locale_preserves_special_values(monkeypatch):
    # GIVEN any valid locale
    available_locales = [
        LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY")
    ]
    _mock_app_config_with_locales(monkeypatch, available_locales)
    _mock_i18n_manager_locale(monkeypatch, Locale.EN_US)

    assert format_date_value_for_locale(None, locale=Locale.EN_US) is None
    assert format_date_value_for_locale("", locale=Locale.EN_US) == ""
    assert format_date_value_for_locale("Present", locale=Locale.EN_US) == "Present"
