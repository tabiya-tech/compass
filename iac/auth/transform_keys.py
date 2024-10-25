from typing import Any


def snake_to_camel(snake_str: str) -> str:
    """
    Convert a snake_case string to camelCase.
    """
    components = snake_str.split('_')
    return components[0] + ''.join(word.title() for word in components[1:])


def camel_to_snake(camel_str: str) -> str:
    """
    Convert a camelCase string to snake_case.
    """
    return ''.join(['_' + c.lower() if c.isupper() else c for c in camel_str]).lstrip('_')


def _convert_keys(data: Any, key_converter: callable) -> Any:
    """
    Recursively converts all keys in a dictionary or nested structure using the provided key_converter.

    Args:
        data (Any): The data to process (dictionary, list, or primitive).
        key_converter (callable): A function to convert keys (e.g., snake_to_camel or camel_to_snake).

    Returns:
        Any: A new data structure with converted keys.
    """
    if isinstance(data, dict):
        return {key_converter(k): _convert_keys(v, key_converter) for k, v in data.items()}
    elif isinstance(data, list):
        return [_convert_keys(item, key_converter) for item in data]
    else:
        return data


def convert_keys_to_camel_case(data: dict[str, Any]) -> dict[str, Any]:
    """
    Recursively converts all keys in a dictionary from snake_case to camelCase.

    Args:
        data (Dict[str, Any]): The dictionary with snake_case keys.

    Returns:
        Dict[str, Any]: A new dictionary with camelCase keys.
    """
    return _convert_keys(data, snake_to_camel)


def convert_keys_to_snake_case(data: dict[str, Any]) -> dict[str, Any]:
    """
    Recursively converts all keys in a dictionary from camelCase to snake_case.

    Args:
        data (Dict[str, Any]): The dictionary with camelCase keys.

    Returns:
        Dict[str, Any]: A new dictionary with snake_case keys.
    """
    return _convert_keys(data, camel_to_snake)


def pulumi_object_to_dict(obj: Any) -> dict[str, Any]:
    """
    Public method: Converts an object's attributes to a dictionary with camelCase keys.
    Always returns a dictionary.
    """
    result = _pulumi_object_to_dict(obj)
    if not isinstance(result, dict):
        raise TypeError("object_to_dict must return a dictionary. Internal logic failed.")
    return result


def _pulumi_object_to_dict(obj: Any) -> dict[str, Any] | list[Any] | Any:
    """
    Private helper: Recursively converts an object's attributes to camelCase keys.
    Can return a dictionary, list, or primitive value.
    """
    if isinstance(obj, dict):
        # Convert dictionary keys to camelCase
        return {snake_to_camel(k): _pulumi_object_to_dict(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        # Recursively process lists
        return [_pulumi_object_to_dict(item) for item in obj]
    elif hasattr(obj, "__dict__"):
        # Convert object's attributes to a dictionary
        return {snake_to_camel(k): _pulumi_object_to_dict(v) for k, v in vars(obj).items()}
    elif hasattr(obj, "_values"):  # For Pulumi input objects
        # Handle Pulumi objects with _values
        return {snake_to_camel(k): _pulumi_object_to_dict(v) for k, v in obj._values.items()}
    else:
        # Primitive types are returned as-is
        return obj
