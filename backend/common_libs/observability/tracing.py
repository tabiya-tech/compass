"""
The LLM tracing layer, built on Langfuse.

Everything in this module is safe to call unconditionally. When tracing is disabled — which is the
default, and always the case under pytest — every helper degrades to a cheap no-op that yields
`None`, so call sites never need to guard with `if tracing_enabled`.

Nothing here is allowed to break the request it is observing: the Langfuse client batches and
exports on its own threads, and every entry point is wrapped so that a tracing failure is logged
and swallowed rather than propagated onto the LLM path.

Typical use::

    with start_trace(name="conversation.turn", module=TraceModule.BUILD_YOUR_PROFILE.value):
        with traced_observation(name="MyAgent", as_type="agent"):
            ...

Nesting works across `asyncio.gather`, because `asyncio` copies the current context into each task
and both OpenTelemetry and Langfuse propagate through context variables.
"""

import logging
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, Iterator, Optional

from langfuse import Langfuse, propagate_attributes
from opentelemetry import trace as otel_trace_api

from app.context_vars import (
    session_id_ctx_var,
    user_id_ctx_var,
    client_id_ctx_var,
    correlation_id_ctx_var,
    turn_index_ctx_var,
    agent_type_ctx_var,
    phase_ctx_var,
    module_ctx_var,
    sub_module_ctx_var,
    treatment_group_ctx_var,
)
from common_libs.observability.config import TracingConfig
from common_libs.observability.masking import build_mask_function
from common_libs.observability.sampling import SamplingTier, should_sample

logger = logging.getLogger(__name__)

# The sentinel the context variables carry when nothing has been set. Never sent to Langfuse.
NOT_SET = ":none:"

_client: Optional[Langfuse] = None
_config: TracingConfig = TracingConfig()

# Set while inside a `suppress_tracing()` block, i.e. a unit of work that sampling decided to skip.
_suppressed_ctx_var: ContextVar[bool] = ContextVar("tracing_suppressed", default=False)


@dataclass
class _OpenTrace:
    """The root span of the trace in progress, and the tags it was opened with, so it can be annotated later."""
    root_span: Any
    tags: list[str] = field(default_factory=list)


# Set while inside a recorded `start_trace()` block.
_open_trace_ctx_var: ContextVar[Optional[_OpenTrace]] = ContextVar("open_trace", default=None)


def init_tracing(config: TracingConfig) -> None:
    """
    Initialise the tracing layer. Call once, during application startup.

    Missing credentials or an unreachable host are logged and otherwise ignored: the application
    starts and runs untraced rather than failing to boot.

    :param config: The resolved tracing configuration.
    """
    global _client, _config  # pylint: disable=global-statement
    _config = config

    if not config.enabled:
        logger.info("LLM tracing is disabled. No traces will be exported.")
        _client = None
        return

    if not config.public_key or not config.secret_key:
        logger.warning("LLM tracing is enabled but the Langfuse keys are not set. Tracing will stay off.")
        _client = None
        return

    try:
        _client = Langfuse(
            public_key=config.public_key,
            secret_key=config.secret_key,
            host=config.host,
            environment=config.environment,
            release=config.release,
            debug=config.debug,
            timeout=config.timeout,
            flush_at=config.flush_at,
            flush_interval=config.flush_interval,
            mask=build_mask_function(config),
            tracing_enabled=True,
        )
    except Exception as e:  # pylint: disable=broad-except
        logger.error("Failed to initialize the Langfuse client. Tracing will stay off. Error: %s", e, exc_info=True)
        _client = None
        return

    logger.info(
        "LLM tracing initialized. host=%s environment=%s turn_sample_rate=%s pipeline_sample_rate=%s mask_pii=%s",
        config.host, config.environment, config.turn_sample_rate, config.pipeline_sample_rate, config.mask_pii,
    )


def shutdown_tracing() -> None:
    """
    Flush any buffered observations and shut the client down.

    This must run on application shutdown. Cloud Run tears containers down aggressively, and without
    an explicit flush the last conversation's spans are simply lost.
    """
    global _client  # pylint: disable=global-statement
    if _client is None:
        return

    try:
        _client.flush()
        _client.shutdown()
        logger.info("LLM tracing flushed and shut down.")
    except Exception as e:  # pylint: disable=broad-except
        logger.warning("Failed to shut the Langfuse client down cleanly. Error: %s", e)
    finally:
        _client = None


def is_tracing_enabled() -> bool:
    """
    Whether spans created right now would actually be recorded.

    :return: True if a client is configured and the current context is not suppressed.
    """
    return _client is not None and not _suppressed_ctx_var.get()


def get_tracing_config() -> TracingConfig:
    """
    Get the configuration the tracing layer was initialised with.

    :return: The current tracing configuration; the defaults (disabled) if `init_tracing` never ran.
    """
    return _config


def get_tracing_client() -> Optional[Langfuse]:
    """
    Get the underlying Langfuse client, for the rare call site that needs the raw SDK.

    :return: The client, or None when tracing is off.
    """
    return _client


@contextmanager
def suppress_tracing() -> Iterator[None]:
    """
    Suppress span creation for the duration of the block, including in tasks spawned inside it.

    Used to drop a whole unit of work that sampling decided against, so that a skipped experience
    pipeline does not still emit its 50-odd nested LLM generations.
    """
    token = _suppressed_ctx_var.set(True)
    try:
        yield
    finally:
        _suppressed_ctx_var.reset(token)


@contextmanager
def sampled_scope(*, tier: SamplingTier, sampling_key: str) -> Iterator[bool]:
    """
    Suppress tracing for the block unless this unit of work is in the sample.

    Use this around fan-out work that produces its spans deep inside nested calls — the experience
    pipeline, for instance — where dropping the parent span alone would still leave dozens of
    orphaned generations.

    :param tier: The sampling tier the work belongs to.
    :param sampling_key: A stable key; the same key always yields the same decision.
    :return: True if the work is being traced.
    """
    if not is_tracing_enabled():
        yield False
        return

    if should_sample(tier=tier, key=sampling_key, config=_config):
        yield True
        return

    with suppress_tracing():
        yield False


def _has_active_span() -> bool:
    """
    Whether an OpenTelemetry span is active in the current context.

    Every "…_current_span" call on the Langfuse client logs a warning when there is no active span.
    That is a trap for the two helpers below, which are reached from places where no trace is open:
    `current_trace_id` runs from the log filter on *every* log record, so without this check a single
    untraced log line becomes a Langfuse warning, whose own record goes back through the filter, and
    the whole thing recurses until it raises RecursionError. Ask OpenTelemetry directly instead — it
    is the same source of truth the client consults, and it stays quiet.

    :return: True if an observation is currently active.
    """
    return otel_trace_api.get_current_span() is not otel_trace_api.INVALID_SPAN


def _clean(value: Any) -> Optional[str]:
    """
    Normalise a context variable into a trace attribute.

    The ":none:" sentinel and empty strings become None. Everything else is coerced to a string:
    session ids are ints in this codebase, and Langfuse validates propagated attributes as strings,
    warning and *dropping the value* for anything else — which silently empties the session view.
    """
    if value is None:
        return None

    text = value if isinstance(value, str) else str(value)
    if text in (NOT_SET, ""):
        return None
    return text


def current_context_metadata() -> dict:
    """
    Snapshot the observability context variables as trace metadata.

    :return: A dict of the context values that are actually set.
    """
    metadata: dict = {}
    for key, value in (
            ("module", _clean(module_ctx_var.get())),
            ("sub_module", _clean(sub_module_ctx_var.get())),
            ("agent_type", _clean(agent_type_ctx_var.get())),
            ("phase", _clean(phase_ctx_var.get())),
            ("treatment_group", _clean(treatment_group_ctx_var.get())),
            ("correlation_id", _clean(correlation_id_ctx_var.get())),
            ("client_id", _clean(client_id_ctx_var.get())),
    ):
        if value is not None:
            metadata[key] = value

    turn_index = turn_index_ctx_var.get()
    if turn_index is not None and turn_index >= 0:
        metadata["turn_index"] = turn_index

    return metadata


@contextmanager
def traced_observation(
        *,
        name: str,
        as_type: str = "span",
        input: Any = None,  # pylint: disable=redefined-builtin
        metadata: Optional[dict] = None,
        model: Optional[str] = None,
        model_parameters: Optional[dict] = None,
) -> Iterator[Any]:
    """
    Open an observation nested under whatever is currently active.

    :param name: The observation name, as it appears in the Langfuse UI.
    :param as_type: The Langfuse observation type ("span", "agent", "tool", "chain", "generation", ...).
    :param input: The input payload; masked and truncated before export.
    :param metadata: Extra metadata to attach.
    :param model: The model name, for generations.
    :param model_parameters: The generation parameters, for generations.
    :return: The Langfuse observation, or None when tracing is off — call sites must handle None.
    """
    if not is_tracing_enabled():
        yield None
        return

    try:
        manager = _client.start_as_current_observation(
            name=name,
            as_type=as_type,
            input=input,
            metadata={**current_context_metadata(), **(metadata or {})},
            model=model,
            model_parameters=_scalar_only(model_parameters),
        )
    except Exception as e:  # pylint: disable=broad-except
        logger.warning("Failed to start the '%s' observation. Continuing untraced. Error: %s", name, e)
        yield None
        return

    with manager as observation:
        yield observation


@contextmanager
def start_trace(
        *,
        name: str,
        module: str,
        sub_module: Optional[str] = None,
        user_id: Optional[Any] = None,
        session_id: Optional[Any] = None,
        input: Any = None,  # pylint: disable=redefined-builtin
        metadata: Optional[dict] = None,
        tags: Optional[list[str]] = None,
        tier: SamplingTier = SamplingTier.TURN,
) -> Iterator[Any]:
    """
    Open a root trace for one unit of user-facing work, and tag it with its module and sub module.

    The module and sub module are pushed onto their context variables for the duration of the block
    whether or not tracing is on, so that logging and any nested traces see consistent values.

    The two identities that make the Langfuse views work are the user and the session. Both default
    to the context variables the conversation routes already set, and both can be passed explicitly
    by a module whose routes do not set them, or whose session is not the Build your Profile one:

      - Build your Profile  ->  the conversation session id
      - Career Explorer     ->  ``<user id>-career-explorer``
      - Career Readiness    ->  ``<user id>-career-readiness``

    The user's RCT treatment group, when the route has bound one to `treatment_group_ctx_var`, is
    attached as a ``treatment_group:<group>`` tag and as metadata, so traces can be split by group.

    The session is also the sampling key, so a sampled session stays sampled for its whole life
    rather than producing half-recorded traces; work with no session at all (a CV upload) falls back
    to the user, and then to the trace name.

    :param name: The trace name, e.g. "conversation.turn".
    :param module: The `TraceModule` value this work belongs to.
    :param sub_module: The `TraceSubModule` value (or humanised label) within the module, if any.
    :param user_id: The user this work belongs to, when it is not already in the request context.
        Set on `user_id_ctx_var` for the duration of the block, so nested spans and log records
        report it too.
    :param session_id: The session this work belongs to, when it is not the one already in the
        request context. Set on `session_id_ctx_var` for the duration of the block, so nested spans
        and log records report it too.
    :param input: The input payload of the unit of work.
    :param metadata: Extra trace metadata.
    :param tags: Extra trace tags, on top of the module, sub module and treatment group tags.
    :param tier: The sampling tier this unit of work belongs to.
    :return: The root Langfuse observation, or None when tracing is off or the work was not sampled.
    """
    # The sub module is always pushed, even when not given, so that `annotate_trace` can refine it
    # mid-turn and the refinement still ends with the block.
    tokens = [
        (module_ctx_var, module_ctx_var.set(module)),
        (sub_module_ctx_var, sub_module_ctx_var.set(sub_module or sub_module_ctx_var.get())),
    ]
    if user_id is not None:
        tokens.append((user_id_ctx_var, user_id_ctx_var.set(user_id)))
    if session_id is not None:
        tokens.append((session_id_ctx_var, session_id_ctx_var.set(session_id)))

    try:
        if not is_tracing_enabled():
            yield None
            return

        key = _clean(session_id_ctx_var.get()) or _clean(user_id_ctx_var.get()) or name
        if not should_sample(tier=tier, key=key, config=_config):
            with suppress_tracing():
                yield None
            return

        treatment_group = _clean(treatment_group_ctx_var.get())
        grouping = {
            "module": module,
            **({"sub_module": sub_module} if sub_module else {}),
            **({"treatment_group": treatment_group} if treatment_group else {}),
        }
        all_tags = [f"{dimension}:{value}" for dimension, value in grouping.items()] + list(tags or [])

        try:
            manager = _client.start_as_current_observation(
                name=name,
                as_type="span",
                input=input,
                metadata={**current_context_metadata(), **(metadata or {})},
            )
        except Exception as e:  # pylint: disable=broad-except
            logger.warning("Failed to start the '%s' trace. Continuing untraced. Error: %s", name, e)
            yield None
            return

        with manager as root:
            # pylint cannot see through OpenTelemetry's _AgnosticContextManager decorator.
            with propagate_attributes(  # pylint: disable=not-context-manager
                    trace_name=name,
                    session_id=_clean(session_id_ctx_var.get()),
                    user_id=_clean(user_id_ctx_var.get()),
                    tags=all_tags,
                    metadata={**grouping, **(metadata or {})},
            ):
                open_trace_token = _open_trace_ctx_var.set(
                    _OpenTrace(root_span=otel_trace_api.get_current_span(), tags=list(all_tags))
                )
                try:
                    yield root
                finally:
                    _open_trace_ctx_var.reset(open_trace_token)
    finally:
        for context_var, token in reversed(tokens):
            context_var.reset(token)


def annotate_trace(
        *,
        sub_module: Optional[str] = None,
        tags: Optional[list[str]] = None,
        metadata: Optional[dict] = None,
) -> None:
    """
    Refine the trace in progress with what is only known part way through the unit of work.

    The Career Explorer, for example, only knows which sub module a turn belongs to once the sector
    classifier has run, well after its root trace was opened. The values are written onto the root
    span, which is what the Langfuse trace view and its filters read. The sub module is also pushed
    onto its context variable, so that observations opened from here on report it too; it is
    restored when the trace ends.

    A no-op when tracing is off, when the turn was not sampled, or outside `start_trace`.

    :param sub_module: The sub module the trace belongs to, replacing the one it was opened with.
    :param tags: Tags to add to the trace.
    :param metadata: Metadata to add to the trace. Values are coerced to strings.
    """
    if sub_module:
        sub_module_ctx_var.set(sub_module)

    open_trace = _open_trace_ctx_var.get()
    if open_trace is None or not is_tracing_enabled():
        return

    try:
        span = open_trace.root_span
        if not span.is_recording():
            return

        new_metadata = {**({"sub_module": sub_module} if sub_module else {}), **(metadata or {})}
        for key, value in new_metadata.items():
            if value is not None:
                span.set_attribute(f"langfuse.trace.metadata.{key}", value if isinstance(value, str) else str(value))

        new_tags = list(tags or [])
        if sub_module:
            open_trace.tags = [tag for tag in open_trace.tags if not tag.startswith("sub_module:")]
            new_tags.insert(0, f"sub_module:{sub_module}")
        open_trace.tags += [tag for tag in new_tags if tag not in open_trace.tags]
        span.set_attribute("langfuse.trace.tags", open_trace.tags)
    except Exception as e:  # pylint: disable=broad-except
        logger.warning("Failed to annotate the trace. Error: %s", e)


def record_score(*, name: str, value: float, comment: Optional[str] = None) -> None:
    """
    Attach a score to the observation that is currently active.

    Scores are billable units, so only record the ones that carry signal — a failed JSON extraction,
    a repetition trap — rather than one per successful call.

    :param name: The score name.
    :param value: The numeric score.
    :param comment: An optional explanation shown next to the score.
    """
    if not is_tracing_enabled() or not _has_active_span():
        return

    try:
        _client.score_current_span(name=name, value=value, comment=comment)
    except Exception as e:  # pylint: disable=broad-except
        logger.warning("Failed to record the '%s' score. Error: %s", name, e)


def update_observation(observation: Any, **fields: Any) -> None:
    """
    Update an observation, tolerating both a None observation and a failing SDK call.

    :param observation: The observation returned by `traced_observation`, possibly None.
    :param fields: The fields to update, as accepted by the Langfuse observation's `update`.
    """
    if observation is None:
        return

    try:
        observation.update(**fields)
    except Exception as e:  # pylint: disable=broad-except
        logger.warning("Failed to update an observation. Error: %s", e)


def current_trace_id() -> Optional[str]:
    """
    Get the id of the trace currently in progress, for correlating logs with traces.

    :return: The trace id, or None when there is no active trace.
    """
    if _client is None or not _has_active_span():
        return None

    try:
        return _client.get_current_trace_id()
    except Exception:  # pylint: disable=broad-except
        return None


def _scalar_only(parameters: Optional[dict]) -> Optional[dict]:
    """
    Keep only the values Langfuse accepts as model parameters, dropping anything exotic.
    """
    if not parameters:
        return None

    return {
        key: value
        for key, value in parameters.items()
        if isinstance(value, (str, int, float, bool)) or value is None
    }
