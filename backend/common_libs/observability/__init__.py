"""
LLM tracing for the Compass Connect suite.

`tracing` holds the lifecycle and the span helpers, `decorators` the one-line call-site helpers,
`config` the settings, `masking` the pre-export redaction and `sampling` the tiered sample-rate
logic. The "module" dimension the traces are grouped by lives in `app.observability`.
"""

from common_libs.observability.config import TracingConfig, parse_tracing_config
from common_libs.observability.decorators import instrument_agent_execute, traced_agent, traced_tool
from common_libs.observability.sampling import SamplingTier, should_sample
from common_libs.observability.tracing import (
    current_trace_id,
    get_tracing_client,
    get_tracing_config,
    init_tracing,
    is_tracing_enabled,
    record_score,
    sampled_scope,
    shutdown_tracing,
    start_trace,
    suppress_tracing,
    traced_observation,
    update_observation,
)

__all__ = [
    "SamplingTier",
    "TracingConfig",
    "current_trace_id",
    "get_tracing_client",
    "get_tracing_config",
    "init_tracing",
    "instrument_agent_execute",
    "is_tracing_enabled",
    "parse_tracing_config",
    "record_score",
    "sampled_scope",
    "should_sample",
    "shutdown_tracing",
    "start_trace",
    "suppress_tracing",
    "traced_agent",
    "traced_observation",
    "traced_tool",
    "update_observation",
]
