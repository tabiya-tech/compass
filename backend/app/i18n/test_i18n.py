import unittest
from collections import defaultdict
from app.i18n.i18n_manager import I18nManager

class TestI18nConsistency(unittest.TestCase):

    def test_translation_keys_consistency(self):
        """
        Tests that all translation files have the same keys as the reference 'en' locale.
        """
        manager = I18nManager(locales_dir='app/i18n/locales')
        
        # Ensure translations are loaded
        self.assertTrue(manager.translations, "No translations found. Please create locale files first.")

        reference_locale = 'en'
        self.assertIn(reference_locale, manager.translations, f"Reference locale '{reference_locale}' not found.")

        # Collect all keys from the reference locale's domains
        reference_keys_by_domain = defaultdict(set)
        reference_domains = manager.translations.get(reference_locale, {})
        for domain, translations in reference_domains.items():
            for key in translations.keys():
                reference_keys_by_domain[domain].add(key)

        error_messages = []

        # Compare each locale against the reference locale
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

        if error_messages:
            self.fail("I18n key inconsistencies found:\n" + "\n".join(error_messages))