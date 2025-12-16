from dataclasses import dataclass
import logging
from typing import Optional, Dict

from app.app_config import get_application_config
from app.i18n.constants import (
    DATE_FORMAT_ISO,
    DATE_FORMAT_ISO_MONTH_YEAR,
    DATE_FORMAT_YEAR_ONLY,
)
from app.i18n.translation_service import get_i18n_manager
from app.i18n.types import Locale


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LocaleDateFormat:
    full: str
    month_year: str
    year_only: str


_DEFAULT_LOCALE_DATE_FORMAT = LocaleDateFormat(
    full=DATE_FORMAT_ISO,
    month_year=DATE_FORMAT_ISO_MONTH_YEAR,
    year_only=DATE_FORMAT_YEAR_ONLY,
)

_CONFIGURED_MAP_CACHE: Optional[Dict[Locale, LocaleDateFormat]] = None


def _derive_patterns(base: str) -> LocaleDateFormat:
    """
    Derive month/year-only patterns from a full-date pattern.
    Assumes tokens are one of YYYY/YY/MM/DD separated by a single repeated separator.
    """
    tokens = base.upper()
    separator = "-"
    for sep in ("-", "/", "."):
        if sep in tokens:
            separator = sep
            break

    parts = tokens.split(separator)
    if len(parts) < 2 or len(parts) > 3:
        raise ValueError("Invalid date format pattern")

    has_day = any(p == "DD" for p in parts)
    has_month = any(p == "MM" for p in parts)
    has_year = any(p in ("YYYY", "YY") for p in parts)

    if not has_year or not has_month:
        raise ValueError("Date format must include year and month tokens")

    full_pattern = separator.join(parts)

    if has_day:
        month_year_parts = [p for p in parts if p != "DD"]
        month_year_pattern = separator.join(month_year_parts)
    else:
        month_year_pattern = full_pattern

    year_token = next((p for p in parts if p in ("YYYY", "YY")), "YYYY")

    return LocaleDateFormat(
        full=full_pattern,
        month_year=month_year_pattern,
        year_only=year_token,
    )


def _load_configured_map() -> Dict[Locale, LocaleDateFormat]:
    global _CONFIGURED_MAP_CACHE
    if _CONFIGURED_MAP_CACHE is not None:
        return _CONFIGURED_MAP_CACHE

    cfg = get_application_config().language_config
    mapped: Dict[Locale, LocaleDateFormat] = {}
    for entry in cfg.available_locales:
        try:
            mapped[entry.locale] = _derive_patterns(entry.date_format)
        except Exception as e:  # noqa: BLE001
            logger.error(
                "Invalid date format for locale %s in BACKEND_LANGUAGE_CONFIG: %s. Using fallback.",
                entry.locale,
                e,
            )
    _CONFIGURED_MAP_CACHE = mapped
    return mapped


def reset_date_format_cache():
    """
    Clear the cache of the configured map.
    """
    global _CONFIGURED_MAP_CACHE
    _CONFIGURED_MAP_CACHE = None


def get_locale_date_format(locale: Optional[Locale] = None) -> LocaleDateFormat:
    """
    Returns the date formats for the provided locale or the active locale if none is provided.
    Prefers configured formats (BACKEND_LANGUAGE_CONFIG) with validation, then built-in defaults.
    """
    current_locale = locale or get_i18n_manager().get_locale()
    configured_map = _load_configured_map()

    if current_locale in configured_map:
        return configured_map[current_locale]

    cfg = get_application_config().language_config
    if cfg.default_locale in configured_map:
        return configured_map[cfg.default_locale]

    return _DEFAULT_LOCALE_DATE_FORMAT


def format_date_value_for_locale(value: Optional[str], locale: Optional[Locale] = None) -> Optional[str]:
    """
    Formats a canonical date string (YYYY/MM[/DD] or YYYY-MM[-DD]) into the locale-specific format.
    Leaves special values like '', None, or 'Present' unchanged.
    """
    if value is None or value == "" or value.lower() == "present":
        return value

    normalized_value = value.replace("-", "/")
    parts = normalized_value.split("/")

    if len(parts) == 0 or len(parts) > 3:
        return value

    formats = get_locale_date_format(locale)
    year = parts[0]
    month = parts[1] if len(parts) >= 2 else None
    day = parts[2] if len(parts) == 3 else None

    def _apply_pattern(pattern: str) -> str:
        formatted = pattern
        if year:
            padded_year = year.zfill(4)
            formatted = formatted.replace("YYYY", padded_year)
            formatted = formatted.replace("YY", padded_year[-2:])
        if month:
            formatted = formatted.replace("MM", month.zfill(2))
        if day:
            formatted = formatted.replace("DD", day.zfill(2))
        return formatted

    if len(parts) == 3:
        return _apply_pattern(formats.full)

    if len(parts) == 2:
        return _apply_pattern(formats.month_year)

    return _apply_pattern(formats.year_only)

