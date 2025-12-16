import pytest

from app.i18n.locale_date_format import (
    _derive_patterns,
    reset_date_format_cache,
    get_locale_date_format,
    format_date_value_for_locale,
)
from app.i18n.language_config import LanguageConfig, LocaleDateFormatEntry
from app.i18n.types import Locale


@pytest.fixture(autouse=True)
def _clear_cache(monkeypatch):
    """Ensure each test runs with a clean date-format cache."""
    reset_date_format_cache()
    yield
    reset_date_format_cache()


def _mock_app_config(monkeypatch, language_config: LanguageConfig):
    """Helper to mock get_application_config with a given language_config."""
    fake_app_config = type("AppConfig", (), {"language_config": language_config})()
    monkeypatch.setattr("app.i18n.locale_date_format.get_application_config", lambda: fake_app_config)


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
    # GIVEN a language_config with a specific format for EN_US
    cfg = LanguageConfig(
        default_locale=Locale.EN_US,
        available_locales=[LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY")],
    )
    _mock_app_config(monkeypatch, cfg)

    fmt = get_locale_date_format(Locale.EN_US)

    assert fmt.full == "MM/DD/YYYY"
    assert fmt.month_year == "MM/YYYY"
    assert fmt.year_only == "YYYY"


def test_get_locale_date_format_falls_back_to_default_when_locale_missing(monkeypatch):
    # GIVEN config only has EN_US, but we request EN_GB
    cfg = LanguageConfig(
        default_locale=Locale.EN_US,
        available_locales=[LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY")],
    )
    _mock_app_config(monkeypatch, cfg)

    fmt = get_locale_date_format(Locale.EN_GB)

    # THEN we fall back to default_locale's pattern
    assert fmt.full == "MM/DD/YYYY"


def test_format_date_value_for_locale_full_date_en_us(monkeypatch):
    # GIVEN EN_US config with full pattern MM/DD/YYYY
    cfg = LanguageConfig(
        default_locale=Locale.EN_US,
        available_locales=[LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY")],
    )
    _mock_app_config(monkeypatch, cfg)

    value = "2020/06/05"  # canonical (YYYY/MM/DD)
    formatted = format_date_value_for_locale(value, locale=Locale.EN_US)

    assert formatted == "06/05/2020"


def test_format_date_value_for_locale_year_month_only(monkeypatch):
    # GIVEN EN_US config with MM/DD/YYYY (month_year derived as MM/YYYY)
    cfg = LanguageConfig(
        default_locale=Locale.EN_US,
        available_locales=[LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY")],
    )
    _mock_app_config(monkeypatch, cfg)

    value = "2020/06"
    formatted = format_date_value_for_locale(value, locale=Locale.EN_US)

    assert formatted == "06/2020"


def test_format_date_value_for_locale_year_only(monkeypatch):
    # GIVEN EN_US config with year-only pattern
    cfg = LanguageConfig(
        default_locale=Locale.EN_US,
        available_locales=[LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY")],
    )
    _mock_app_config(monkeypatch, cfg)

    value = "2020"
    formatted = format_date_value_for_locale(value, locale=Locale.EN_US)

    assert formatted == "2020"


def test_format_date_value_for_locale_preserves_special_values(monkeypatch):
    # GIVEN any valid config
    cfg = LanguageConfig(
        default_locale=Locale.EN_US,
        available_locales=[LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY")],
    )
    _mock_app_config(monkeypatch, cfg)

    assert format_date_value_for_locale(None, locale=Locale.EN_US) is None
    assert format_date_value_for_locale("", locale=Locale.EN_US) == ""
    assert format_date_value_for_locale("Present", locale=Locale.EN_US) == "Present"
