"""
Test helpers for asserting on the spans the tracing layer produces.

Point the Langfuse client at an in-memory OpenTelemetry exporter so that tests can assert on the
spans that *would* have been exported, with no network access at all.

Langfuse keys its internal resources by public key, so a fresh client per test would silently hand
back the first client's exporter. The client here is therefore built once per process and reused.
"""

from contextlib import contextmanager
from typing import Iterator, Optional

from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter

import common_libs.observability.tracing as tracing_module
from common_libs.observability.config import TracingConfig

# Placeholder credentials. Nothing is ever sent anywhere: the client exports to memory.
FAKE_PUBLIC_CREDENTIAL = "pk-lf-compass-test"
FAKE_PRIVATE_CREDENTIAL = "sk-lf-compass-test"

TEST_TRACING_CONFIG = TracingConfig(
    enabled=True,
    public_key=FAKE_PUBLIC_CREDENTIAL,
    secret_key=FAKE_PRIVATE_CREDENTIAL,
    host="http://localhost:1",
)

_client = None  # pylint: disable=invalid-name
_exporter: Optional[InMemorySpanExporter] = None  # pylint: disable=invalid-name


class RecordedSpans:
    """A thin accessor over the in-memory exporter, so assertions read as span lookups."""

    def __init__(self, client, exporter: InMemorySpanExporter):
        self._client = client
        self._exporter = exporter

    def all(self) -> list:
        """All spans recorded so far. The Langfuse processor batches, so the buffer is drained first."""
        self._client.flush()
        return list(self._exporter.get_finished_spans())

    def names(self) -> list[str]:
        """The names of all recorded spans."""
        return [span.name for span in self.all()]

    def by_name(self, name: str):
        """The first recorded span with the given name, or None."""
        for span in self.all():
            if span.name == name:
                return span
        return None

    def trace_modules(self) -> set[str]:
        """The distinct modules the recorded spans are attributed to."""
        return self._distinct_attribute("langfuse.trace.metadata.module")

    def trace_sub_modules(self) -> set[str]:
        """The distinct sub modules the recorded spans are attributed to."""
        return self._distinct_attribute("langfuse.trace.metadata.sub_module")

    def session_ids(self) -> set[str]:
        """The distinct sessions the recorded spans are grouped into."""
        return self._distinct_attribute("session.id")

    def user_ids(self) -> set[str]:
        """The distinct users the recorded spans are attributed to."""
        return self._distinct_attribute("user.id")

    def _distinct_attribute(self, attribute: str) -> set[str]:
        """The distinct values of one span attribute, ignoring the spans that do not carry it."""
        return {
            span.attributes[attribute]
            for span in self.all()
            if attribute in span.attributes
        }


def _get_or_create_client():
    """Build the process-wide test client and exporter on first use."""
    global _client, _exporter  # pylint: disable=global-statement
    if _client is None:
        # Imported lazily so that a test run that never asserts on spans does not pay the SDK
        # import cost, and so the client is only built once per process.
        from langfuse import Langfuse  # pylint: disable=import-outside-toplevel

        _exporter = InMemorySpanExporter()
        _client = Langfuse(
            public_key=TEST_TRACING_CONFIG.public_key,
            secret_key=TEST_TRACING_CONFIG.secret_key,
            host=TEST_TRACING_CONFIG.host,
            span_exporter=_exporter,
            flush_interval=600,
        )
    return _client, _exporter


@contextmanager
def in_memory_tracing(config: Optional[TracingConfig] = None) -> Iterator[RecordedSpans]:
    """
    Turn tracing on for the duration of the block, exporting to memory.

    :param config: The tracing configuration to run under; defaults to fully sampled with masking on.
    :return: An accessor over the spans recorded inside the block.
    """
    client, exporter = _get_or_create_client()
    exporter.clear()

    previous_client = tracing_module._client  # pylint: disable=protected-access
    previous_config = tracing_module._config  # pylint: disable=protected-access

    tracing_module._client = client  # pylint: disable=protected-access
    tracing_module._config = config or TEST_TRACING_CONFIG  # pylint: disable=protected-access

    try:
        yield RecordedSpans(client, exporter)
    finally:
        tracing_module._client = previous_client  # pylint: disable=protected-access
        tracing_module._config = previous_config  # pylint: disable=protected-access
