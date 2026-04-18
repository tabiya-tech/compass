"""
Tests for the career readiness agent.
"""
from enum import Enum
from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError

from app.agent.agent_types import AgentInput, AgentType, LLMStats
from app.career_readiness.agent import (
    CareerReadinessAgent,
    CareerReadinessAgentOutput,
    CareerReadinessModelResponse,
    _build_instruction_mode_instructions,
    _build_module_response_model,
    _build_support_mode_instructions,
    _safe_enum_member_name,
)
from app.career_readiness.types import (
    ConversationMode,
    TopicStatus,
    TopicStatusRecord,
)
from app.conversation_memory.conversation_memory_types import (
    ConversationContext,
    ConversationHistory,
)
from common_libs.llm.schema_builder import with_response_schema


class TestBuildInstructionModeInstructions:
    """Tests for the instruction mode system instructions builder."""

    def test_includes_all_required_elements(self):
        # GIVEN a module title, content, and topics
        given_title = "CV Development"
        given_content = "How to write a great CV."
        given_topics = ["CV Structure", "Writing Tips"]

        # WHEN the instruction mode instructions are built
        actual_instructions = _build_instruction_mode_instructions(given_title, given_content, given_topics)

        # THEN the module title and content are included
        assert given_title in actual_instructions
        assert given_content in actual_instructions
        # AND each topic appears in the instructions
        for topic in given_topics:
            assert topic in actual_instructions
        # AND the scaffolded Socratic tutoring keywords are present
        assert "ASSESS" in actual_instructions
        assert "GUIDE" in actual_instructions
        assert "HINT" in actual_instructions
        assert "EXPLAIN" in actual_instructions
        assert "FADE" in actual_instructions
        # AND the new per-topic status contract is explained in the prompt
        assert "topic_status" in actual_instructions
        assert "topic_id" in actual_instructions
        assert "evidence" in actual_instructions.lower()
        assert "covered" in actual_instructions
        assert "partial" in actual_instructions
        assert "not_covered" in actual_instructions
        # AND it explains the monotonic update rule
        assert "upgrade" in actual_instructions.lower() or "UPGRADE" in actual_instructions
        assert "downgrade" in actual_instructions.lower()
        # AND it defers completion to the server rather than the LLM
        assert "server" in actual_instructions.lower()
        # AND quiz concealment instructions are present
        assert "quiz" in actual_instructions.lower()
        assert "do not" in actual_instructions.lower()
        # AND minimal-response handling instructions are present
        assert "minimal" in actual_instructions.lower()
        assert "demonstrate" in actual_instructions.lower()
        # AND off-topic-response handling instructions are present
        assert "off-topic" in actual_instructions.lower()
        # AND comprehension check techniques are mentioned
        assert "explain" in actual_instructions.lower()
        assert "application" in actual_instructions.lower()
        # AND obsolete signals are no longer present
        assert "topics_covered" not in actual_instructions
        assert "topics_remaining" not in actual_instructions
        assert "Mandatory Pre-Check" not in actual_instructions
        assert '"finished"' not in actual_instructions


class TestBuildSupportModeInstructions:
    """Tests for the support mode system instructions builder."""

    def test_includes_all_required_elements(self):
        # GIVEN a module title and content
        given_title = "CV Development"
        given_content = "How to write a great CV."

        # WHEN the support mode instructions are built
        actual_instructions = _build_support_mode_instructions(given_title, given_content)

        # THEN the module title and content are included
        assert given_title in actual_instructions
        assert given_content in actual_instructions
        # AND it instructs topic_status to always be empty
        assert "topic_status" in actual_instructions
        assert "empty list" in actual_instructions.lower()
        # AND there is an instruction not to re-initiate the lesson plan
        assert "lesson plan" in actual_instructions.lower()
        # AND the legacy signals are no longer in the support prompt
        assert "topics_covered" not in actual_instructions
        assert '"finished"' not in actual_instructions


@patch("app.career_readiness.agent.GeminiGenerativeLLM")
class TestCareerReadinessAgent:
    """Tests for the CareerReadinessAgent class."""

    def test_initializes_in_instruction_mode_by_default(self, mock_llm_cls):
        # GIVEN a module title, content, and topics
        given_title = "CV Development"
        given_content = "Write your CV with clear structure."
        given_topics = ["CV Structure", "Writing Tips"]

        # WHEN the agent is created without specifying mode
        actual_agent = CareerReadinessAgent(
            module_title=given_title, module_content=given_content, topics=given_topics)

        # THEN the system instructions contain scaffolded Socratic content
        assert "ASSESS" in actual_agent.system_instructions
        assert given_title in actual_agent.system_instructions
        assert given_content in actual_agent.system_instructions

    def test_initializes_in_support_mode(self, mock_llm_cls):
        # GIVEN a module title and content
        given_title = "CV Development"
        given_content = "Write your CV with clear structure."

        # WHEN the agent is created in support mode
        actual_agent = CareerReadinessAgent(
            module_title=given_title, module_content=given_content,
            mode=ConversationMode.SUPPORT)

        # THEN the system instructions contain support mode content
        assert "follow-up" in actual_agent.system_instructions.lower()
        # AND do NOT contain instruction mode content
        assert "ASSESS" not in actual_agent.system_instructions

    @pytest.mark.asyncio
    async def test_execute_returns_career_readiness_agent_output(self, mock_llm_cls):
        # GIVEN an agent with a mocked LLM caller
        given_agent = CareerReadinessAgent(
            module_title="Test Module", module_content="Test content.",
            topics=["Topic A", "Topic B"])
        given_topic_status = [
            TopicStatusRecord(topic_id="Topic A", status=TopicStatus.COVERED, evidence="student explained it"),
            TopicStatusRecord(topic_id="Topic B", status=TopicStatus.NOT_COVERED, evidence=""),
        ]
        given_model_response = CareerReadinessModelResponse(
            reasoning="The user asked about Topic A.",
            message="Let's start with Topic A. What do you already know?",
            topic_status=given_topic_status,
        )
        given_llm_stats = [LLMStats(
            prompt_token_count=100,
            response_token_count=50,
            response_time_in_sec=1.0,
        )]
        given_agent._llm_caller.call_llm = AsyncMock(return_value=(given_model_response, given_llm_stats))

        # AND a user input and empty context
        given_input = AgentInput(message="Hi, I'd like to learn about Topic A")
        given_context = ConversationContext(
            all_history=ConversationHistory(),
            history=ConversationHistory(),
        )

        # WHEN execute is called
        actual_output = await given_agent.execute(given_input, given_context)

        # THEN the output is a CareerReadinessAgentOutput
        assert isinstance(actual_output, CareerReadinessAgentOutput)
        # AND the agent output contains the expected message
        assert actual_output.agent_output.message_for_user == "Let's start with Topic A. What do you already know?"
        # AND the agent output finished flag is always False (server decides completion now)
        assert actual_output.agent_output.finished is False
        # AND the proposed_topic_status is propagated
        assert len(actual_output.proposed_topic_status) == 2
        assert actual_output.proposed_topic_status[0].topic_id == "Topic A"
        assert actual_output.proposed_topic_status[0].status == TopicStatus.COVERED
        # AND the agent type is correct
        assert actual_output.agent_output.agent_type == AgentType.CAREER_READINESS_AGENT

    @pytest.mark.asyncio
    async def test_execute_handles_empty_input(self, mock_llm_cls):
        # GIVEN an agent with a mocked LLM caller
        given_agent = CareerReadinessAgent(
            module_title="Test Module", module_content="Test content.", topics=["Topic A"])
        given_model_response = CareerReadinessModelResponse(
            reasoning="The user sent empty input, I will greet them.",
            message="Hello! How can I help you today?",
            topic_status=[],
        )
        given_agent._llm_caller.call_llm = AsyncMock(return_value=(given_model_response, []))

        # AND an empty user input
        given_input = AgentInput(message="   ")
        given_context = ConversationContext(
            all_history=ConversationHistory(),
            history=ConversationHistory(),
        )

        # WHEN execute is called
        actual_output = await given_agent.execute(given_input, given_context)

        # THEN the LLM is called with "(silence)" as the user message
        call_args = given_agent._llm_caller.call_llm.call_args
        llm_input = call_args.kwargs["llm_input"]
        assert any("(silence)" in turn.content for turn in llm_input.turns)

    @pytest.mark.asyncio
    async def test_execute_handles_llm_error(self, mock_llm_cls):
        # GIVEN an agent whose LLM caller raises an exception
        given_agent = CareerReadinessAgent(
            module_title="Test Module", module_content="Test content.", topics=["Topic A"])
        given_agent._llm_caller.call_llm = AsyncMock(side_effect=Exception("LLM service unavailable"))

        given_input = AgentInput(message="Tell me about CVs")
        given_context = ConversationContext(
            all_history=ConversationHistory(),
            history=ConversationHistory(),
        )

        # WHEN execute is called
        actual_output = await given_agent.execute(given_input, given_context)

        # THEN a fallback error message is returned
        assert "difficulties" in actual_output.agent_output.message_for_user
        # AND the agent output does not claim finished
        assert actual_output.agent_output.finished is False
        # AND proposed_topic_status is empty (service merge treats as no-op)
        assert actual_output.proposed_topic_status == []

    @pytest.mark.asyncio
    async def test_generate_intro_message_sends_artificial_input(self, mock_llm_cls):
        # GIVEN an agent with a mocked LLM caller
        given_agent = CareerReadinessAgent(
            module_title="Test Module", module_content="Test content.", topics=["Topic A"])
        given_model_response = CareerReadinessModelResponse(
            reasoning="Starting a new conversation, introducing the module.",
            message="Welcome to the CV Development module!",
            topic_status=[],
        )
        given_agent._llm_caller.call_llm = AsyncMock(return_value=(given_model_response, []))

        given_context = ConversationContext(
            all_history=ConversationHistory(),
            history=ConversationHistory(),
        )

        # WHEN generate_intro_message is called
        actual_output = await given_agent.generate_intro_message(given_context)

        # THEN the output contains the introductory message
        assert actual_output.agent_output.message_for_user == "Welcome to the CV Development module!"
        # AND the LLM is called with "(silence)" as the user message
        call_args = given_agent._llm_caller.call_llm.call_args
        llm_input = call_args.kwargs["llm_input"]
        assert any("(silence)" in turn.content for turn in llm_input.turns)

    @pytest.mark.asyncio
    async def test_quick_reply_options_from_llm_pass_through_to_metadata(self, mock_llm_cls):
        # GIVEN an agent with a mocked LLM that returns quick_reply_options
        given_agent = CareerReadinessAgent(
            module_title="Test Module", module_content="Test content.", topics=["Topic A"])
        given_quick_reply_options = [{"label": "Yes"}, {"label": "No"}]
        given_model_response = CareerReadinessModelResponse(
            reasoning="Asking a yes/no question.",
            message="Would you like to learn more about Topic A?",
            topic_status=[],
            quick_reply_options=given_quick_reply_options,
        )
        given_agent._llm_caller.call_llm = AsyncMock(return_value=(given_model_response, []))
        given_input = AgentInput(message="Tell me about Topic A")
        given_context = ConversationContext(all_history=ConversationHistory(), history=ConversationHistory())

        # WHEN execute is called
        actual_output = await given_agent.execute(given_input, given_context)

        # THEN the metadata contains quick_reply_options with correct label structure
        assert actual_output.agent_output.metadata is not None
        assert "quick_reply_options" in actual_output.agent_output.metadata
        actual_options = actual_output.agent_output.metadata["quick_reply_options"]
        assert len(actual_options) == 2
        assert actual_options[0]["label"] == "Yes"
        assert actual_options[1]["label"] == "No"



class TestSafeEnumMemberName:
    """Tests for the _safe_enum_member_name helper."""

    def test_converts_spaces_and_punctuation_to_underscores(self):
        # GIVEN a topic with spaces and punctuation
        given_topic = "What is a CV?"

        # WHEN the enum member name is built
        actual_name = _safe_enum_member_name(given_topic, 0)

        # THEN the name is a valid Python identifier
        expected_name = "WHAT_IS_A_CV_0"
        assert actual_name == expected_name

    def test_prefixes_digit_starting_topics(self):
        # GIVEN a topic that starts with a digit
        given_topic = "3 Pillars of Confidence"

        # WHEN the enum member name is built
        actual_name = _safe_enum_member_name(given_topic, 0)

        # THEN the name starts with T_ to be a valid identifier
        assert actual_name.startswith("T_")
        assert actual_name.isidentifier()

    def test_index_makes_collisions_unique(self):
        # GIVEN two topics that would collapse to the same identifier
        given_topic_a = "What is a CV"
        given_topic_b = "What is a CV?"

        # WHEN member names are built with different indices
        actual_name_a = _safe_enum_member_name(given_topic_a, 0)
        actual_name_b = _safe_enum_member_name(given_topic_b, 1)

        # THEN the names are distinct
        assert actual_name_a != actual_name_b


def _full_status(topic_ids: list[str], status: TopicStatus = TopicStatus.NOT_COVERED) -> list[dict]:
    """Helper: build a topic_status list with the given status for each topic id."""
    evidence = "" if status == TopicStatus.NOT_COVERED else "student said something relevant"
    return [{"topic_id": tid, "status": status.value, "evidence": evidence} for tid in topic_ids]


class TestTopicStatusRecord:
    """Tests for the evidence/status validator on TopicStatusRecord."""

    def test_accepts_covered_with_evidence(self):
        # GIVEN a covered record with non-empty evidence
        # WHEN it is constructed
        actual = TopicStatusRecord(topic_id="T", status=TopicStatus.COVERED, evidence="student explained X")

        # THEN no error and the fields round-trip
        assert actual.status == TopicStatus.COVERED
        assert actual.evidence == "student explained X"

    def test_accepts_partial_with_evidence(self):
        # GIVEN a partial record with non-empty evidence
        # WHEN constructed
        actual = TopicStatusRecord(topic_id="T", status=TopicStatus.PARTIAL, evidence="brief mention")

        # THEN no error
        assert actual.status == TopicStatus.PARTIAL

    def test_accepts_not_covered_with_empty_evidence(self):
        # GIVEN a not_covered record with empty evidence
        # WHEN constructed
        actual = TopicStatusRecord(topic_id="T", status=TopicStatus.NOT_COVERED, evidence="")

        # THEN no error
        assert actual.status == TopicStatus.NOT_COVERED
        assert actual.evidence == ""

    def test_rejects_covered_with_empty_evidence(self):
        # GIVEN a covered record with empty evidence
        # WHEN constructed
        # THEN Pydantic raises ValidationError
        with pytest.raises(ValidationError):
            TopicStatusRecord(topic_id="T", status=TopicStatus.COVERED, evidence="")

    def test_rejects_partial_with_empty_evidence(self):
        # GIVEN a partial record with empty evidence
        # WHEN constructed
        # THEN Pydantic raises ValidationError
        with pytest.raises(ValidationError):
            TopicStatusRecord(topic_id="T", status=TopicStatus.PARTIAL, evidence="   ")

    def test_rejects_not_covered_with_nonempty_evidence(self):
        # GIVEN a not_covered record with evidence
        # WHEN constructed
        # THEN Pydantic raises ValidationError
        with pytest.raises(ValidationError):
            TopicStatusRecord(topic_id="T", status=TopicStatus.NOT_COVERED, evidence="something")


class TestBuildModuleResponseModel:
    """Tests for the _build_module_response_model helper."""

    def test_returns_base_class_when_topics_empty(self):
        # GIVEN an empty topic list
        given_topics: list[str] = []

        # WHEN the response model is built
        actual_model = _build_module_response_model(given_topics)

        # THEN the base class is returned unchanged
        assert actual_model is CareerReadinessModelResponse

    def test_accepts_valid_full_topic_status(self):
        # GIVEN a topic list
        given_topics = ["What is a CV?", "CV Structure"]

        # WHEN the dynamic model is built
        actual_model = _build_module_response_model(given_topics)

        # THEN a response with one record per topic can be constructed
        actual_instance = actual_model(
            reasoning="ok",
            message="hi",
            topic_status=_full_status(given_topics, TopicStatus.NOT_COVERED),
        )

        # AND topic_id values round-trip to the original strings
        actual_values = [
            r.topic_id.value if isinstance(r.topic_id, Enum) else r.topic_id
            for r in actual_instance.topic_status
        ]
        assert actual_values == given_topics

    def test_rejects_unknown_topic_id(self):
        # GIVEN a dynamic model built for specific topics
        given_topics = ["Topic A", "Topic B"]
        actual_model = _build_module_response_model(given_topics)

        # WHEN a topic_status entry names a topic outside the enum
        # THEN Pydantic raises a ValidationError
        with pytest.raises(ValidationError):
            actual_model(
                reasoning="r",
                message="m",
                topic_status=[
                    {"topic_id": "Topic A", "status": "not_covered", "evidence": ""},
                    {"topic_id": "Topic B", "status": "not_covered", "evidence": ""},
                    {"topic_id": "Topic C", "status": "not_covered", "evidence": ""},
                ],
            )

    def test_rejects_missing_topic(self):
        # GIVEN a dynamic model built for two topics
        given_topics = ["Topic A", "Topic B"]
        actual_model = _build_module_response_model(given_topics)

        # WHEN topic_status is missing a canonical topic
        # THEN the one-entry-per-topic validator raises
        with pytest.raises(ValidationError):
            actual_model(
                reasoning="r",
                message="m",
                topic_status=[
                    {"topic_id": "Topic A", "status": "not_covered", "evidence": ""},
                ],
            )

    def test_rejects_duplicate_topic_id(self):
        # GIVEN a dynamic model built for two topics
        given_topics = ["Topic A", "Topic B"]
        actual_model = _build_module_response_model(given_topics)

        # WHEN topic_status repeats a topic id instead of covering both
        # THEN the one-entry-per-topic validator raises
        with pytest.raises(ValidationError):
            actual_model(
                reasoning="r",
                message="m",
                topic_status=[
                    {"topic_id": "Topic A", "status": "not_covered", "evidence": ""},
                    {"topic_id": "Topic A", "status": "partial", "evidence": "x"},
                ],
            )

    def test_handles_punctuation_variants_as_distinct_values(self):
        # GIVEN topics that collide on identifier but differ on value
        given_topics = ["What is a CV?", "What is a CV"]
        actual_model = _build_module_response_model(given_topics)

        # WHEN a response is constructed with both values
        actual_instance = actual_model(
            reasoning="r",
            message="m",
            topic_status=_full_status(given_topics, TopicStatus.NOT_COVERED),
        )

        # THEN both values are accepted and preserved
        actual_values = [
            r.topic_id.value if isinstance(r.topic_id, Enum) else r.topic_id
            for r in actual_instance.topic_status
        ]
        assert set(actual_values) == set(given_topics)

    def test_handles_topic_starting_with_digit(self):
        # GIVEN a topic that starts with a digit
        given_topics = ["3 Pillars of Confidence"]

        # WHEN the dynamic model is built and used
        actual_model = _build_module_response_model(given_topics)
        actual_instance = actual_model(
            reasoning="r",
            message="m",
            topic_status=_full_status(given_topics, TopicStatus.NOT_COVERED),
        )

        # THEN the topic is accepted without raising
        assert len(actual_instance.topic_status) == 1

    def test_json_schema_contains_enum_constraint(self):
        # GIVEN a dynamic model built for specific topics
        given_topics = ["Alpha", "Beta"]
        actual_model = _build_module_response_model(given_topics)

        # WHEN the JSON schema is generated
        actual_schema_str = str(actual_model.model_json_schema())

        # THEN the schema references the topic values as enum members
        assert "enum" in actual_schema_str
        assert "Alpha" in actual_schema_str
        assert "Beta" in actual_schema_str

    def test_with_response_schema_preserves_enum_after_vertex_cleaning(self):
        # GIVEN a dynamic model built for specific topics
        given_topics = ["Alpha", "Beta"]
        actual_model = _build_module_response_model(given_topics)

        # WHEN the Vertex-shaped schema is built
        actual_schema = with_response_schema(actual_model)

        # THEN the cleaned schema still carries an enum constraint on topic_status[].topic_id
        actual_topic_status_items = (
            actual_schema["response_schema"]["properties"]["topic_status"]["items"]
        )
        actual_topic_id_schema = actual_topic_status_items["properties"]["topic_id"]
        assert set(actual_topic_id_schema.get("enum", [])) == {"Alpha", "Beta"}

