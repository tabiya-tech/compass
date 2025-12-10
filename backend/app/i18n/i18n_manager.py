
import json
import logging
import os
import argparse
from typing import Dict, Any, Set, Optional
from collections import defaultdict
from app.i18n.types import Locale
from app.i18n.constants import LOCALES_DIR, DEFAULT_FALLBACK_LOCALE
from app.context_vars import user_language_ctx_var



class I18nManager:
    def __init__(self):
        self.translations: Dict[Locale, Dict[str, Any]] = {}
        self.load_translations()
        self._logger = logging.getLogger(self.__class__.__name__)

    def get_locale(self) -> Locale:
        try:
            return user_language_ctx_var.get()
        except LookupError as e:
            self._logger.exception(e)
            raise

    def set_locale(self, locale: Locale) -> Locale:
        self._logger.debug(f"Setting locale to {locale.name}")
        user_language_ctx_var.set(locale)
        return locale

    def load_translations(self):
        """
        Loads all translation files from the locales directory.
        """
        if not os.path.isdir(LOCALES_DIR):
            self._logger.warning(f"Locales directory does not exist: {self.locales_dir}")
            return

        for locale in os.listdir(LOCALES_DIR):
            locale_path = os.path.join(LOCALES_DIR, locale)
            if os.path.isdir(locale_path):
                self.translations[Locale.from_locale_str(locale)] = {}
                for domain_file in os.listdir(locale_path):
                    if domain_file.endswith(".json"):
                        domain = domain_file[:-5]
                        file_path = os.path.join(locale_path, domain_file)
                        try:
                            with open(file_path, "r", encoding="utf-8") as f:
                                self.translations[Locale.from_locale_str(locale)][domain] = json.load(f)
                        except (json.JSONDecodeError, IOError) as e:
                            self._logger.warning(f"Could not load translation file {file_path}: {e}")

    def get_translation(self, locale: Locale, domain: str, key: str, fallback_message: str = "") -> Any:
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

        self._logger.error(f"Failed to get the translation for "
                           f"locale: {locale.name} "
                           f"key: {key}. "
                           f"Using fallback message: {fallback_message}.")

        return fallback_message

    def t(self, domain: str, key: str, **kwargs) -> str:
        """
        Convenience method to get a translation using the current locale from the locale provider.

        Args:
            domain: The translation domain (e.g., 'prompts', 'errors').
            key: The translation key.
            **kwargs: Currently unused, reserved for future string formatting support.

        Returns:
            The translated string.
        """
        locale = self.get_locale()
        return self.get_translation(locale, domain, key)

    def verify_keys(self) -> bool:
        """
        Verifies that all locales have the same set of keys for each domain.

        Returns:
            True if all locales have consistent keys, False otherwise.
        """
        all_keys: Dict[str, Set[str]] = defaultdict(set)
        reference_locale = DEFAULT_FALLBACK_LOCALE if DEFAULT_FALLBACK_LOCALE in self.translations else next(iter(self.translations), None)
        if not reference_locale:
            self._logger.warning("No locales found to verify.")
            return True

        self._logger.info(f"Using '{reference_locale}' as the reference for verification.")
        for domain, translations in self.translations.get(reference_locale, {}).items():
            for key in translations.keys():
                all_keys[domain].add(key)

        all_good = True
        for locale, domains in self.translations.items():
            if locale == reference_locale:
                continue

            for domain, ref_keys in all_keys.items():
                if domain not in domains:
                    self._logger.error(f"Locale '{locale}' is missing domain '{domain}.json'")
                    all_good = False
                    continue

                locale_keys = set(domains[domain].keys())
                if locale_keys != ref_keys:
                    all_good = False
                    missing = ref_keys - locale_keys
                    extra = locale_keys - ref_keys
                    if missing:
                        self._logger.error(f"Locale '{locale}' in domain '{domain}' is missing keys: {missing}")
                    if extra:
                        self._logger.info(f"Locale '{locale}' in domain '{domain}' has extra keys: {extra}")

        if all_good:
            self._logger.info("Verification successful: All locales appear to have consistent keys.")

        return all_good
