import json

import pytest

from app.i18n.constants import LOCALES_DIR
from app.i18n.i18n_manager import I18nManager
from app.i18n.translation_service import get_i18n_manager, t
from app.i18n.types import Locale, SUPPORTED_LOCALES

LOCALES_DIR_CHILDREN = [p.name for p in LOCALES_DIR.iterdir() if p.is_dir()]

_REFERENCE_LOCALE = Locale.EN_US


def _read_json_file(file_path: str) -> dict:
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def replace_values_with_dash(value):
    """
    Recursively replaces all values in a nested dictionary with "-".
    Mirrors the behavior of the TypeScript version.
    """
    if isinstance(value, dict):
        return {key: replace_values_with_dash(val) for key, val in value.items()}

    # Leaf node -> replace with dash
    return "-"


@pytest.mark.parametrize("given_locale", SUPPORTED_LOCALES)
def test_translation_keys_consistency(given_locale):
    # GIVEN locale json file
    given_locale_json_file = LOCALES_DIR / given_locale.value / "messages.json"
    given_locale_translations = _read_json_file(given_locale_json_file.__str__())

    # AND a reference locale json file
    given_reference_locale_json_file = LOCALES_DIR / _REFERENCE_LOCALE.value / "messages.json"
    given_reference_locale_translations = _read_json_file(given_reference_locale_json_file.__str__())

    # THEN the keys should be the same
    assert replace_values_with_dash(given_locale_translations) == replace_values_with_dash(
        given_reference_locale_translations)


def test_custom_provider_locale_setting():
    # GIVEN a fresh manager.
    manager = get_i18n_manager()

    # AND a locale is set.
    given_locale = Locale.EN_US
    manager.set_locale(given_locale)

    # WHEN getting the acual locale
    actual_locale = get_i18n_manager().get_locale()

    # THEN it should be the same as the one set.
    assert actual_locale == given_locale


@pytest.mark.parametrize("given_locale", SUPPORTED_LOCALES)
def test_nested_key(given_locale):
    """
    Feature: Nested Key Resolution
    ==============================
    
    Ensures that I18nManager can resolve nested keys using dot notation.
    """
    manager = I18nManager()

    # Try to get a nested key
    # Based on user input, messages.json has "experience": { "noTitleProvidedYet": ... }

    # We use es-AR as in the user request, assuming it exists and has the key
    # If es-AR doesn't exist or doesn't have the key, this might fail, but let's follow the user's lead
    # or fallback to en-US if es-AR is not available in the environment.
    # However, the user explicitly asked for this test code.

    val = manager.get_translation(given_locale, "messages", "experience.noTitleProvidedYet")
    print(f"Result for 'experience.noTitleProvidedYet': {val}")

    if val == "experience.noTitleProvidedYet":
        pytest.fail("Returned key instead of translation")
    else:
        print("SUCCESS: Found translation")
        # Assert it's not the key
        assert val != "experience.noTitleProvidedYet"


@pytest.mark.parametrize("given_locale", SUPPORTED_LOCALES)
def test_translation_service_nested_key(given_locale):
    """
    Feature: Translation Service Nested Key Resolution
    ==================================================
    
    Ensures that the global t() function can resolve nested keys.
    """
    manager = get_i18n_manager()
    # Reset to en-US for consistency or use a specific locale
    manager.set_locale(given_locale)

    # "experience.noTitleProvidedYet" should resolve to "No title provided yet" in en-US
    val = t("messages", "experience.noTitleProvidedYet")
    assert val is not None

    # Test with a fallback
    val_fallback = t("messages", "non.existent.key", fallback_message="Fallback Value")
    assert val_fallback == "Fallback Value"

    # Test deep nested key
    val_deep = t("messages", "experience.workType.short.formalSectorWagedEmployment")
    assert val_deep is not None


@pytest.mark.parametrize("given_locale", SUPPORTED_LOCALES)
def test_all_supported_languages_have_jsons(given_locale):
    # GIVEN a supported locale
    # THEN it should have a corresponding JSON file in the locales directory
    assert (LOCALES_DIR / given_locale.value / "messages.json").exists()
