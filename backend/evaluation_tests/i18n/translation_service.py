import os
import inspect
from typing import Any
from evaluation_tests.i18n.i18n_loader import get_translation
from evaluation_tests.i18n.locale_detector import get_locale

def convert_lists_to_tuples(value: Any) -> Any:
    """
    Recursively converts lists of lists (from JSON) into lists of tuples.
    Example:
        [["a", "b"], ["c", "d"]] -> [("a", "b"), ("c", "d")]
    """
    if isinstance(value, list):
        # If all elements are lists, convert to tuples
        if all(isinstance(i, list) for i in value):
            return [tuple(i) for i in value]
        # Recurse deeper for nested structures
        return [convert_lists_to_tuples(i) for i in value]
    elif isinstance(value, dict):
        return {k: convert_lists_to_tuples(v) for k, v in value.items()}
    return value


def t(key: str, **kwargs: Any) -> Any:
    """
    Retrieves a translated and formatted string or structured data
    from a JSON file located in i18n/locales, following the structure
    of the test file.
    """
    # Get the caller's file path
    caller_frame = inspect.stack()[1]
    caller_filename = caller_frame.filename

    locale = get_locale()

    # Build translation file path
    base_path, _ = os.path.splitext(caller_filename)
    base_path = base_path.replace("evaluation_tests", "evaluation_tests\\i18n\\locales")
    translation_file_path = f"{base_path}/{locale}.json"

    raw_value = get_translation(translation_file_path, key)

    if raw_value is None:
        # Fallback to 'en'
        en_translation_file_path = f"{base_path}_en.json"
        if translation_file_path != en_translation_file_path:
            raw_value = get_translation(en_translation_file_path, key)
        if raw_value is None:
            return key  # Return key if not found in 'en'

    # Convert any list-of-lists to list-of-tuples
    raw_value = convert_lists_to_tuples(raw_value)

    # Format if it's a string
    if isinstance(raw_value, str):
        try:
            return raw_value.format(**kwargs)
        except KeyError:
            return raw_value

    return raw_value
