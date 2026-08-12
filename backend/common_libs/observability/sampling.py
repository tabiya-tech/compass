"""
Tiered, deterministic sampling for LLM traces.

Compass emits roughly 650 billable Langfuse units per completed Build Your Profile conversation,
and about 80% of those come from the experience pipeline, which fans out to 50-60 LLM calls per
experience. Sampling is therefore a first-class part of the design rather than an optimisation, and
the pipeline gets its own, lower rate than the user-facing conversation turns.

The decision is derived from a hash of a stable key (the session id, the experience id, ...) rather
than from a random draw. That means:
  - a sampled session stays sampled for its whole life, so a trace is never half-recorded;
  - the same conversation is sampled identically across processes and restarts;
  - the behaviour is testable without patching the random module.
"""

import hashlib
from enum import Enum

from common_libs.observability.config import TracingConfig

_HASH_BYTES = 8
_HASH_SPACE = 2 ** (_HASH_BYTES * 8)


class SamplingTier(Enum):
    """
    The kind of work being sampled. Each tier has its own rate in `TracingConfig`.
    """

    TURN = "turn"
    """A user-facing entry point: a conversation turn, a CV upload, a career-readiness message."""

    PIPELINE = "pipeline"
    """A fan-out batch job, i.e. the experience linking and ranking pipeline."""


def rate_for_tier(tier: SamplingTier, config: TracingConfig) -> float:
    """
    Get the configured sample rate for a tier.

    :param tier: The sampling tier.
    :param config: The resolved tracing configuration.
    :return: The sample rate, between 0.0 and 1.0.
    """
    if tier == SamplingTier.PIPELINE:
        return config.pipeline_sample_rate
    return config.turn_sample_rate


def hash_to_unit_interval(key: str) -> float:
    """
    Map an arbitrary key onto [0.0, 1.0) deterministically and uniformly.

    :param key: The sampling key, e.g. a session id.
    :return: A float in [0.0, 1.0).
    """
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    return int.from_bytes(digest[:_HASH_BYTES], "big") / _HASH_SPACE


def should_sample(*, tier: SamplingTier, key: str, config: TracingConfig) -> bool:
    """
    Decide whether a unit of work should be traced.

    :param tier: The sampling tier the work belongs to.
    :param key: A stable key for the unit of work; the same key always yields the same decision.
    :param config: The resolved tracing configuration.
    :return: True if the work should be traced.
    """
    rate = rate_for_tier(tier, config)
    if rate >= 1.0:
        return True
    if rate <= 0.0:
        return False

    # Salt with the tier so that a session sampled for its turns is not automatically sampled for
    # its pipeline runs — otherwise the two rates would not be independent.
    return hash_to_unit_interval(f"{tier.value}:{key}") < rate
