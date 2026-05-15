from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.agent.agent_types import AgentInput, AgentType, LLMStats
from app.agent.collect_experiences_agent._conversation_llm import ConversationLLMAgentOutput
from app.agent.collect_experiences_agent._transition_decision_tool import TransitionDecision, TransitionReasoning
from app.agent.collect_experiences_agent.collect_experiences_agent import (
    CollectExperiencesAgent,
    CollectExperiencesAgentState,
)
from app.agent.experience.work_type import WorkType
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationHistory
from common_libs.test_utilities import get_random_session_id


def _make_llm_stats() -> list[LLMStats]:
    """Helper to create a minimal LLMStats list."""
    return [LLMStats(prompt_token_count=10, response_token_count=20, response_time_in_sec=0.5)]


def _make_conversation_llm_output(message: str = "Hello!", metadata: dict | None = None) -> ConversationLLMAgentOutput:
    """Helper to create a ConversationLLMAgentOutput for mocking."""
    return ConversationLLMAgentOutput(
        message_for_user=message,
        finished=False,
        agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
        agent_response_time_in_sec=0.5,
        llm_stats=_make_llm_stats(),
        sent_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        metadata=metadata,
    )


def _make_transition_result(decision: TransitionDecision = TransitionDecision.CONTINUE):
    """Helper to create a transition decision result tuple for mocking."""
    return (
        decision,
        TransitionReasoning(reasoning="test reasoning", confidence="HIGH"),
        _make_llm_stats(),
    )


def _make_context() -> ConversationContext:
    """Helper to create an empty ConversationContext."""
    return ConversationContext(all_history=ConversationHistory())


def _make_user_input(message: str = "") -> AgentInput:
    """Helper to create an AgentInput. Empty message avoids triggering DataExtractionLLM."""
    return AgentInput(
        message=message,
        sent_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )


@pytest.fixture
def setup_application_config():
    """Fixture to set up the application config and locale needed for the i18n translation service."""
    from app.app_config import ApplicationConfig, set_application_config
    from app.context_vars import user_language_ctx_var
    from app.countries import Country
    from app.i18n.language_config import LanguageConfig, LocaleDateFormatEntry
    from app.i18n.types import Locale
    from app.version.types import Version

    config = ApplicationConfig(
        environment_name="test",
        version_info=Version(
            date="test-date",
            branch="test-branch",
            buildNumber="test-build",
            sha="test-sha",
        ),
        default_country_of_user=Country.UNSPECIFIED,
        enable_metrics=False,
        taxonomy_model_id="test-model-id",
        embeddings_service_name="test-service",
        embeddings_model_name="test-model",
        features={},
        language_config=LanguageConfig(
            default_locale=Locale.EN_US,
            available_locales=[LocaleDateFormatEntry(locale=Locale.EN_US, date_format="MM/DD/YYYY")],
        ),
        app_name="Compass",
        admin_firebase_tenant_id="test-tenant-id",
        matching_service_url="https://test-matching-service",
        matching_service_api_key="test-matching-api-key",
    )
    set_application_config(config)
    # Set the locale context variable so t() can resolve translations
    token = user_language_ctx_var.set(Locale.EN_US)
    yield config
    user_language_ctx_var.reset(token)
    set_application_config(None)


class TestCollectExperiencesAgentQuickReplyOptions:
    """Tests for AI-driven quick-reply options in CollectExperiencesAgent.

    The conversation LLM now returns quick_reply_options in its metadata via structured JSON output.
    These tests verify that metadata from the conversation LLM passes through to the final AgentOutput.
    """

    @pytest.mark.asyncio
    @patch(
        "app.agent.collect_experiences_agent.collect_experiences_agent._ConversationLLM.execute",
        new_callable=AsyncMock,
    )
    @patch(
        "app.agent.collect_experiences_agent.collect_experiences_agent.TransitionDecisionTool.execute",
        new_callable=AsyncMock,
    )
    async def test_quick_reply_options_from_llm_pass_through_to_output(
        self, mock_transition, mock_conversation_llm, setup_application_config
    ):
        """should pass through quick_reply_options from conversation LLM metadata to the agent output"""
        # GIVEN a CollectExperiencesAgent with unexplored types
        given_state = CollectExperiencesAgentState(
            session_id=get_random_session_id(),
            first_time_visit=True,
            unexplored_types=[WorkType.PAID_WORK, WorkType.UNPAID_WORK],
            explored_types=[],
        )
        given_agent = CollectExperiencesAgent()
        given_agent.set_state(given_state)

        # AND the conversation LLM returns quick_reply_options in metadata
        given_quick_reply_metadata = {"quick_reply_options": [{"label": "Yes"}, {"label": "No"}]}
        mock_conversation_llm.return_value = _make_conversation_llm_output(
            "Do you have paid work experience?", metadata=given_quick_reply_metadata
        )

        # AND the transition decision tool returns CONTINUE
        mock_transition.return_value = _make_transition_result(TransitionDecision.CONTINUE)

        # AND the user sends an empty message (first interaction, avoids data extraction LLM)
        given_input = _make_user_input("")
        given_context = _make_context()

        # WHEN the agent executes
        actual_output = await given_agent.execute(given_input, given_context)

        # THEN the output metadata should contain the quick_reply_options from the LLM
        assert actual_output.metadata is not None
        assert "quick_reply_options" in actual_output.metadata
        actual_options = actual_output.metadata["quick_reply_options"]
        assert len(actual_options) == 2
        assert actual_options[0]["label"] == "Yes"
        assert actual_options[1]["label"] == "No"

    @pytest.mark.asyncio
    @patch(
        "app.agent.collect_experiences_agent.collect_experiences_agent._ConversationLLM.execute",
        new_callable=AsyncMock,
    )
    @patch(
        "app.agent.collect_experiences_agent.collect_experiences_agent.TransitionDecisionTool.execute",
        new_callable=AsyncMock,
    )
    async def test_no_quick_reply_options_when_llm_returns_none(
        self, mock_transition, mock_conversation_llm, setup_application_config
    ):
        """should NOT have quick_reply_options when conversation LLM returns no metadata"""
        # GIVEN a CollectExperiencesAgent that is not on its first visit and still has types to explore
        given_state = CollectExperiencesAgentState(
            session_id=get_random_session_id(),
            first_time_visit=False,
            unexplored_types=[WorkType.UNPAID_WORK],
            explored_types=[WorkType.PAID_WORK],
        )
        given_agent = CollectExperiencesAgent()
        given_agent.set_state(given_state)

        # AND the conversation LLM returns an output without metadata (no quick_reply_options)
        mock_conversation_llm.return_value = _make_conversation_llm_output("Tell me about your unpaid work.")

        # AND the transition decision tool returns CONTINUE
        mock_transition.return_value = _make_transition_result(TransitionDecision.CONTINUE)

        # AND the user sends an empty message
        given_input = _make_user_input("")
        given_context = _make_context()

        # WHEN the agent executes
        actual_output = await given_agent.execute(given_input, given_context)

        # THEN the output should not have quick_reply_options metadata
        if actual_output.metadata is not None:
            assert "quick_reply_options" not in actual_output.metadata

    @pytest.mark.asyncio
    @patch(
        "app.agent.collect_experiences_agent.collect_experiences_agent._ConversationLLM.execute",
        new_callable=AsyncMock,
    )
    @patch(
        "app.agent.collect_experiences_agent.collect_experiences_agent.TransitionDecisionTool.execute",
        new_callable=AsyncMock,
    )
    async def test_first_time_visit_flag_is_cleared_after_execute(
        self, mock_transition, mock_conversation_llm, setup_application_config
    ):
        """should set first_time_visit to False after execute completes"""
        # GIVEN a CollectExperiencesAgent with first_time_visit=True
        given_state = CollectExperiencesAgentState(
            session_id=get_random_session_id(),
            first_time_visit=True,
            unexplored_types=[WorkType.PAID_WORK, WorkType.UNPAID_WORK],
            explored_types=[],
        )
        given_agent = CollectExperiencesAgent()
        given_agent.set_state(given_state)

        # AND the conversation LLM returns a normal output
        mock_conversation_llm.return_value = _make_conversation_llm_output("Welcome!")

        # AND the transition decision tool returns CONTINUE
        mock_transition.return_value = _make_transition_result(TransitionDecision.CONTINUE)

        # AND the user sends an empty message
        given_input = _make_user_input("")
        given_context = _make_context()

        # WHEN the agent executes
        await given_agent.execute(given_input, given_context)

        # THEN the state's first_time_visit flag should be False
        assert given_state.first_time_visit is False

    @pytest.mark.asyncio
    @patch(
        "app.agent.collect_experiences_agent.collect_experiences_agent._ConversationLLM.execute",
        new_callable=AsyncMock,
    )
    @patch(
        "app.agent.collect_experiences_agent.collect_experiences_agent.TransitionDecisionTool.execute",
        new_callable=AsyncMock,
    )
    async def test_quick_reply_options_preserved_alongside_other_metadata(
        self, mock_transition, mock_conversation_llm, setup_application_config
    ):
        """should preserve both quick_reply_options and other metadata keys"""
        # GIVEN a CollectExperiencesAgent with first_time_visit=True
        given_state = CollectExperiencesAgentState(
            session_id=get_random_session_id(),
            first_time_visit=True,
            unexplored_types=[WorkType.PAID_WORK, WorkType.UNPAID_WORK],
            explored_types=[],
        )
        given_agent = CollectExperiencesAgent()
        given_agent.set_state(given_state)

        # AND the conversation LLM returns metadata with both quick_reply_options and other keys
        given_metadata = {
            "existing_key": "existing_value",
            "quick_reply_options": [{"label": "Yes"}, {"label": "No"}],
        }
        mock_conversation_llm.return_value = _make_conversation_llm_output("Welcome!", metadata=given_metadata)

        # AND the transition decision tool returns CONTINUE
        mock_transition.return_value = _make_transition_result(TransitionDecision.CONTINUE)

        # AND the user sends an empty message
        given_input = _make_user_input("")
        given_context = _make_context()

        # WHEN the agent executes
        actual_output = await given_agent.execute(given_input, given_context)

        # THEN the output metadata should contain both the existing key and quick_reply_options
        assert actual_output.metadata is not None
        assert actual_output.metadata["existing_key"] == "existing_value"
        assert "quick_reply_options" in actual_output.metadata
        assert len(actual_output.metadata["quick_reply_options"]) == 2

    @pytest.mark.asyncio
    @patch(
        "app.agent.collect_experiences_agent.collect_experiences_agent._ConversationLLM.execute",
        new_callable=AsyncMock,
    )
    @patch(
        "app.agent.collect_experiences_agent.collect_experiences_agent.TransitionDecisionTool.execute",
        new_callable=AsyncMock,
    )
    async def test_recap_phase_quick_reply_options_from_llm(
        self, mock_transition, mock_conversation_llm, setup_application_config
    ):
        """should pass through quick_reply_options from LLM during recap phase (no unexplored types)"""
        # GIVEN a CollectExperiencesAgent with all types explored (recap phase)
        given_state = CollectExperiencesAgentState(
            session_id=get_random_session_id(),
            first_time_visit=False,
            unexplored_types=[],
            explored_types=[WorkType.PAID_WORK, WorkType.UNPAID_WORK],
        )
        given_agent = CollectExperiencesAgent()
        given_agent.set_state(given_state)

        # AND the conversation LLM returns recap-appropriate quick_reply_options
        given_metadata = {
            "quick_reply_options": [{"label": "That's all"}, {"label": "I want to add something"}],
        }
        mock_conversation_llm.return_value = _make_conversation_llm_output(
            "Is there anything else?", metadata=given_metadata
        )

        # AND the transition decision tool returns CONTINUE
        mock_transition.return_value = _make_transition_result(TransitionDecision.CONTINUE)

        # AND the user sends an empty message
        given_input = _make_user_input("")
        given_context = _make_context()

        # WHEN the agent executes
        actual_output = await given_agent.execute(given_input, given_context)

        # THEN the output metadata should contain the recap quick_reply_options from the LLM
        assert actual_output.metadata is not None
        assert "quick_reply_options" in actual_output.metadata
        actual_options = actual_output.metadata["quick_reply_options"]
        assert len(actual_options) == 2
        assert actual_options[0]["label"] == "That's all"
        assert actual_options[1]["label"] == "I want to add something"
