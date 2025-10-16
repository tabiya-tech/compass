import os
import json
from typing import Optional

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
    """

    supported_languages_str = os.environ.get("BACKEND_SUPPORTED_LANGUAGES", '["en"]')

    # Parse supported languages from environment variable
    try:
        supported_languages = json.loads(supported_languages_str)
        # Normalize to lowercase for case-insensitive matching
        supported_languages = [lang.lower() for lang in supported_languages]
    except (json.JSONDecodeError, TypeError):
        supported_languages = ["en"]

    # 1. Return the first language from the environment variable
    if supported_languages:
        return supported_languages[0]

    # 2. Check for locale in the conversation context
    if context and context.locale:
        return context.locale.lower()

    # 3. Parse the Accept-Language header and find the best match
    if accept_language_header:
        languages = accept_language_header.split(',')
        for lang_part in languages:
            lang = lang_part.split(';')[0].strip().lower()
            # Exact match
            if lang in supported_languages:
                return lang
            # Match primary language (e.g., 'en' from 'en-us')
            primary_lang = lang.split('-')[0]
            if primary_lang in supported_languages:
                return primary_lang

    # 4. Fallback to the default
    return default_locale
