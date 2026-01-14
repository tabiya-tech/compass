from enum import Enum
from typing import Optional


class DataOperation(Enum):
    """
    The operation to be performed on the experience data.
    """
    ADD = "ADD"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    NOOP = "NOOP"

    @staticmethod
    def from_string_key(operation: Optional[str]) -> Optional['DataOperation']:
        """Convert string operation to enum value."""
        if not operation:
            return None
        operation_upper = operation.upper()
        if operation_upper in DataOperation.__members__:
            return DataOperation[operation_upper]
        return None


def clean_string_field(value: Optional[any]) -> Optional[any]:
    """
    Clean a string field by removing "None" and "null" values.
    When LLMs are given instruction to return None/null for empty fields,
    They might sometimes return the string versions of these values.
    Since we don't want to present these values to the user, we clean them.
    """

    if not isinstance(value, str):
        return value

    if value.lower() in ["none", "null"]:
        return None

    if value == "None":
        return ''

    return value


