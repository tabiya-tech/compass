import json
import os
import logging
import re
from typing import List, Optional

from pydantic import BaseModel, field_validator, model_validator

from app.i18n.types import Locale
from app.i18n.types import is_locale_supported

logger = logging.getLogger(__name__)

_LANGUAGE_CONFIG_ENV = "BACKEND_LANGUAGE_CONFIG"

# Matches:
# - single token: YYYY | YY | MM | DD
# - or 2–3 tokens separated by the same -, / or . separator
_DATE_FORMAT_REGEX = re.compile(
    r"^(YYYY|YY|MM|DD)(?:([-/.])(YYYY|YY|MM|DD)(\2(YYYY|YY|MM|DD))?)?$",
    re.IGNORECASE,
)


class LocaleDateFormatEntry(BaseModel):
    locale: Locale
    date_format: str

    @field_validator("date_format")
    @classmethod
    def validate_date_format(cls, value: str) -> str:
        """
        Validate that the date format contains recognizable tokens and separators.
        Accepted tokens: YYYY, YY, MM, DD. Separator: -, / or .
        Also ensure there are no duplicate token *types* (year, month, day).
        """
        value = value.strip()
        if not _DATE_FORMAT_REGEX.match(value):
            raise ValueError(
                "Invalid date format. Expected pattern combining YYYY|YY|MM|DD separated by -, / or ."
            )

        # forbid duplicate token types (e.g. two years, two months, etc.).
        tokens = re.split(r"[-/.]", value.upper())
        if len(tokens) == 0 or len(tokens) > 3:
            raise ValueError("Invalid date format. Expected 1 to 3 tokens.")

        # nosec so that bandit does not complain about the use of magic strings as passwords
        seen_types: set[str] = set()
        for token in tokens:
            if token in ("YYYY", "YY"):
                token_type = "year"  # nosec B105
            elif token == "MM":  # nosec B105
                token_type = "month"  # nosec B105
            elif token == "DD":  # nosec B105
                token_type = "day"  # nosec B105
            else:
                # Already covered by regex, but keep this defensive.
                raise ValueError(f"Unknown token in date format: {token}")

            if token_type in seen_types:
                raise ValueError(f"Duplicate token type '{token_type}' in date format: {value}")
            seen_types.add(token_type)

        return value


class LanguageConfig(BaseModel):
    conversation_fallback_locale: Locale
    """
    Specifies the language to be used for the conversation.
    All user-facing messages must be generated in this language.
    """

    reporting_locale: Locale
    """
    Defines the language used to generate and store report data (e.g., Experience and Skills Report) in the application state.
    """

    available_locales: List[LocaleDateFormatEntry]

    @staticmethod
    def basic_locale_validation(cfg: "LanguageConfig", name: str, locale: Locale):
        if not is_locale_supported(locale):
            raise ValueError(f"{name} {locale.value} is not a supported locale")

        if not any(entry.locale == cfg.__getattribute__(name) for entry in cfg.available_locales):
            raise ValueError(
                f"conversation_fallback_locale {cfg.conversation_fallback_locale.value} must be in available_locales"
            )

    @model_validator(mode='after')
    def ensure_locales_are_valid(self) -> 'LanguageConfig':
        # Validate conversation_fallback_locale
        LanguageConfig.basic_locale_validation(self, "conversation_fallback_locale", self.conversation_fallback_locale)

        # Validate reporting_locale
        LanguageConfig.basic_locale_validation(self, "reporting_locale", self.reporting_locale)

        return self


_cached_config: Optional[LanguageConfig] = None


def _load_config_from_env() -> LanguageConfig:
    env_value = os.getenv(_LANGUAGE_CONFIG_ENV)
    if not env_value:
        raise RuntimeError(f"{_LANGUAGE_CONFIG_ENV} must be set")

    try:
        parsed = json.loads(env_value)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in {_LANGUAGE_CONFIG_ENV}: {e}") from e

    config = LanguageConfig.model_validate(parsed)
    logger.info(
        "Loaded BACKEND_LANGUAGE_CONFIG with conversation_fallback_locale=%s, reporting_locale=%s, %d available locales",
        config.conversation_fallback_locale.value,
        config.reporting_locale.value,
        len(config.available_locales)
    )
    return config


def load_language_config_from_env() -> LanguageConfig:
    """
    Returns the language config loaded from BACKEND_LANGUAGE_CONFIG.
    Caches the result. Raises if missing or invalid to mirror default-locale strictness.
    """
    global _cached_config

    if _cached_config is not None:
        return _cached_config

    _cached_config = _load_config_from_env()
    return _cached_config


def reset_language_config_cache():
    """
    Clear the cache of the config.
    """
    global _cached_config
    _cached_config = None
