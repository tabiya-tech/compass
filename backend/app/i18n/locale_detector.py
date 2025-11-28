import os
import json
from typing import Optional
from contextvars import ContextVar

# Global context variable for locale
current_locale: ContextVar[str] = ContextVar("current_locale", default="en")


class ConversationContext:
    def __init__(self, locale: Optional[str] = None):
        self.locale = locale


def get_locale(
    accept_language_header: Optional[str] = None,
    context: Optional[ConversationContext] = None,
    default_locale: str = "en"
) -> str:
    """
    Detects the best locale based on a priority order.

    Priority:
    1. First language defined in BACKEND_SUPPORTED_LANGUAGES env var.
    2. Locale set in the ConversationContext.
    3. Best match between 'Accept-Language' header and supported languages.
    4. The default application locale.

    Result is stored in a ContextVar (`current_locale`) so any module
    can retrieve it without passing parameters.
    """

    # Load supported languages from env
    supported_languages_str = os.environ.get("BACKEND_SUPPORTED_LANGUAGES", '["en"]')

    try:
        supported_languages = json.loads(supported_languages_str)
        supported_languages = [lang.lower() for lang in supported_languages]
    except (json.JSONDecodeError, TypeError):
        supported_languages = ["en"]

    chosen_locale: Optional[str] = None

    # 1. First language from env var takes highest priority
    if supported_languages:
        chosen_locale = supported_languages[0]

    # 2. Locale from conversation context
    if context and context.locale:
        chosen_locale = context.locale.lower()

    # 3. Check Accept-Language header if we still have no locale
    if not chosen_locale and accept_language_header:
        languages = accept_language_header.split(',')
        for lang_part in languages:
            lang = lang_part.split(';')[0].strip().lower()

            # Exact match
            if lang in supported_languages:
                chosen_locale = lang
                break

            # Primary language (e.g. "en" from "en-US")
            primary_lang = lang.split('-')[0]
            if primary_lang in supported_languages:
                chosen_locale = primary_lang
                break

    # 4. Default fallback
    if not chosen_locale:
        chosen_locale = default_locale

    # Store locale in ContextVar so other parts of the system can access it
    current_locale.set(chosen_locale)

    return chosen_locale


def get_locale_hint(purpose: str) -> str:
    """Return a locale guidance string for prompts, defaulting to Spanish."""
    locale = get_locale(default_locale="es") or "es"
    locale_lower = locale.lower()
    if locale_lower.startswith("es"):
        return f"Detected locale: Spanish. Keep {purpose} entirely in Spanish."
    return f"Detected locale: {locale}. Keep {purpose} entirely in this language."
