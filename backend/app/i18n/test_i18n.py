import pytest
from collections import defaultdict
from app.i18n.i18n_manager import I18nManager


def test_translation_keys_consistency():
    """
    Feature: Translation Keys Consistency
      Ensures all translation locales contain the same keys as the reference locale ('en').

    Scenario: Validate that all translation files match the reference locale
      GIVEN the I18nManager loads all translations
      AND the reference locale "en" is available
      WHEN we compare each locale's keys with the reference
      THEN all locales must contain the same domains
      AND must not be missing any translation keys
    """

    # --- GIVEN --------------------------------------------------------------

    # GIVEN the I18nManager loads all translations
    manager = I18nManager(locales_dir="app/i18n/locales")
    assert manager.translations, "No translations found. Please create locale files first."

    # AND the reference locale "en" is available
    reference_locale = "en"
    assert reference_locale in manager.translations, f"Reference locale '{reference_locale}' not found."

    # Collect reference keys
    reference_keys_by_domain = defaultdict(set)
    reference_domains = manager.translations.get(reference_locale, {})
    for domain, translations in reference_domains.items():
        for key in translations.keys():
            reference_keys_by_domain[domain].add(key)

    # --- WHEN --------------------------------------------------------------

    # WHEN we compare each locale against the reference
    error_messages = []
    for locale, domains in manager.translations.items():
        if locale == reference_locale:
            continue

        for domain, ref_keys in reference_keys_by_domain.items():
            if domain not in domains:
                error_messages.append(f"Locale '{locale}' is missing domain '{domain}.json'")
                continue

            locale_keys = set(domains[domain].keys())
            missing_keys = ref_keys - locale_keys

            if missing_keys:
                error_messages.append(
                    f"Locale '{locale}' in domain '{domain}' is missing keys: {sorted(list(missing_keys))}"
                )

    # --- THEN --------------------------------------------------------------

    # THEN no inconsistencies should be found
    if error_messages:
        pytest.fail("I18n key inconsistencies found:\n" + "\n".join(error_messages))
