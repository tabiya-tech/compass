from collections.abc import Sequence
from typing import Mapping


def _is_falsy(value):
    """Returns True if value is falsy (None, False, '', [], {}, or a dict/list containing only falsy values)."""
    if value in (None, False, "", [], {}):
        return True
    if isinstance(value, dict):  # Check recursively if all values are falsy
        return all(_is_falsy(v) for v in value.values())
    if isinstance(value, list) or isinstance(value, tuple):  # Check for lists
        return all(_is_falsy(v) for v in value)
    return False  # If any value is truthy, return False


def will_patch(_new, _old):
    """
    Determines whether `_new` will cause a change if applied as a patch to `_old`.

    Patch Rules:
    1. `_new` is a patch – only keys present in `_new` are checked. Keys missing in `_new` are ignored (not compared).
    3. If a key in `_new` has a falsy value (None, False, "", [], {}), it will cause a patch if:
       - The key does exist in `_old` but contains a truthy value.
       - If the key does not exist in `_old`, it does NOT trigger a patch.
    4. If `_new` has a non-falsy value, `_old` must either:
       - Contain the same value (no patch needed).
       - Contain a different value (patch needed).
    5. Nested structures (dicts/lists) are compared recursively.

    :param _new: The patch/update (dict, list, or value).
    :param _old: The original structure (dict, list, or value).
    :return: True if `_new` will cause a patch, False otherwise

    """

    # If `_new == _old`, no patch is needed (return False)
    if _new == _old:
        return False

    # If `_new` is falsy, a patch is only needed if `_old` contains a **truthy** value.
    if _is_falsy(_new):
        return not _is_falsy(_old)  # A patch is needed if `_old` is truthy.

    # If both objects are dictionaries, check recursively
    if isinstance(_new, Mapping) and isinstance(_old, Mapping):
        for key in _new.keys():  # Only check keys present in `_new`
            if will_patch(_new[key], _old.get(key, None)):  # Default `_old` value to None
                return True  # A patch is needed if at least one key changes
        return False  # No changes found in `_new`

    # If both objects are lists/sequences, check element by element
    elif isinstance(_new, Sequence) and not isinstance(_new, (str, bytes)) and \
            isinstance(_old, Sequence) and not isinstance(_old, (str, bytes)):
        if len(_new) != len(_old):  # Different lengths mean a patch is needed
            return True

        return any(will_patch(v1, v2) for v1, v2 in zip(_new, _old))  # Check for element changes

    # If `_new` and `_old` are different values, a patch is needed.
    return True
