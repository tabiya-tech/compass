import dataclasses
import datetime
import enum
import re

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel

NON_EMPTY_STRING_REGEX = re.compile(r"^\s*\S.*$")


class Matcher(ABC):
    @abstractmethod
    def matches(self, value: any) -> tuple[bool, str | None]:
        """
        Check if the value matches the matcher.
        :param value: The value to check.
        :return: A tuple containing a boolean indicating if the value matches and a string with the reason why it does not match.
        """
        pass

    def as_json(self) -> Any:
        """
        Return a value that *is already* JSON-serialisable (dict / list / str / …).
        By default, we fall back to str(self); override in subclasses if you want
        something richer.
            """
        return str(self)


class AnyValue(Matcher):
    def __init__(self):
        self.options = []

    def matches(self, value: any) -> tuple[bool, str | None]:
        return True, None

    def __str__(self):
        return f"AnyValue()"


class AnyOf(Matcher):
    def __init__(self, *args: any):
        self.options = args

    def matches(self, value: any) -> tuple[bool, str | None]:
        for option in self.options:
            if isinstance(option, re.Pattern) and isinstance(value, str) and option.match(value):
                return True, None
            elif isinstance(option, Matcher):
                match, _ = option.matches(value)
                if match:
                    return True, None
            elif option == value:
                return True, None

        return False, f"Value '{value}' does not match any of the options: [{', '.join(map(str, self.options))}]"

    def __str__(self):
        return f"AnyOf({', '.join(map(str, self.options))})"


class ContainsString(Matcher):
    def __init__(self, string: str, case_sensitive: bool = False):
        self.string = string
        self.case_sensitive = case_sensitive

    def matches(self, value: any) -> tuple[bool, str | None]:
        if not isinstance(value, str):
            return False, f"Value '{value}' is not a string"
        if self.case_sensitive:
            if self.string in value:
                return True, None
        else:
            if self.string.lower() in value.lower():
                return True, None
        return False, f"Value '{value}' does not contain '{self.string}'"

    def __str__(self):
        return f"ContainsString('{self.string}', case_sensitive={self.case_sensitive})"


class DictContaining(Matcher):
    """
    Matches if the object (dict) has all the expected
    keys with values that match the provided matchers / values.
    Extra keys are allowed.
    Example:
        DictContaining({
            "name": ContainsString("Alice"),
            "age": AnyOf(30, 31)
        })
    """

    def __init__(self, expected_dict: dict[str, Any]):
        self.expected = expected_dict

    def matches(self, value: Any):
        if not isinstance(value, dict):
            return False, f"Expected a dict, got {type(value).__name__}"
        for key, exp in self.expected.items():
            if key not in value:
                return False, f"Missing key '{key}'"
            actual = value[key]
            if isinstance(exp, Matcher):
                ok, reason = exp.matches(actual)
                if not ok:
                    return False, f"Key '{key}': {reason}"
            elif isinstance(exp, re.Pattern):
                if not (isinstance(actual, str) and exp.match(actual)):
                    return False, f"Key '{key}': '{actual}' does not match /{exp.pattern}/"
            elif isinstance(exp, dict):
                # nested DictContaining
                ok, reason = DictContaining(exp).matches(actual)
                if not ok:
                    return False, f"Key '{key}': {reason}"
            else:
                if actual != exp:
                    return False, f"Key '{key}': expected {exp!r}, got {actual!r}"
        return True, None

    def __str__(self):
        return f"DictContaining({self.expected!r})"

    def as_json(self) -> Any:
        """
        Represent the rule in plain Python types that json.dumps
        can serialise without extra help.
        """
        return {
            "DictContaining": {
                key: encode_mixed(val)  # recurse on every expected value
                for key, val in self.expected.items()
            }
        }


def check_actual_data_matches_expected(actual_data: list[BaseModel], expected_data: list[dict[str, Any]], preserve_order: bool = True) -> list[str]:
    failures: list[str] = []
    if preserve_order:
        for i, expected in enumerate(expected_data):
            if i >= len(actual_data):
                failures.append(
                    f"Expected {len(expected_data)} collected data, but got {len(actual_data)}"
                )
                break
            _failures = _check_data_matches_expected(actual_data=actual_data[i], expected_data=expected)
            failures.extend([f"[Index {i}] {f}" for f in _failures])
    else:
        from copy import deepcopy
        unmatched_actual = deepcopy(actual_data)
        match_pairs = []

        for idx, expected in enumerate(expected_data):
            best_match_index = None
            best_match_errors = None

            for i, actual in enumerate(unmatched_actual):
                errors = _check_data_matches_expected(actual, expected)
                if best_match_errors is None or len(errors) < len(best_match_errors):
                    best_match_errors = errors
                    best_match_index = i

            if best_match_index is not None:
                matched_actual = unmatched_actual.pop(best_match_index)
                match_pairs.append((idx, expected, matched_actual))
            else:
                failures.append(f"No match found for expected data at index {idx}: {expected}")

        # Strictly validate the best matches
        for idx, expected, actual in match_pairs:
            _failures = _check_data_matches_expected(actual_data=actual, expected_data=expected)
            if _failures:
                failures.extend([f"[Unordered expected index {idx}] {f}" for f in _failures])

    return failures


def _check_data_matches_expected(
        actual_data: BaseModel, expected_data: dict[str, Any]
) -> list[str]:
    data_dict = actual_data.model_dump()
    failures = []

    for key, expected_value in expected_data.items():
        if key not in data_dict:
            failures.append(f"Field '{key}' is not in CollectedData")
            continue

        actual_value = data_dict[key]
        if isinstance(expected_value, dict):
            ok, reason = DictContaining(expected_value).matches(actual_value)
        else:
            ok, reason = match_expected(actual_value, expected_value)

        reasons = [reason] if reason else []

        if not ok:
            for reason in reasons:
                failures.append(f"Field '{key}': {reason}")

    return failures


def match_expected(actual: Any, expected: Any) -> tuple[bool, str | None]:
    if isinstance(expected, Matcher):
        return expected.matches(actual)

    if isinstance(expected, re.Pattern):
        if isinstance(actual, str) and expected.match(actual):
            return True, None
        return False, f"value '{actual}' does not match regex '{expected.pattern}'"

    if actual == expected:
        return True, None

    return False, f"value '{actual}' does not match expected '{expected}'"


def encode_mixed(obj: Any):
    """
    Fallback for json.dumps(default=encode_mixed)

    – Deals with every type we expect in résumé-rule payloads:
      * Matcher hierarchy (ContainsString, AnyOf, DictContaining, ...)
      * regex -> {"regex": pattern}
      * Enum -> <name or value>
      * dates -> ISO-8601
      * sets -> list
      * dataclass -> dict (recursively json-safe)
      * Pydantic model -> dict (recursively json-safe)
    – Anything unknown still raises TypeError so you find problems early.
    """
    # All your custom matchers
    if isinstance(obj, Matcher):
        return obj.as_json()

    # regex that is *not* wrapped in a Matcher
    if isinstance(obj, re.Pattern):
        return {"regex": obj.pattern}

    # Enum → pick whichever form you want to see in JSON
    if isinstance(obj, enum.Enum):
        return obj.name  # or obj.value

    # Pydantic model
    if isinstance(obj, BaseModel):
        return obj.model_dump(mode="json")

    # Dataclass (not needed in the snippet you sent, but handy)
    if dataclasses.is_dataclass(obj):
        return dataclasses.asdict(obj)

    # A few one-liners you’ll bump into sooner or later
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()
    if isinstance(obj, (set, frozenset)):
        return list(obj)

    # fall back to str(obj)
    return str(obj)
