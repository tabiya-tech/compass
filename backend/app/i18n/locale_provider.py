import os
import json
from contextvars import ContextVar
from app.i18n.constants import DEFAULT_FALLBACK_LOCALE


def _get_default_locale() -> str:
    try:
        supported_languages_str = os.environ.get("BACKEND_SUPPORTED_LANGUAGES",
                                                 f'["{DEFAULT_FALLBACK_LOCALE}"]')
        supported_languages = json.loads(supported_languages_str)
        if supported_languages and isinstance(supported_languages, list):
            return supported_languages[0]
    except (json.JSONDecodeError, TypeError):
        pass
    return DEFAULT_FALLBACK_LOCALE


current_locale: ContextVar[str] = ContextVar("current_locale", default=_get_default_locale())


class LocaleProvider:
    """Primary provider used by the application."""

    def get(self) -> str:
        return current_locale.get()


class CustomProvider(LocaleProvider):
    """Injected by unit tests."""

    def __init__(self, locale: str):
        self._locale = locale

    def get(self) -> str:
        return self._locale
