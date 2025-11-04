from app.i18n.i18n_manager import I18nManager
from app.i18n.locale_detector import get_locale

i18n_manager = I18nManager()

def t(domain: str, key: str, locale: str = "en", **kwargs) -> str:
    """
    Retrieves a translated and formatted string.

    Args:
        domain: The translation domain (e.g., 'prompts', 'errors').
        key: The translation key.
        locale: The target locale.
        **kwargs: Values to format into the translated string.

    Returns:
        The translated and formatted string.
    """
    locale=get_locale()
    raw_string = i18n_manager.get_translation(locale, domain, key)
    
    try:
        return raw_string.format(**kwargs)
    except KeyError:
        return raw_string
