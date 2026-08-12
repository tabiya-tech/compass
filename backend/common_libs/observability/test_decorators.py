"""
Tests for the agent and tool tracing decorators, which are what make agent-level attribution work.
"""

import pytest

from app.context_vars import agent_type_ctx_var
from common_libs.observability.decorators import instrument_agent_execute, traced_agent, traced_tool
from common_libs.observability.testing import in_memory_tracing


class _FakeAgentType:
    """Stands in for an AgentType enum member without dragging the agent package into the test."""

    def __init__(self, value: str):
        self.value = value


class _FakeAgent:
    def __init__(self, agent_type: str):
        self.agent_type = _FakeAgentType(agent_type)
        self.observed_agent_type: str | None = None

    @traced_agent()
    async def execute(self, user_input: str) -> str:
        """Record the agent type that was in context while the agent ran."""
        self.observed_agent_type = agent_type_ctx_var.get()
        return f"handled: {user_input}"


class TestTracedAgent:
    """
    Tests for traced agent.
    """

    @pytest.mark.asyncio
    async def test_opens_an_agent_observation_named_after_the_agent(self):
        """Opens an agent observation named after the agent."""
        # GIVEN an agent whose type is known
        given_agent = _FakeAgent("CollectExperiencesAgent")

        # WHEN the agent executes under tracing
        with in_memory_tracing() as recorded_spans:
            await given_agent.execute("hello")

        # THEN expect an observation named after the agent
        actual_span = recorded_spans.by_name("CollectExperiencesAgent")
        assert actual_span is not None
        # AND expect it to be typed as an agent
        assert actual_span.attributes["langfuse.observation.type"] == "agent"
        # AND expect the agent type in the metadata, so agent-level review is possible
        assert actual_span.attributes["langfuse.observation.metadata.agent_type"] == "CollectExperiencesAgent"

    @pytest.mark.asyncio
    async def test_sets_the_agent_type_context_variable_while_executing(self):
        """Sets the agent type context variable while executing."""
        # GIVEN an agent that reports the agent type it sees while running
        given_agent = _FakeAgent("SkillsExplorerAgent")

        # WHEN the agent executes
        await given_agent.execute("hello")

        # THEN expect the context variable to have been set during execution
        assert given_agent.observed_agent_type == "SkillsExplorerAgent"

    @pytest.mark.asyncio
    async def test_restores_the_previous_agent_type_afterwards(self):
        """Restores the previous agent type afterwards."""
        # GIVEN an outer agent type is already set, as the agent director does
        given_outer_agent_type = "ExploreExperiencesAgentDirector"
        token = agent_type_ctx_var.set(given_outer_agent_type)

        try:
            # WHEN a nested agent executes
            await _FakeAgent("CollectExperiencesAgent").execute("hello")

            # THEN expect the outer agent type to be restored
            assert agent_type_ctx_var.get() == given_outer_agent_type
        finally:
            agent_type_ctx_var.reset(token)

    @pytest.mark.asyncio
    async def test_records_the_output_on_the_observation(self):
        """Records the output on the observation."""
        # GIVEN an agent
        given_agent = _FakeAgent("WelcomeAgent")

        # WHEN it executes under tracing
        with in_memory_tracing() as recorded_spans:
            await given_agent.execute("hi")

        # THEN expect its return value to be recorded as the observation output
        actual_span = recorded_spans.by_name("WelcomeAgent")
        assert actual_span.attributes["langfuse.observation.output"] == "handled: hi"

    @pytest.mark.asyncio
    async def test_uses_an_explicit_agent_type_when_given(self):
        """Uses an explicit agent type when given."""
        # GIVEN a class that has no agent_type attribute, like the Career Readiness agent
        class _StandaloneAgent:
            @traced_agent("CareerReadinessAgent")
            async def execute(self) -> str:
                """Do the agent's work."""
                return "done"

        # WHEN it executes under tracing
        with in_memory_tracing() as recorded_spans:
            await _StandaloneAgent().execute()

        # THEN expect the explicit agent type to be used
        assert recorded_spans.by_name("CareerReadinessAgent") is not None

    @pytest.mark.asyncio
    async def test_still_returns_the_output_when_tracing_is_off(self):
        """Still returns the output when tracing is off."""
        # GIVEN tracing is off (the default under pytest)
        given_agent = _FakeAgent("QnaAgent")

        # WHEN the agent executes
        actual_output = await given_agent.execute("hello")

        # THEN expect the agent's own behaviour to be unchanged
        assert actual_output == "handled: hello"


class TestInstrumentAgentExecute:
    """
    Tests for instrument agent execute.
    """

    @pytest.mark.asyncio
    async def test_instruments_an_execute_defined_on_the_class(self):
        """Instruments an execute defined on the class."""
        # GIVEN a class defining its own async execute
        class _Subclass:
            agent_type = _FakeAgentType("InferOccupationsAgent")

            async def execute(self) -> str:
                """Do the agent's work."""
                return "ok"

        # WHEN the class is instrumented and executed under tracing
        instrument_agent_execute(_Subclass)
        with in_memory_tracing() as recorded_spans:
            actual_output = await _Subclass().execute()

        # THEN expect an observation for it
        assert recorded_spans.by_name("InferOccupationsAgent") is not None
        # AND expect the behaviour to be unchanged
        assert actual_output == "ok"

    @pytest.mark.asyncio
    async def test_does_not_double_wrap_an_already_instrumented_execute(self):
        """Does not double wrap an already instrumented execute."""
        # GIVEN a class whose execute has already been instrumented
        class _Subclass:
            agent_type = _FakeAgentType("FarewellAgent")

            async def execute(self) -> str:
                """Do the agent's work."""
                return "ok"

        instrument_agent_execute(_Subclass)

        # WHEN it is instrumented a second time and executed under tracing
        instrument_agent_execute(_Subclass)
        with in_memory_tracing() as recorded_spans:
            await _Subclass().execute()

        # THEN expect exactly one observation, not two nested ones
        assert recorded_spans.names().count("FarewellAgent") == 1

    def test_ignores_a_class_that_does_not_define_execute(self):
        """Ignores a class that does not define execute."""
        # GIVEN a class with no execute of its own
        class _NoExecute:
            pass

        # WHEN it is instrumented
        instrument_agent_execute(_NoExecute)

        # THEN expect no execute to have been added
        assert not hasattr(_NoExecute, "execute")


class TestTracedTool:
    """
    Tests for traced tool.
    """

    @pytest.mark.asyncio
    async def test_opens_a_tool_observation(self):
        """Opens a tool observation."""
        # GIVEN a tool function
        @traced_tool("translation_tool.translate")
        async def _translate(text: str) -> str:
            return text.upper()

        # WHEN it runs under tracing
        with in_memory_tracing() as recorded_spans:
            actual_output = await _translate("hello")

        # THEN expect a tool observation
        actual_span = recorded_spans.by_name("translation_tool.translate")
        assert actual_span is not None
        assert actual_span.attributes["langfuse.observation.type"] == "tool"
        # AND expect the tool's behaviour to be unchanged
        assert actual_output == "HELLO"

    @pytest.mark.asyncio
    async def test_defaults_the_name_to_the_function(self):
        """Defaults the name to the function."""
        # GIVEN a tool function with no explicit name
        @traced_tool()
        async def _summarize() -> str:
            return "summary"

        # WHEN it runs under tracing
        with in_memory_tracing() as recorded_spans:
            await _summarize()

        # THEN expect the observation to be named after the function
        assert any(name.endswith("_summarize") for name in recorded_spans.names())
