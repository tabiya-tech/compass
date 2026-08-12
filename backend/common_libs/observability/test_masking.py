"""
Tests for the client-side masking of trace payloads.
"""

from common_libs.observability.config import TracingConfig
from common_libs.observability.masking import (
    REDACTED_EMAIL,
    REDACTED_NUMBER,
    REDACTED_PHONE,
    TRUNCATION_SUFFIX,
    build_mask_function,
    mask_value,
    redact,
    truncate,
)


class TestRedact:
    """
    Tests for redact.
    """

    def test_redacts_an_email_address(self):
        """Redacts an email address."""
        # GIVEN a prompt containing an email address
        given_text = "Contact me at jane.doe+work@example.co.uk about the role."

        # WHEN the text is redacted
        actual_text = redact(given_text)

        # THEN expect the email address to be gone
        assert "jane.doe+work@example.co.uk" not in actual_text
        # AND expect the redaction marker in its place
        assert REDACTED_EMAIL in actual_text
        # AND expect the surrounding text to survive
        assert actual_text.startswith("Contact me at ")

    def test_redacts_an_international_phone_number(self):
        """Redacts an international phone number."""
        # GIVEN a prompt containing an international phone number
        given_text = "Call me on +260 97 123 4567 tomorrow."

        # WHEN the text is redacted
        actual_text = redact(given_text)

        # THEN expect the phone number to be replaced
        assert REDACTED_PHONE in actual_text
        # AND expect no digit run from the number to survive
        assert "1234567" not in actual_text.replace(" ", "")

    def test_redacts_a_long_identifier(self):
        """Redacts a long identifier."""
        # GIVEN a prompt containing a national id
        given_text = "My national id is 123456789012."

        # WHEN the text is redacted
        actual_text = redact(given_text)

        # THEN expect the identifier to be replaced
        assert REDACTED_NUMBER in actual_text or REDACTED_PHONE in actual_text
        # AND expect the raw identifier to be gone
        assert "123456789012" not in actual_text

    def test_keeps_short_numbers_that_are_not_identifiers(self):
        """Keeps short numbers that are not identifiers."""
        # GIVEN a prompt containing a date range and a small quantity
        given_text = "I worked there from 2018 to 2020 and managed 12 people."

        # WHEN the text is redacted
        actual_text = redact(given_text)

        # THEN expect the text to be unchanged
        assert actual_text == given_text

    def test_leaves_ordinary_prose_untouched(self):
        """Leaves ordinary prose untouched."""
        # GIVEN a prompt with no identifiers in it
        given_text = "I sold vegetables at the market in Lusaka."

        # WHEN the text is redacted
        actual_text = redact(given_text)

        # THEN expect the text to be unchanged
        assert actual_text == given_text


class TestTruncate:
    """
    Tests for truncate.
    """

    def test_truncates_a_string_over_the_limit(self):
        """Truncates a string over the limit."""
        # GIVEN a string longer than the limit
        given_text = "x" * 100

        # WHEN the string is truncated to 10 characters
        actual_text = truncate(given_text, 10)

        # THEN expect the kept part plus the marker
        assert actual_text == "x" * 10 + TRUNCATION_SUFFIX

    def test_leaves_a_string_under_the_limit_alone(self):
        """Leaves a string under the limit alone."""
        # GIVEN a string shorter than the limit
        given_text = "short"

        # WHEN the string is truncated to 10 characters
        actual_text = truncate(given_text, 10)

        # THEN expect it to be unchanged
        assert actual_text == "short"


class TestMaskValue:
    """
    Tests for mask value.
    """

    def test_masks_strings_nested_in_dicts_and_lists(self):
        """Masks strings nested in dicts and lists."""
        # GIVEN a payload shaped like an LLM input, with an email buried in it
        given_payload = {
            "turns": [
                {"role": "user", "content": "write to me at jane@example.com"},
                {"role": "model", "content": "sure"},
            ],
            "temperature": 0.1,
        }

        # WHEN the payload is masked
        actual_payload = mask_value(given_payload, redact_pii=True, max_chars=1000)

        # THEN expect the nested email to be redacted
        assert REDACTED_EMAIL in actual_payload["turns"][0]["content"]
        # AND expect the structure to be preserved
        assert actual_payload["turns"][1]["content"] == "sure"
        # AND expect non-string values to pass through untouched
        assert actual_payload["temperature"] == 0.1

    def test_truncates_without_redacting_when_pii_redaction_is_off(self):
        """Truncates without redacting when pii redaction is off."""
        # GIVEN a payload with an email address
        given_payload = {"content": "jane@example.com " + "y" * 100}

        # WHEN the payload is masked with redaction off and a small limit
        actual_payload = mask_value(given_payload, redact_pii=False, max_chars=20)

        # THEN expect the email to survive
        assert "jane@example.com" in actual_payload["content"]
        # AND expect the payload to still be truncated
        assert actual_payload["content"].endswith(TRUNCATION_SUFFIX)


class TestBuildMaskFunction:
    """
    Tests for build mask function.
    """

    def test_builds_a_mask_that_applies_the_configured_policy(self):
        """Builds a mask that applies the configured policy."""
        # GIVEN a configuration with redaction on and a small payload limit
        given_config = TracingConfig(mask_pii=True, max_payload_chars=25)

        # WHEN a mask function is built and applied to a payload
        actual_masked = build_mask_function(given_config)(data="mail me at jane@example.com please")

        # THEN expect the email to be redacted
        assert "jane@example.com" not in actual_masked
        # AND expect the result to be truncated to the configured limit
        assert actual_masked.endswith(TRUNCATION_SUFFIX)

    def test_never_raises_on_an_unmaskable_payload(self):
        """Never raises on an unmaskable payload."""
        # GIVEN a configuration
        given_config = TracingConfig()

        # AND a payload that blows up while it is being walked
        class _ExplosiveMapping(dict):
            def items(self):
                raise RuntimeError("boom")

        given_payload = {"nested": _ExplosiveMapping(a=1)}

        # WHEN the payload is masked
        actual_masked = build_mask_function(given_config)(data=given_payload)

        # THEN expect a placeholder rather than an exception, so the traced call is unaffected
        assert actual_masked == "[MASKING_FAILED]"
