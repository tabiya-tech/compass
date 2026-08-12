"""
Configuration for the LLM tracing layer.

Mirrors the shape of `app.sentry_init.BackendSentryConfig`: a handful of dedicated environment
variables for the credentials plus one JSON blob (`BACKEND_TRACING_CONFIG`) for the tunables, so a
deployment can be re-tuned without a code change.
"""

import json
import logging
import re
from typing import Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

DEFAULT_LANGFUSE_HOST = "https://cloud.langfuse.com"

# Langfuse restricts the environment name to lowercase alphanumerics, hyphens and underscores,
# and reserves the "langfuse" prefix for its own use.
_ENVIRONMENT_ALLOWED_CHARS = re.compile(r"[^a-z0-9_-]")
_ENVIRONMENT_MAX_LENGTH = 40


class TracingConfig(BaseModel):
    """
    The resolved configuration of the tracing layer.

    An instance with `enabled=False` (the default) makes every helper in
    `common_libs.observability.tracing` a no-op, so tracing can be shipped dark.
    """

    enabled: bool = False
    """Master on/off switch. Everything else is ignored when this is False."""

    public_key: str = ""
    """The Langfuse project public key."""

    secret_key: str = ""
    """The Langfuse project secret key. Must be provisioned as a secret, never as a plain env var."""

    host: str = DEFAULT_LANGFUSE_HOST
    """
    The Langfuse ingestion host. Point this at a self-hosted instance for deployments whose prompts
    contain user PII and that carry a data-residency obligation.
    """

    environment: Optional[str] = None
    """The Langfuse environment (usually the target environment name), used to separate traces."""

    release: Optional[str] = None
    """The backend version, so a trace can be tied back to the build that produced it."""

    debug: bool = False
    """Turn on the Langfuse SDK's own debug logging."""

    turn_sample_rate: float = Field(default=1.0, ge=0.0, le=1.0)
    """
    The fraction of conversation turns (and other user-facing entry points) that are traced.
    Sampling is deterministic per session, so a sampled session stays sampled for its whole life.
    """

    pipeline_sample_rate: float = Field(default=1.0, ge=0.0, le=1.0)
    """
    The fraction of experience-pipeline runs that are traced. The pipeline fans out to roughly
    50-60 LLM calls per experience and dominates the trace volume, so it gets its own, lower rate.
    """

    mask_pii: bool = True
    """Redact e-mail addresses, phone numbers and long digit runs from payloads before they leave the process."""

    max_payload_chars: int = Field(default=10_000, gt=0)
    """
    Truncate any single string in a payload to this many characters. Taxonomy candidate lists in the
    classifiers are large and low-value; truncating them keeps ingest cost down.
    """

    split_job_matching: bool = False
    """
    Report Preference Elicitation and Recommender Advisor as their own "Job Matching" module instead
    of as part of "Build your Profile". Off by default so that a deployment reports exactly the three
    modules named in the acceptance criteria. Either way they are reported as their own `sub_module`.
    """

    flush_at: int = Field(default=512, gt=0)
    """How many observations the SDK buffers before flushing."""

    flush_interval: float = Field(default=5.0, gt=0)
    """How often, in seconds, the SDK flushes its buffer."""

    timeout: int = Field(default=10, gt=0)
    """
    Hard timeout, in seconds, on the exporter's HTTP calls. Keeps a slow or unreachable Langfuse from
    coupling its latency onto the LLM path.
    """


def sanitize_environment_name(name: Optional[str]) -> Optional[str]:
    """
    Coerce an environment name into the shape Langfuse accepts.

    :param name: The raw environment name, e.g. the value of TARGET_ENVIRONMENT_NAME.
    :return: A lowercase, Langfuse-safe environment name, or None if nothing usable was given.
    """
    if not name:
        return None

    sanitized = _ENVIRONMENT_ALLOWED_CHARS.sub("-", name.strip().lower()).strip("-")
    if not sanitized:
        return None

    if sanitized.startswith("langfuse"):
        # "langfuse" is a reserved prefix; keep the name meaningful rather than dropping it.
        sanitized = f"env-{sanitized}"

    return sanitized[:_ENVIRONMENT_MAX_LENGTH]


def parse_tracing_config(
        *,
        enabled: bool,
        public_key: Optional[str],
        secret_key: Optional[str],
        host: Optional[str],
        environment: Optional[str] = None,
        release: Optional[str] = None,
        raw_config: Optional[str] = None,
) -> TracingConfig:
    """
    Build a `TracingConfig` from the environment.

    The JSON blob uses camelCase keys to match `BACKEND_SENTRY_CONFIG`. Unknown keys are ignored and
    an unparsable blob falls back to the defaults, so a bad value can never stop the app from booting.

    :param enabled: Whether tracing is switched on (BACKEND_ENABLE_TRACING).
    :param public_key: The Langfuse public key.
    :param secret_key: The Langfuse secret key.
    :param host: The Langfuse host, defaulted when empty.
    :param environment: The target environment name.
    :param release: The backend version string.
    :param raw_config: The raw BACKEND_TRACING_CONFIG JSON string.
    :return: The resolved tracing configuration.
    """
    overrides: dict = {}
    if raw_config:
        try:
            parsed = json.loads(raw_config)
            if isinstance(parsed, dict):
                overrides = _from_camel_case(parsed)
            else:
                logger.warning("BACKEND_TRACING_CONFIG must be a JSON object. Using defaults.")
        except json.JSONDecodeError as e:
            logger.warning("Invalid BACKEND_TRACING_CONFIG JSON. Using defaults. Error: %s", e)

    try:
        return TracingConfig(
            enabled=enabled,
            public_key=public_key or "",
            secret_key=secret_key or "",
            host=host or DEFAULT_LANGFUSE_HOST,
            environment=sanitize_environment_name(environment),
            release=release,
            **overrides,
        )
    except Exception as e:  # pylint: disable=broad-except
        # A malformed override must never stop the application from starting; tracing is optional.
        logger.warning("Invalid BACKEND_TRACING_CONFIG values. Using defaults. Error: %s", e)
        return TracingConfig(
            enabled=enabled,
            public_key=public_key or "",
            secret_key=secret_key or "",
            host=host or DEFAULT_LANGFUSE_HOST,
            environment=sanitize_environment_name(environment),
            release=release,
        )


_CAMEL_CASE_BOUNDARY = re.compile(r"(?<!^)(?=[A-Z])")


def _from_camel_case(source: dict) -> dict:
    """
    Convert the camelCase keys of the JSON config to the snake_case field names of TracingConfig,
    dropping anything that is not a known field.
    """
    known_fields = set(TracingConfig.model_fields.keys())
    converted: dict = {}
    for key, value in source.items():
        snake_key = _CAMEL_CASE_BOUNDARY.sub("_", key).lower()
        if snake_key in known_fields:
            converted[snake_key] = value
        else:
            logger.warning("Ignoring unknown BACKEND_TRACING_CONFIG key '%s'.", key)

    # These are supplied from dedicated environment variables, not from the JSON blob.
    for protected in ("enabled", "public_key", "secret_key", "host", "environment", "release"):
        converted.pop(protected, None)

    return converted
