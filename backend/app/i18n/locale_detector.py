import os
import json
from typing import Optional

# This is a placeholder for the actual ConversationContext object
# from app.conversation_memory.conversation_memory_types import ConversationContext

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
    1. Locale set in the ConversationContext.
    2. Best match between 'Accept-Language' header and supported languages from BACKEND_SUPPORTED_LANGUAGES env var.
    3. The default application locale.

    Args:
        accept_language_header: The value of the 'Accept-Language' HTTP header.
        context: The current conversation context.
        default_locale: The default locale to fall back to.

    Returns:
        The detected locale string.
    """
    # 1. Check for locale in the conversation context
    if context and context.locale:
        return context.locale

    # 2. Parse supported languages from environment variable
    supported_languages_str = os.environ.get("BACKEND_SUPPORTED_LANGUAGES", '["en"]')
    try:
        supported_languages = json.loads(supported_languages_str)
        # Normalize to lowercase for case-insensitive matching
        supported_languages = [lang.lower() for lang in supported_languages]
    except (json.JSONDecodeError, TypeError):
        supported_languages = ["en"]

    # 3. Parse the Accept-Language header and find the best match
    if accept_language_header:
        # Example header: "fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5"
        languages = accept_language_header.split(',')
        for lang_part in languages:
            lang = lang_part.split(';')[0].strip().lower()
            # Exact match (e.g., 'en-us')
            if lang in supported_languages:
                return lang
            # Match primary language (e.g., 'en' from 'en-us')
            primary_lang = lang.split('-')[0]
            if primary_lang in supported_languages:
                return primary_lang

    # 4. Fallback to the default
    return default_locale
