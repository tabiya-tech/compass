"""
Client-side masking of trace payloads.

Compass prompts carry users' life stories: employers, locations, contact details and the user
profile injected via `user_profile_context_var`. This module redacts the mechanically detectable
identifiers and truncates oversized payloads *before* anything leaves the process.

This is deliberately **not** `app.sensitive_filter.sensitive_filter.obfuscate()`: that is a network
call to Google DLP per string, which is unusable inline on the hundreds of spans a single
conversation produces. The trade-off is that this masker is heuristic — it is a cost and
blast-radius control, not a guarantee that no PII is exported. A deployment that cannot export
prompt text at all should point `BACKEND_LANGFUSE_HOST` at a self-hosted instance.
"""

import logging
import re
from typing import Any

from common_libs.observability.config import TracingConfig

logger = logging.getLogger(__name__)

REDACTED_EMAIL = "[REDACTED_EMAIL]"
REDACTED_PHONE = "[REDACTED_PHONE]"
REDACTED_NUMBER = "[REDACTED_NUMBER]"
TRUNCATION_SUFFIX = "...[TRUNCATED]"

# Deeper structures than this are collapsed to a string; guards against pathological payloads.
_MAX_DEPTH = 12

_EMAIL_PATTERN = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

# A phone-shaped run: an optional country prefix followed by digits, spaces, dots, dashes and
# parentheses. The digit-count check in `_replace_phone` rejects the many short numeric runs
# (years, durations, list indices) that this pattern also matches.
_PHONE_PATTERN = re.compile(r"\+?\d[\d\s().-]{7,}\d")
_PHONE_MIN_DIGITS = 9
_PHONE_MAX_DIGITS = 15

# A bare run of digits long enough to be an identifier (national ID, account number, card number)
# rather than a quantity.
_LONG_NUMBER_PATTERN = re.compile(r"(?<!\d)\d{9,}(?!\d)")


def redact(text: str) -> str:
    """
    Redact the mechanically detectable identifiers in a string.

    :param text: The string to redact.
    :return: The string with e-mail addresses, phone numbers and long digit runs replaced.
    """
    redacted = _EMAIL_PATTERN.sub(REDACTED_EMAIL, text)
    redacted = _PHONE_PATTERN.sub(_replace_phone, redacted)
    redacted = _LONG_NUMBER_PATTERN.sub(REDACTED_NUMBER, redacted)
    return redacted


def _replace_phone(match: re.Match) -> str:
    """
    Replace a phone-shaped match only when it holds a plausible number of digits, so that
    "2020 - 2024" and similar numeric runs survive.
    """
    digit_count = sum(1 for char in match.group(0) if char.isdigit())
    if _PHONE_MIN_DIGITS <= digit_count <= _PHONE_MAX_DIGITS:
        return REDACTED_PHONE
    return match.group(0)


def truncate(text: str, max_chars: int) -> str:
    """
    Truncate a string to at most `max_chars` characters, marking that it was cut.

    :param text: The string to truncate.
    :param max_chars: The maximum number of characters to keep.
    :return: The truncated string.
    """
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + TRUNCATION_SUFFIX


def mask_value(value: Any, *, redact_pii: bool, max_chars: int, _depth: int = 0) -> Any:
    """
    Recursively mask a trace payload.

    Strings are redacted (optionally) and truncated; dicts and lists are walked; everything else is
    returned untouched so that Langfuse can serialize it.

    :param value: The payload to mask.
    :param redact_pii: Whether to redact identifiers as well as truncate.
    :param max_chars: The per-string truncation limit.
    :param _depth: Internal recursion depth guard.
    :return: The masked payload.
    """
    if _depth > _MAX_DEPTH:
        return truncate(str(value), max_chars)

    if isinstance(value, str):
        return truncate(redact(value) if redact_pii else value, max_chars)

    if isinstance(value, dict):
        return {
            key: mask_value(item, redact_pii=redact_pii, max_chars=max_chars, _depth=_depth + 1)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple, set)):
        return [mask_value(item, redact_pii=redact_pii, max_chars=max_chars, _depth=_depth + 1) for item in value]

    return value


def build_mask_function(config: TracingConfig):
    """
    Build the `mask` callable that the Langfuse client applies to every payload before export.

    The callable never raises: if masking fails for an exotic payload we drop the payload rather
    than risk exporting it unmasked, and rather than break the traced call.

    :param config: The resolved tracing configuration.
    :return: A callable matching Langfuse's `MaskFunction` protocol.
    """

    def mask(*, data: Any, **_kwargs: Any) -> Any:
        try:
            return mask_value(data, redact_pii=config.mask_pii, max_chars=config.max_payload_chars)
        except Exception as e:  # pylint: disable=broad-except
            logger.warning("Failed to mask a trace payload; dropping it. Error: %s", e)
            return "[MASKING_FAILED]"

    return mask
