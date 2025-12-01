from functools import lru_cache
from app.i18n.i18n_manager import I18nManager
from app.i18n.locale_provider import LocaleProvider,CustomProvider


@lru_cache(maxsize=1)
def get_i18n_manager() -> I18nManager:
    """
    Lazily loads and caches a single I18nManager instance.
    Translations are loaded only once and reused at runtime.
    """
    return I18nManager(locale_provider=LocaleProvider())

def reset_i18n_manager(provider):
    get_i18n_manager.cache_clear()
    return I18nManager(locale_provider=provider)

def t(domain: str, key: str, locale: str = "en-us", fallback_message: str = "", **kwargs) -> str:
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
    
    locale = i18n_manager.locale_provider.get()
    raw_string = i18n_manager.get_translation(locale, domain, key, fallback_message=fallback_message)
    
    try:
        return raw_string.format(**kwargs)
    except KeyError:
        return raw_string
