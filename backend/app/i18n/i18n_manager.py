
import json
import os
import argparse
from typing import Dict, Any, Set, Optional
from collections import defaultdict
from app.i18n.locale_provider import LocaleProvider

class I18nManager:
    def __init__(self, locales_dir: Optional[str] = None, locale_provider: Optional[LocaleProvider] = None):
        if locales_dir is None:
            locales_dir = os.path.join(os.path.dirname(__file__), "locales")
        self.locales_dir = locales_dir
        self.locale_provider = locale_provider or LocaleProvider()
        self.translations: Dict[str, Dict[str, Any]] = {}
        self.load_translations()

    def get_locale(self) -> str:
        return self.locale_provider.get()
    
    def set_locale(self, provider) -> str:
        self.locale_provider = provider
        return self.locale_provider.get()

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

    def get_translation(self, locale: str, domain: str, key: str, fallback_message: str = "", fallback_locale: str = "en-us") -> Any:
        """
        Retrieves a translation for a given locale, domain, and key.
        Supports dot notation for nested keys (e.g., 'category.subcategory.key').
        Falls back to the default locale if the key is not found or the locale/domain doesn't exist.
        If the key is not found in the fallback, it returns the key itself.
        """
        def resolve_key(data: Dict[str, Any], key_path: str) -> Optional[Any]:
            parts = key_path.split('.')
            curr = data
            for part in parts:
                if isinstance(curr, dict) and part in curr:
                    curr = curr[part]
                else:
                    return None
            return curr

        domain_data = self.translations.get(locale, {}).get(domain, {})
        translation = resolve_key(domain_data, key)
        
        if translation is not None:
            return translation

        fallback_domain_data = self.translations.get(fallback_locale, {}).get(domain, {})
        fallback_translation = resolve_key(fallback_domain_data, key)
        
        if fallback_translation is not None:
            return fallback_translation
        
        # fallback_default takes priority over returning the key
        if fallback_message:
            return fallback_message

        return key

    def t(self, domain: str, key: str, **kwargs) -> str:
        locale = self.locale_provider.get()
        # We can add fallback_message handling here if needed, but for now matching the requested signature
        # The user example: return self.get_translation(locale, domain, key)
        # But translation_service.py t() has fallback_message and kwargs.
        # The user asked to add t() to I18nManager.
        # "def t(self, domain: str, key: str): locale = self.locale_provider.get(); return self.get_translation(locale, domain, key)"
        # I will implement it as requested but maybe support kwargs if I replace translation_service logic with this.
        return self.get_translation(locale, domain, key)

    def verify_keys(self) -> bool:
        """
        Verifies that all locales have the same set of keys for each domain.
        """
        all_keys: Dict[str, Set[str]] = defaultdict(set)
        reference_locale = 'en-us' if 'en-us' in self.translations else next(iter(self.translations), None)
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
        help="Check that all locales have matching keys against 'en-us' locale.",
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
