import pytest
from collections import defaultdict
from pathlib import Path

from app.i18n.i18n_manager import I18nManager
from app.i18n.locale_provider import CustomProvider
from app.i18n.translation_service import get_i18n_manager


def test_translation_keys_consistency():
    """
    Feature: Translation Keys Consistency
    =====================================

    Ensures that all locale directories have complete and consistent
    translation keys when compared to the reference locale ('en-us').

    Background:
      - I18nManager loads all translation JSON files recursively.
      - Each locale must contain the same *domains* (files)
        and the same *keys* inside each domain.

    Scenario: Validate translation key consistency
      GIVEN a directory of translation files
      AND the reference locale "en-us" exists
      WHEN comparing all locales to the reference
      THEN no vocabulary keys should be missing
    """

    # --- GIVEN --------------------------------------------------------------

    locales_dir = Path(__file__).parent / "locales"
    manager = I18nManager(locales_dir=str(locales_dir))

    assert manager.translations, "No translations found. Please create locale files first."

    reference = "en-us"
    assert reference in manager.translations, f"Missing reference locale '{reference}'."

    # Build reference key map
    reference_keys_by_domain = defaultdict(set)
    for domain, translations in manager.translations[reference].items():
        reference_keys_by_domain[domain].update(translations.keys())

    # --- WHEN --------------------------------------------------------------

    error_messages = []

    for locale, domains in manager.translations.items():
        if locale == reference:
            continue

        for domain, ref_keys in reference_keys_by_domain.items():
            if domain not in domains:
                error_messages.append(
                    f"Locale '{locale}' is missing domain '{domain}.json'"
                )
                continue

            locale_keys = set(domains[domain].keys())
            missing = sorted(list(ref_keys - locale_keys))

            if missing:
                error_messages.append(
                    f"Locale '{locale}' in domain '{domain}' is missing keys: {missing}"
                )

    # --- THEN --------------------------------------------------------------

    if error_messages:
        pytest.fail("I18n inconsistencies found:\n" + "\n".join(error_messages))



def test_custom_provider_locale_setting():
    """
    Feature: Overriding Locale Using CustomProvider
    ===============================================

    Demonstrates how to override the locale used by the global,
    cached I18nManager instance during testing.

    Important:
      - `get_i18n_manager()` is a singleton due to @lru_cache.
      - Therefore, overriding the locale ONLY works if `I18nManager`
        exposes a method such as `set_locale(provider)`.

    Scenario: Override locale to Spanish
      GIVEN the shared I18nManager defaulting to 'en-us'
      WHEN the locale is overridden via CustomProvider('es-es')
      THEN the active locale becomes 'es-es'
      AND subsequent translations should resolve in Spanish
    """

    # --- GIVEN --------------------------------------------------------------

    manager = get_i18n_manager()
    initial_locale = manager.get_locale()
    assert initial_locale == "en-us", (
        f"Expected initial locale 'en-us', got '{initial_locale}'"
    )

    # --- WHEN --------------------------------------------------------------

    # Only works if I18nManager implements:
    #   def set_locale(self, provider: LocaleProvider): ...
    manager.set_locale(CustomProvider("es-es"))

    # --- THEN --------------------------------------------------------------

    updated_locale = get_i18n_manager().get_locale()

    assert updated_locale == "es-es", (
        f"Expected locale 'es-es', got '{updated_locale}'"
    )
