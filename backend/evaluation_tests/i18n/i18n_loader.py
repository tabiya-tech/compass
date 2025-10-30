
import json
from typing import Dict, Any

class I18nLoader:
    def __init__(self):
        self.translations: Dict[str, Dict[str, Any]] = {}

    def get_translations_for_file(self, file_path: str) -> Dict[str, Any]:
        """
        Loads a translation file and caches it.
        """
        if file_path in self.translations:
            return self.translations[file_path]

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.translations[file_path] = data
                return data
        except (json.JSONDecodeError, IOError, FileNotFoundError):
            return {}

i18n_loader = I18nLoader()

def get_translation(file_path: str, key: str) -> Any:
    """
    Retrieves a translation for a given file and key.
    """
    translations = i18n_loader.get_translations_for_file(file_path)
    # support nested keys like "add_new_experience.turns"
    keys = key.split('.')
    value = translations
    for k in keys:
        if isinstance(value, dict):
            value = value.get(k)
        else:
            return None # key path not fully resolved
    return value
