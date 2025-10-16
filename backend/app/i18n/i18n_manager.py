
import json
import os
import argparse
from typing import Dict, Any, Set
from collections import defaultdict

class I18nManager:
    def __init__(self, locales_dir: str = "app/i18n/locales"):
        self.locales_dir = locales_dir
        self.translations: Dict[str, Dict[str, Any]] = {}
        self.load_translations()

    def load_translations(self):
        """
        Loads all translation files from the locales directory.
        """
        if not os.path.isdir(self.locales_dir):
            return

        for locale in os.listdir(self.locales_dir):
            locale_path = os.path.join(self.locales_dir, locale)
            if os.path.isdir(locale_path):
                self.translations[locale] = {}
                for domain_file in os.listdir(locale_path):
                    if domain_file.endswith(".json"):
                        domain = domain_file[:-5]
                        file_path = os.path.join(locale_path, domain_file)
                        try:
                            with open(file_path, "r", encoding="utf-8") as f:
                                self.translations[locale][domain] = json.load(f)
                        except (json.JSONDecodeError, IOError) as e:
                            print(f"Warning: Could not load {file_path}. Error: {e}")

    def get_translation(self, locale: str, domain: str, key: str, fallback_locale: str = "en") -> str:
        """
        Retrieves a translation for a given locale, domain, and key.
        Falls back to the default locale if the key is not found or the locale/domain doesn't exist.
        If the key is not found in the fallback, it returns the key itself.
        """
        translation = self.translations.get(locale, {}).get(domain, {}).get(key)
        if translation is not None:
            return translation

        fallback_translation = self.translations.get(fallback_locale, {}).get(domain, {}).get(key)
        if fallback_translation is not None:
            return fallback_translation

        return key

    def verify_keys(self) -> bool:
        """
        Verifies that all locales have the same set of keys for each domain.
        """
        all_keys: Dict[str, Set[str]] = defaultdict(set)
        reference_locale = 'en' if 'en' in self.translations else next(iter(self.translations), None)
        if not reference_locale:
            print("No locales found to verify.")
            return True

        print(f"Using '{reference_locale}' as the reference for verification.")
        for domain, translations in self.translations.get(reference_locale, {}).items():
            for key in translations.keys():
                all_keys[domain].add(key)

        all_good = True
        for locale, domains in self.translations.items():
            if locale == reference_locale:
                continue

            for domain, ref_keys in all_keys.items():
                if domain not in domains:
                    print(f"ERROR: Locale '{locale}' is missing domain '{domain}.json'")
                    all_good = False
                    continue

                locale_keys = set(domains[domain].keys())
                if locale_keys != ref_keys:
                    all_good = False
                    missing = ref_keys - locale_keys
                    extra = locale_keys - ref_keys
                    if missing:
                        print(f"ERROR: Locale '{locale}' in domain '{domain}' is missing keys: {missing}")
                    if extra:
                        print(f"INFO: Locale '{locale}' in domain '{domain}' has extra keys: {extra}")
        
        if all_good:
            print("Verification successful: All locales appear to have consistent keys.")

        return all_good

def main():
    """Main function to run verification."""
    parser = argparse.ArgumentParser(description="I18n Manager Verification Tool")
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Check that all locales have matching keys against 'en' locale.",
    )
    args = parser.parse_args()

    manager = I18nManager(locales_dir="app/i18n/locales")

    if args.verify:
        if not manager.translations:
            print("No translations found. Please create locale files first.")
            return
        manager.verify_keys()

if __name__ == "__main__":
    main()
