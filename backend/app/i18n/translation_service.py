from functools import lru_cache
from app.i18n.i18n_manager import I18nManager
from app.i18n.locale_detector import get_locale


@lru_cache(maxsize=1)
def get_i18n_manager() -> I18nManager:
    """
    Lazily loads and caches a single I18nManager instance.
    Translations are loaded only once and reused at runtime.
    """
    return I18nManager()

def t(domain: str, key: str, locale: str = "en", fallback_message: str = "", **kwargs) -> str:
    """
    Retrieves a translated and formatted string.

    Args:
        domain: The translation domain (e.g., 'prompts', 'errors').
        key: The translation key.
        fallback_message: The default message.
        locale: The target locale.
        **kwargs: Values to format into the translated string.

    Returns:
        The translated and formatted string.
    """
    i18n_manager = get_i18n_manager()
    locale=get_locale()
    raw_string = i18n_manager.get_translation(locale, domain, key,fallback_message=fallback_message)
    
    try:
        return raw_string.format(**kwargs)
    except KeyError:
        return raw_string
