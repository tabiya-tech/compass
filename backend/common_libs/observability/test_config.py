"""
Tests for loading the tracing configuration from the environment.
"""

from common_libs.observability.config import DEFAULT_LANGFUSE_HOST, parse_tracing_config, sanitize_environment_name

# Placeholder credentials; parse_tracing_config never contacts Langfuse.
A_PUBLIC_CREDENTIAL = "pk"
A_PRIVATE_CREDENTIAL = "sk"
A_PRIVATE_CREDENTIAL_FROM_THE_ENVIRONMENT = "sk-from-env"


class TestSanitizeEnvironmentName:
    """
    Tests for sanitize environment name.
    """

    def test_lowercases_and_replaces_unsupported_characters(self):
        """Lowercases and replaces unsupported characters."""
        # GIVEN an environment name with characters Langfuse does not accept
        given_name = "Dev Njila/Zambia"

        # WHEN the name is sanitized
        actual_name = sanitize_environment_name(given_name)

        # THEN expect a lowercase, hyphen-separated name
        assert actual_name == "dev-njila-zambia"

    def test_escapes_the_reserved_langfuse_prefix(self):
        """Escapes the reserved langfuse prefix."""
        # GIVEN an environment name starting with the reserved prefix
        given_name = "langfuse-dev"

        # WHEN the name is sanitized
        actual_name = sanitize_environment_name(given_name)

        # THEN expect the prefix to no longer be reserved
        assert not actual_name.startswith("langfuse")

    def test_returns_none_for_an_empty_name(self):
        """Returns none for an empty name."""
        # GIVEN no environment name
        given_name = "   "

        # WHEN the name is sanitized
        actual_name = sanitize_environment_name(given_name)

        # THEN expect nothing
        assert actual_name is None


class TestParseTracingConfig:
    """
    Tests for parse tracing config.
    """

    def test_defaults_to_disabled_with_no_environment_set(self):
        """Defaults to disabled with no environment set."""
        # GIVEN nothing configured
        # WHEN the configuration is parsed
        actual_config = parse_tracing_config(
            enabled=False, public_key=None, secret_key=None, host=None,
        )

        # THEN expect tracing to be off
        assert actual_config.enabled is False
        # AND expect the default host
        assert actual_config.host == DEFAULT_LANGFUSE_HOST
        # AND expect PII masking to be on by default
        assert actual_config.mask_pii is True
        # AND expect job matching not to be split out by default
        assert actual_config.split_job_matching is False

    def test_applies_the_camel_case_json_overrides(self):
        """Applies the camel case json overrides."""
        # GIVEN a JSON configuration blob using camelCase keys
        given_raw_config = '{"turnSampleRate": 0.5, "pipelineSampleRate": 0.1, "maskPii": false, "maxPayloadChars": 200}'

        # WHEN the configuration is parsed
        actual_config = parse_tracing_config(
            enabled=True, public_key=A_PUBLIC_CREDENTIAL, secret_key=A_PRIVATE_CREDENTIAL, host="https://langfuse.internal",
            raw_config=given_raw_config,
        )

        # THEN expect the overrides to be applied
        assert actual_config.turn_sample_rate == 0.5
        assert actual_config.pipeline_sample_rate == 0.1
        assert actual_config.mask_pii is False
        assert actual_config.max_payload_chars == 200
        # AND expect the credentials to come from their own variables
        assert actual_config.public_key == A_PUBLIC_CREDENTIAL
        assert actual_config.host == "https://langfuse.internal"

    def test_falls_back_to_defaults_on_unparsable_json(self):
        """Falls back to defaults on unparsable json."""
        # GIVEN a malformed configuration blob
        given_raw_config = "{not json"

        # WHEN the configuration is parsed
        actual_config = parse_tracing_config(
            enabled=True, public_key=A_PUBLIC_CREDENTIAL, secret_key=A_PRIVATE_CREDENTIAL, host=None, raw_config=given_raw_config,
        )

        # THEN expect the application to still get a usable configuration
        assert actual_config.enabled is True
        assert actual_config.turn_sample_rate == 1.0

    def test_falls_back_to_defaults_on_an_out_of_range_value(self):
        """Falls back to defaults on an out of range value."""
        # GIVEN a configuration blob with a sample rate above 1
        given_raw_config = '{"turnSampleRate": 7}'

        # WHEN the configuration is parsed
        actual_config = parse_tracing_config(
            enabled=True, public_key=A_PUBLIC_CREDENTIAL, secret_key=A_PRIVATE_CREDENTIAL, host=None, raw_config=given_raw_config,
        )

        # THEN expect the default rate rather than a boot failure
        assert actual_config.turn_sample_rate == 1.0

    def test_ignores_attempts_to_set_the_credentials_from_the_json_blob(self):
        """Ignores attempts to set the credentials from the json blob."""
        # GIVEN a configuration blob that tries to override the secret key
        given_raw_config = '{"secretKey": "sk-from-json", "enabled": true}'

        # WHEN the configuration is parsed with tracing disabled and a different key
        actual_config = parse_tracing_config(
            enabled=False, public_key=A_PUBLIC_CREDENTIAL, secret_key=A_PRIVATE_CREDENTIAL_FROM_THE_ENVIRONMENT, host=None, raw_config=given_raw_config,
        )

        # THEN expect the dedicated environment variables to win
        assert actual_config.secret_key == A_PRIVATE_CREDENTIAL_FROM_THE_ENVIRONMENT
        assert actual_config.enabled is False

    def test_sanitizes_the_environment_name(self):
        """Sanitizes the environment name."""
        # GIVEN a target environment name that Langfuse would reject
        given_environment = "Dev Njila"

        # WHEN the configuration is parsed
        actual_config = parse_tracing_config(
            enabled=True, public_key=A_PUBLIC_CREDENTIAL, secret_key=A_PRIVATE_CREDENTIAL, host=None, environment=given_environment,
        )

        # THEN expect a sanitized environment
        assert actual_config.environment == "dev-njila"
