"""
Tests for the tracing layer.

The Langfuse client is wired to an in-memory OpenTelemetry exporter, so these tests assert on the
spans that would actually be exported without any network access.
"""

import asyncio
import logging
from typing import Iterator

import pytest

from app.context_vars import (
    agent_type_ctx_var,
    module_ctx_var,
    session_id_ctx_var,
    sub_module_ctx_var,
    user_id_ctx_var,
)
from common_libs.observability.config import TracingConfig
from common_libs.observability.sampling import SamplingTier
from common_libs.observability.testing import (
    FAKE_PUBLIC_CREDENTIAL,
    FAKE_PRIVATE_CREDENTIAL,
    RecordedSpans,
    TEST_TRACING_CONFIG,
    in_memory_tracing,
)

from common_libs.observability.tracing import (
    current_trace_id,
    init_tracing,
    is_tracing_enabled,
    sampled_scope,
    shutdown_tracing,
    start_trace,
    suppress_tracing,
    traced_observation,
    update_observation,
)

NO_CREDENTIAL = ""


@pytest.fixture(name="recorded_spans")
def _recorded_spans(request) -> Iterator[RecordedSpans]:
    """
    Turn tracing on for the duration of a test, exporting to memory.

    The configuration can be overridden with
    `@pytest.mark.parametrize("recorded_spans", [config], indirect=True)`.
    """
    config: TracingConfig = getattr(request, "param", None) or TEST_TRACING_CONFIG
    with in_memory_tracing(config) as recorded:
        yield recorded


class TestInitTracing:
    """
    Tests for init tracing.
    """

    def test_stays_off_when_disabled(self):
        """Stays off when disabled."""
        # GIVEN a disabled configuration
        given_config = TracingConfig(enabled=False)

        # WHEN tracing is initialized
        init_tracing(given_config)

        # THEN expect tracing to be off
        assert is_tracing_enabled() is False

    def test_stays_off_when_enabled_without_credentials(self):
        """Stays off when enabled without credentials."""
        # GIVEN a configuration that is enabled but has no keys
        given_config = TracingConfig(enabled=True, public_key=NO_CREDENTIAL, secret_key=NO_CREDENTIAL)

        # WHEN tracing is initialized
        init_tracing(given_config)

        # THEN expect tracing to stay off rather than fail
        assert is_tracing_enabled() is False

    def test_shutdown_is_safe_when_tracing_never_started(self):
        """Shutdown is safe when tracing never started."""
        # GIVEN tracing was never initialized with a client
        init_tracing(TracingConfig(enabled=False))

        # WHEN tracing is shut down
        shutdown_tracing()

        # THEN expect no error and tracing still off
        assert is_tracing_enabled() is False


class TestNoOpWhenDisabled:
    """
    Tests for no op when disabled.
    """

    def test_start_trace_yields_nothing_when_disabled(self):
        """Start trace yields nothing when disabled."""
        # GIVEN tracing is disabled
        init_tracing(TracingConfig(enabled=False))

        # WHEN a trace is started
        with start_trace(name="conversation.turn", module="Build your Profile") as actual_trace:
            # THEN expect no observation to be handed back
            assert actual_trace is None
            # AND expect the module context variable to be set regardless, for logging
            assert module_ctx_var.get() == "Build your Profile"

    def test_observation_yields_nothing_when_disabled(self):
        """Observation yields nothing when disabled."""
        # GIVEN tracing is disabled
        init_tracing(TracingConfig(enabled=False))

        # WHEN an observation is opened
        with traced_observation(name="anything") as actual_observation:
            # THEN expect no observation to be handed back
            assert actual_observation is None

    def test_update_observation_tolerates_none(self):
        """Update observation tolerates none."""
        # GIVEN no observation, as happens when tracing is off
        given_observation = None

        # WHEN it is updated
        update_observation(given_observation, output="ignored")

        # THEN expect no error
        assert True

    def test_module_context_is_restored_after_the_trace(self):
        """Module context is restored after the trace."""
        # GIVEN tracing is disabled and no module is set
        init_tracing(TracingConfig(enabled=False))
        given_module_before = module_ctx_var.get()

        # WHEN a trace is opened and closed
        with start_trace(name="conversation.turn", module="Career Readiness"):
            pass

        # THEN expect the module context variable to be back where it was
        assert module_ctx_var.get() == given_module_before

    def test_sub_module_and_session_context_are_restored_after_the_trace(self):
        """Sub module and session context are restored after the trace."""
        # GIVEN tracing is disabled and neither a sub module nor a session is set
        init_tracing(TracingConfig(enabled=False))
        given_sub_module_before = sub_module_ctx_var.get()
        given_session_before = session_id_ctx_var.get()

        # WHEN a trace is opened with both of them and closed
        with start_trace(
                name="career_readiness.turn",
                module="Career Readiness",
                sub_module="CV Development",
                session_id="conversation-1",
        ):
            # THEN expect both to be visible inside the block, so nested spans and logs report them
            assert sub_module_ctx_var.get() == "CV Development"
            assert session_id_ctx_var.get() == "conversation-1"

        # AND expect both context variables to be back where they were
        assert sub_module_ctx_var.get() == given_sub_module_before
        assert session_id_ctx_var.get() == given_session_before


class TestTraceAttributes:
    """
    Tests for trace attributes.
    """

    def test_tags_the_trace_with_its_module(self, recorded_spans):
        """Tags the trace with its module."""
        # GIVEN a Build Your Profile turn
        given_module = "Build your Profile"

        # WHEN a root trace is opened for it
        with start_trace(name="conversation.turn", module=given_module, input="hello"):
            pass

        # THEN expect the root span to be recorded
        actual_span = recorded_spans.by_name("conversation.turn")
        assert actual_span is not None
        # AND expect it to carry the module tag
        assert f"module:{given_module}" in actual_span.attributes["langfuse.trace.tags"]
        # AND expect the module to be available as trace metadata for grouping
        assert actual_span.attributes["langfuse.trace.metadata.module"] == given_module

    def test_tags_the_trace_with_its_sub_module(self, recorded_spans):
        """Tags the trace with its sub module."""
        # GIVEN a Build Your Profile turn in the preference elicitation sub module
        given_module = "Build your Profile"
        given_sub_module = "Preference Elicitation"

        # WHEN a root trace is opened for it
        with start_trace(name="conversation.turn", module=given_module, sub_module=given_sub_module):
            pass

        # THEN expect the sub module to be tagged alongside the module
        actual_span = recorded_spans.by_name("conversation.turn")
        assert f"sub_module:{given_sub_module}" in actual_span.attributes["langfuse.trace.tags"]
        # AND expect it to be available as trace metadata for grouping one level below the module
        assert actual_span.attributes["langfuse.trace.metadata.sub_module"] == given_sub_module

    def test_omits_the_sub_module_when_the_module_has_none(self, recorded_spans):
        """Omits the sub module when the module has none."""
        # GIVEN a unit of work with no sub module, such as a CV upload
        # WHEN a root trace is opened for it
        with start_trace(name="cv.extract_experiences", module="CV Upload"):
            pass

        # THEN expect no sub module tag and no sub module metadata, rather than an empty one
        actual_span = recorded_spans.by_name("cv.extract_experiences")
        assert not [tag for tag in actual_span.attributes["langfuse.trace.tags"] if tag.startswith("sub_module:")]
        assert "langfuse.trace.metadata.sub_module" not in actual_span.attributes

    def test_carries_an_explicitly_passed_session(self, recorded_spans):
        """Carries an explicitly passed session."""
        # GIVEN a Career Readiness conversation, which is not a Build Your Profile session and so
        # has no session id in the request context
        given_conversation_id = "conversation-1"

        # WHEN a root trace is opened with the conversation id as the session
        with start_trace(
                name="career_readiness.turn",
                module="Career Readiness",
                session_id=given_conversation_id,
        ):
            pass

        # THEN expect the conversation to be reported as the session, so its turns are grouped
        actual_span = recorded_spans.by_name("career_readiness.turn")
        assert actual_span.attributes["session.id"] == given_conversation_id

    def test_carries_an_explicitly_passed_user(self, recorded_spans):
        """Carries an explicitly passed user."""
        # GIVEN a module whose routes do not set the observability context variables
        given_user_id = "user-1"

        # WHEN a root trace is opened with the user passed explicitly
        with start_trace(
                name="career_explorer.turn",
                module="Career Explorer",
                user_id=given_user_id,
                session_id=f"{given_user_id}-career-explorer",
        ):
            # THEN expect the user to be visible inside the block, so nested spans and logs report it
            assert user_id_ctx_var.get() == given_user_id

        # AND expect the user to be attached to the trace
        actual_span = recorded_spans.by_name("career_explorer.turn")
        assert actual_span.attributes["user.id"] == given_user_id
        assert actual_span.attributes["session.id"] == f"{given_user_id}-career-explorer"

    def test_restores_the_user_context_after_the_trace(self, recorded_spans):
        """Restores the user context after the trace."""
        # GIVEN no user in the request context
        given_user_before = user_id_ctx_var.get()

        # WHEN a trace that passes its own user is opened and closed
        with start_trace(name="career_explorer.turn", module="Career Explorer", user_id="user-1"):
            pass

        # THEN expect the user context variable to be back where it was
        assert user_id_ctx_var.get() == given_user_before

    def test_carries_the_session_and_user_from_the_context_variables(self, recorded_spans):
        """Carries the session and user from the context variables."""
        # GIVEN a request context with a session and a user
        given_session_id = "session-abc"
        given_user_id = "user-xyz"
        session_token = session_id_ctx_var.set(given_session_id)
        user_token = user_id_ctx_var.set(given_user_id)

        try:
            # WHEN a root trace is opened
            with start_trace(name="conversation.turn", module="Build your Profile"):
                pass
        finally:
            session_id_ctx_var.reset(session_token)
            user_id_ctx_var.reset(user_token)

        # THEN expect the session and user to be attached, so the Langfuse session view works
        actual_span = recorded_spans.by_name("conversation.turn")
        assert actual_span.attributes["session.id"] == given_session_id
        assert actual_span.attributes["user.id"] == given_user_id

    def test_carries_an_integer_session_id_as_a_string(self, recorded_spans, caplog):
        """Carries an integer session id as a string."""
        # GIVEN a request context whose session id is an int, as the conversation routes set it
        given_session_id = 81182559900152
        session_token = session_id_ctx_var.set(given_session_id)

        try:
            # WHEN a root trace is opened
            with caplog.at_level(logging.WARNING, logger="langfuse"):
                with start_trace(name="conversation.turn", module="Build your Profile"):
                    pass
        finally:
            session_id_ctx_var.reset(session_token)

        # THEN expect the session id to be attached as a string
        actual_span = recorded_spans.by_name("conversation.turn")
        assert actual_span.attributes["session.id"] == str(given_session_id)
        # AND expect no warning from Langfuse, which drops a non-string attribute instead of
        # coercing it, leaving the session view empty.
        assert caplog.records == []

    def test_adds_the_extra_tags_alongside_the_module_tag(self, recorded_spans):
        """Adds the extra tags alongside the module tag."""
        # GIVEN a Career Readiness turn in a specific conversation mode
        given_tags = ["mode:instruction"]

        # WHEN a root trace is opened with those tags
        with start_trace(name="career_readiness.turn", module="Career Readiness", tags=given_tags):
            pass

        # THEN expect both the module tag and the extra tag
        actual_tags = recorded_spans.by_name("career_readiness.turn").attributes["langfuse.trace.tags"]
        assert "module:Career Readiness" in actual_tags
        assert "mode:instruction" in actual_tags

    def test_nests_observations_under_the_trace(self, recorded_spans):
        """Nests observations under the trace."""
        # GIVEN a conversation turn
        # WHEN an agent observation and a generation are opened inside it
        with start_trace(name="conversation.turn", module="Build your Profile"):
            with traced_observation(name="CollectExperiencesAgent", as_type="agent"):
                with traced_observation(name="llm", as_type="generation", model="gemini-2.5-flash") as generation:
                    update_observation(generation, output="done", usage_details={"input": 1, "output": 2, "total": 3})

        # THEN expect all three spans to have been recorded
        assert set(recorded_spans.names()) == {"conversation.turn", "CollectExperiencesAgent", "llm"}
        # AND expect them to share one trace
        actual_trace_ids = {span.context.trace_id for span in recorded_spans.all()}
        assert len(actual_trace_ids) == 1
        # AND expect the generation to carry the model and token usage
        actual_generation = recorded_spans.by_name("llm")
        assert actual_generation.attributes["langfuse.observation.model.name"] == "gemini-2.5-flash"
        assert "usage_details" in str(actual_generation.attributes)

    def test_attributes_a_span_to_the_agent_that_produced_it(self, recorded_spans):
        """Attributes a span to the agent that produced it."""
        # GIVEN an agent is running
        given_agent_type = "CollectExperiencesAgent"
        agent_token = agent_type_ctx_var.set(given_agent_type)

        try:
            # WHEN an observation is opened while that agent is active
            with start_trace(name="conversation.turn", module="Build your Profile"):
                with traced_observation(name="tool"):
                    pass
        finally:
            agent_type_ctx_var.reset(agent_token)

        # THEN expect the agent type to be on the observation, so agent-level review is possible
        actual_span = recorded_spans.by_name("tool")
        assert actual_span.attributes["langfuse.observation.metadata.agent_type"] == given_agent_type

    def test_nesting_survives_asyncio_gather(self, recorded_spans):
        """Nesting survives asyncio gather."""
        # GIVEN work that fans out with asyncio.gather, as the experience pipeline does
        async def _leaf(index: int):
            with traced_observation(name=f"leaf-{index}"):
                await asyncio.sleep(0)

        async def _run():
            with start_trace(name="conversation.turn", module="Build your Profile"):
                await asyncio.gather(*[_leaf(index) for index in range(3)])

        # WHEN the work runs
        asyncio.run(_run())

        # THEN expect every leaf to be recorded
        assert {"leaf-0", "leaf-1", "leaf-2"}.issubset(set(recorded_spans.names()))
        # AND expect them all to belong to the same trace as the root
        actual_trace_ids = {span.context.trace_id for span in recorded_spans.all()}
        assert len(actual_trace_ids) == 1

    def test_marks_a_failing_observation_as_an_error(self, recorded_spans):
        """Marks a failing observation as an error."""
        # GIVEN an observation whose work raises
        with start_trace(name="conversation.turn", module="Build your Profile"):
            with pytest.raises(RuntimeError):
                with traced_observation(name="failing"):
                    raise RuntimeError("the LLM call blew up")

        # THEN expect the failure to be recorded on the span
        actual_span = recorded_spans.by_name("failing")
        assert actual_span is not None
        assert actual_span.status.is_ok is False


class TestSuppression:
    """
    Tests for suppression.
    """

    def test_suppress_tracing_stops_spans_being_created(self, recorded_spans):
        """Suppress tracing stops spans being created."""
        # GIVEN tracing is on
        # WHEN work runs inside a suppressed scope
        with start_trace(name="conversation.turn", module="Build your Profile"):
            with suppress_tracing():
                with traced_observation(name="suppressed") as actual_observation:
                    # THEN expect no observation to be handed back
                    assert actual_observation is None

        # AND expect the suppressed span not to have been recorded
        assert "suppressed" not in recorded_spans.names()

    def test_suppression_ends_with_the_block(self, recorded_spans):
        """Suppression ends with the block."""
        # GIVEN tracing is on
        # WHEN a suppressed scope closes and more work follows
        with start_trace(name="conversation.turn", module="Build your Profile"):
            with suppress_tracing():
                pass
            with traced_observation(name="after"):
                pass

        # THEN expect the later span to be recorded
        assert "after" in recorded_spans.names()


@pytest.mark.parametrize(
    "recorded_spans",
    [TracingConfig(enabled=True, public_key=FAKE_PUBLIC_CREDENTIAL, secret_key=FAKE_PRIVATE_CREDENTIAL, host="http://localhost:1", pipeline_sample_rate=0.0)],
    indirect=True,
)
class TestPipelineSampling:
    """
    Tests for pipeline sampling.
    """

    def test_drops_the_whole_subtree_when_the_pipeline_is_not_sampled(self, recorded_spans):
        """Drops the whole subtree when the pipeline is not sampled."""
        # GIVEN a configuration that never samples the pipeline
        # WHEN a pipeline runs inside a traced conversation turn
        with start_trace(name="conversation.turn", module="Build your Profile"):
            with sampled_scope(tier=SamplingTier.PIPELINE, sampling_key="session-1:my experience") as actual_sampled:
                # THEN expect the scope to report that it is not being traced
                assert actual_sampled is False
                with traced_observation(name="experience_pipeline"):
                    with traced_observation(name="infer_occupations"):
                        pass

        # AND expect no pipeline span to have been recorded, not even the nested ones
        assert "experience_pipeline" not in recorded_spans.names()
        assert "infer_occupations" not in recorded_spans.names()
        # AND expect the conversation turn itself to still be traced
        assert "conversation.turn" in recorded_spans.names()


@pytest.mark.parametrize(
    "recorded_spans",
    [TracingConfig(enabled=True, public_key=FAKE_PUBLIC_CREDENTIAL, secret_key=FAKE_PRIVATE_CREDENTIAL, host="http://localhost:1", turn_sample_rate=0.0)],
    indirect=True,
)
class TestTurnSampling:
    """
    Tests for turn sampling.
    """

    def test_drops_an_unsampled_turn_entirely(self, recorded_spans):
        """Drops an unsampled turn entirely."""
        # GIVEN a configuration that never samples turns
        # WHEN a turn runs
        with start_trace(name="conversation.turn", module="Build your Profile") as actual_trace:
            # THEN expect no root observation
            assert actual_trace is None
            with traced_observation(name="CollectExperiencesAgent", as_type="agent"):
                pass

        # AND expect nothing at all to have been recorded for the turn
        assert recorded_spans.names() == []


@pytest.mark.parametrize(
    "recorded_spans",
    [TracingConfig(enabled=True, public_key=FAKE_PUBLIC_CREDENTIAL, secret_key=FAKE_PRIVATE_CREDENTIAL, host="http://localhost:1", turn_sample_rate=0.8)],
    indirect=True,
)
class TestSamplingKey:
    """
    Tests for what a turn is sampled on: the session, falling back to the user and then the name.

    The ids below were picked against a 0.8 rate so that the session's (or user's) decision differs
    from the one the trace name alone would have produced — otherwise the tests would pass whichever
    key the implementation used.
    """

    def test_samples_a_whole_session_together(self, recorded_spans):
        """Samples a whole session together."""
        # GIVEN a session that falls inside the sample
        given_session_id = "session-2"

        # WHEN two differently named turns of it are traced, one of which the trace name alone would
        # have excluded
        with start_trace(name="turn-one", module="Career Readiness", session_id=given_session_id):
            pass
        with start_trace(name="turn-two", module="Career Readiness", session_id=given_session_id):
            pass

        # THEN expect both to be recorded, so a session is never half-traced
        assert set(recorded_spans.names()) == {"turn-one", "turn-two"}

    def test_drops_a_whole_session_together(self, recorded_spans):
        """Drops a whole session together."""
        # GIVEN a session that falls outside the sample
        given_session_id = "session-abc"

        # WHEN a turn of it is traced, which the trace name alone would have included
        with start_trace(name="turn-one", module="Career Readiness", session_id=given_session_id):
            pass

        # THEN expect nothing to be recorded: the session decided, not the name
        assert recorded_spans.names() == []

    def test_falls_back_to_the_user_when_there_is_no_session(self, recorded_spans):
        """Falls back to the user when there is no session."""
        # GIVEN a CV extraction, which has no session, for a user that falls outside the sample
        given_user_id = "user-abc"

        # WHEN it is traced, which the trace name alone would have included
        with start_trace(name="cv.extract_experiences", module="CV Upload", user_id=given_user_id):
            pass

        # THEN expect nothing to be recorded: the user decided, so a user's extractions are sampled
        # consistently rather than one CV at a time
        assert recorded_spans.names() == []

    def test_traces_a_sampled_user_with_no_session(self, recorded_spans):
        """Traces a sampled user with no session."""
        # GIVEN a CV extraction for a user that falls inside the sample
        given_user_id = "user-2"

        # WHEN it is traced
        with start_trace(name="cv.extract_experiences", module="CV Upload", user_id=given_user_id):
            pass

        # THEN expect it to be recorded
        assert "cv.extract_experiences" in recorded_spans.names()


class TestTraceIdCorrelation:
    """
    Tests for the trace id the log filter stamps onto every log record.
    """

    def test_returns_the_id_of_the_trace_in_progress(self, recorded_spans):
        """Returns the id of the trace in progress."""
        # GIVEN tracing is on
        # WHEN a trace is in progress
        with start_trace(name="conversation.turn", module="Build your Profile"):
            actual_trace_id = current_trace_id()

        # THEN expect a trace id to correlate logs with
        assert actual_trace_id is not None

    def test_stays_quiet_when_no_trace_is_in_progress(self, recorded_spans, caplog):
        """Stays quiet when no trace is in progress."""
        # GIVEN tracing is on
        # AND no trace has been opened
        with caplog.at_level(logging.WARNING, logger="langfuse"):
            # WHEN the trace id is asked for, as the log filter does for every log record
            actual_trace_id = current_trace_id()

        # THEN expect no trace id
        assert actual_trace_id is None
        # AND expect no warning from Langfuse: the log filter asks on every record, and a warning
        # here is itself a record, which recurses back into the filter until it blows the stack.
        assert caplog.records == []
