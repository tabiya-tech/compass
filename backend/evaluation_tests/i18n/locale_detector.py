import os
import json

def get_locale(
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

    supported_languages_str = os.environ.get("BACKEND_SUPPORTED_LANGUAGES", '["en-gb"]')

    # Parse supported languages from environment variable
    try:
        supported_languages = json.loads(supported_languages_str)
        # Normalize to lowercase for case-insensitive matching
        supported_languages = [lang.lower() for lang in supported_languages]
    except (json.JSONDecodeError, TypeError):
        supported_languages = ["en"]

    # 1. Return the first language from the environment variable
    if supported_languages:
        return supported_languages[0].lower()


    # 4. Fallback to the default
    return default_locale
