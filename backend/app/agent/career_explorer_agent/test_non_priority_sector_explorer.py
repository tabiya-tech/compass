"""
Tests for NonPrioritySectorExplorer.

Covers the bug where the agent leaks its chain-of-thought JSON (including the
'reasoning' field) directly to the user instead of returning only the 'message'
field.

Two-stage design
----------------
Stage 1 (Google Search) is mocked via patching genai.Client.
Stage 2 (structured reformat) is mocked via patching _reformat_to_structured on the
explorer instance, since it requires Vertex AI credentials unavailable in unit tests.
The reformat stage returns a ModelResponse directly, simulating what response_schema
enforcement guarantees at runtime.
"""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch

from app.agent.career_explorer_agent.non_priority_sector_explorer import NonPrioritySectorExplorer
from app.agent.simple_llm_agent.llm_response import ModelResponse
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.context_vars import user_language_ctx_var
from app.i18n.types import Locale


# Raw JSON string that mirrors the bug report -- LLM returned the full
# chain-of-thought JSON as plain text.
_BUG_REPORT_RAW_TEXT = json.dumps({
    "reasoning": (
        "The user's request is about the role of an ICT Data Engineer, which falls under the ICT sector. "
        "Since ICT is not one of the priority sectors in Zambia (Agriculture, Energy, Mining, Hospitality, Water), "
        "I need to use the Google Search tool to gather current information. The search results provide details on "
        "data engineering roles in Zambia, required skills, and salary expectations. I will use this information "
        "to provide a comprehensive answer to the user."
    ),
    "finished": False,
    "message": (
        "An ICT Data Engineer in Zambia is responsible for designing, building, and maintaining data pipelines "
        "and infrastructure. This involves ingesting, storing, and cataloging data, ensuring its quality, and "
        "making it accessible for analysis. Key skills for this role include strong proficiency in SQL and Python, "
        "understanding of software development methodologies, and experience with data warehousing, ETL "
        "(Extract, Transform, Load) processes, and cloud platforms like AWS, Azure, or Google Cloud. Some roles "
        "may also require experience with big data technologies such as Hadoop and Spark. In terms of salary, a "
        "Data Engineer in Lusaka can expect an average base salary of around 220,900 ZMW annually, though this "
        "can vary based on experience, employer type, and specific skills."
    ),
})

_EXPECTED_MESSAGE = (
    "An ICT Data Engineer in Zambia is responsible for designing, building, and maintaining data pipelines "
    "and infrastructure. This involves ingesting, storing, and cataloging data, ensuring its quality, and "
    "making it accessible for analysis. Key skills for this role include strong proficiency in SQL and Python, "
    "understanding of software development methodologies, and experience with data warehousing, ETL "
    "(Extract, Transform, Load) processes, and cloud platforms like AWS, Azure, or Google Cloud. Some roles "
    "may also require experience with big data technologies such as Hadoop and Spark. In terms of salary, a "
    "Data Engineer in Lusaka can expect an average base salary of around 220,900 ZMW annually, though this "
    "can vary based on experience, employer type, and specific skills."
)


def _make_mock_response(text: str) -> MagicMock:
    """Build a minimal mock of the genai GenerateContentResponse."""
    mock_response = MagicMock()
    mock_response.text = text
    mock_response.usage_metadata.prompt_token_count = 100
    mock_response.usage_metadata.candidates_token_count = 200
    # No grounding metadata for these unit tests.
    mock_response.candidates = []
    return mock_response


def _make_reformat_mock(raw_text: str) -> AsyncMock:
    """
    Build a mock for _reformat_to_structured that parses the raw_text as if
    Stage 2 (response_schema enforcement) had run successfully.

    If raw_text is valid ModelResponse JSON, returns the parsed model.
    Otherwise returns a plain ModelResponse with raw_text as the message,
    simulating the LLM returning clean prose (no JSON).
    """
    try:
        data = json.loads(raw_text)
        model_response = ModelResponse(
            reasoning=data.get("reasoning", ""),
            finished=data.get("finished", False),
            message=data.get("message", raw_text),
        )
    except (json.JSONDecodeError, KeyError):
        model_response = ModelResponse(reasoning="", finished=False, message=raw_text)

    async def _reformat(raw: str, stats: list) -> ModelResponse:  # pylint: disable=unused-argument
        return model_response

    return AsyncMock(side_effect=_reformat)


def _make_empty_context() -> ConversationContext:
    return ConversationContext()


@pytest.fixture(autouse=True)
def set_locale():
    """Set the user_language context var required by get_language_style()."""
    token = user_language_ctx_var.set(Locale.EN_US)
    yield
    user_language_ctx_var.reset(token)


@pytest.fixture
def explorer():
    return NonPrioritySectorExplorer()


@pytest.fixture
def mock_app_config():
    """Minimal application config so _build_non_priority_instructions() doesn't blow up."""
    config = MagicMock()
    config.career_explorer_config.sectors = [
        {"name": "Agriculture"},
        {"name": "Energy"},
        {"name": "Mining"},
        {"name": "Hospitality"},
        {"name": "Water"},
    ]
    config.career_explorer_config.country = "Zambia"
    return config


class TestNonPrioritySectorExplorer:
    """Tests for NonPrioritySectorExplorer LLM response parsing and reasoning leak prevention."""

    @pytest.mark.asyncio
    async def test_bug_reproduction_reasoning_not_leaked_to_user(self, explorer, mock_app_config):
        """
        REGRESSION: LLM returns the full chain-of-thought JSON as plain text.

        The 'message' returned to the caller must contain only the user-facing
        text -- NOT the raw JSON blob that includes the 'reasoning' field.
        Stage 2 (_reformat_to_structured) is mocked to simulate response_schema enforcement.
        """
        # GIVEN a raw LLM response containing the full chain-of-thought JSON
        given_raw_text = _BUG_REPORT_RAW_TEXT
        given_mock_response = _make_mock_response(given_raw_text)

        with patch("app.agent.career_explorer_agent.non_priority_sector_explorer.get_application_config",
                   return_value=mock_app_config), \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer.genai") as mock_genai, \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer."
                   "extract_grounding_metadata_from_genai_response", return_value=None):

            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=given_mock_response)
            mock_genai.Client.return_value = mock_client
            explorer._reformat_to_structured = _make_reformat_mock(given_raw_text)

            # WHEN the explorer processes the response
            actual_message, actual_finished, actual_reasoning, actual_llm_stats, actual_metadata = \
                await explorer.explore(
                    user_input="What does an ICT Data Engineer do in Zambia?",
                    context=_make_empty_context(),
                )


        # THEN the user-facing message must be only the human-readable text
        assert actual_message == _EXPECTED_MESSAGE, (
            f"Expected only the human-readable message.\n"
            f"Got: {actual_message[:200]}..."
        )
        # AND the raw JSON must NOT appear in what the user sees
        assert '"reasoning"' not in actual_message, "reasoning field leaked into user-facing message"
        assert '"finished"' not in actual_message, "finished field leaked into user-facing message"
        # AND finished and reasoning are correctly extracted
        assert actual_finished is False
        assert "ICT" in actual_reasoning or actual_reasoning != ""

    @pytest.mark.asyncio
    async def test_happy_path_plain_message_returned(self, explorer, mock_app_config):
        """
        When the LLM returns well-formed JSON, only model_response.message is
        returned to the caller (no reasoning leakage).
        """
        # GIVEN a well-formed JSON response from the LLM
        given_raw_text = json.dumps({
            "reasoning": "This is an internal thought the user should never see.",
            "finished": False,
            "message": "Software development is a growing field in Zambia.",
        })
        given_mock_response = _make_mock_response(given_raw_text)

        with patch("app.agent.career_explorer_agent.non_priority_sector_explorer.get_application_config",
                   return_value=mock_app_config), \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer.genai") as mock_genai, \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer."
                   "extract_grounding_metadata_from_genai_response", return_value=None):

            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=given_mock_response)
            mock_genai.Client.return_value = mock_client
            explorer._reformat_to_structured = _make_reformat_mock(given_raw_text)

            # WHEN the explorer processes the response
            actual_message, actual_finished, actual_reasoning, actual_llm_stats, actual_metadata = \
                await explorer.explore(
                    user_input="Tell me about software jobs in Zambia.",
                    context=_make_empty_context(),
                )


        # THEN only the message field is returned
        assert actual_message == "Software development is a growing field in Zambia."
        # AND no reasoning leaks
        assert '"reasoning"' not in actual_message
        assert actual_finished is False

    @pytest.mark.asyncio
    async def test_llm_returns_plain_text_no_json(self, explorer, mock_app_config):
        """
        When the LLM returns plain prose (no JSON at all), the plain text is
        used as-is for the message -- no crash.
        """
        # GIVEN a plain text response with no JSON
        given_plain_text = "Data engineering in Zambia is a growing field."
        given_mock_response = _make_mock_response(given_plain_text)

        with patch("app.agent.career_explorer_agent.non_priority_sector_explorer.get_application_config",
                   return_value=mock_app_config), \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer.genai") as mock_genai, \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer."
                   "extract_grounding_metadata_from_genai_response", return_value=None):

            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=given_mock_response)
            mock_genai.Client.return_value = mock_client
            explorer._reformat_to_structured = _make_reformat_mock(given_plain_text)

            # WHEN the explorer processes the response
            actual_message, actual_finished, actual_reasoning, actual_llm_stats, actual_metadata = \
                await explorer.explore(
                    user_input="Tell me about data engineering.",
                    context=_make_empty_context(),
                )


        # THEN the plain text is used as the message
        assert actual_message == given_plain_text
        assert actual_finished is False

    # -------------------------------------------------------------------------
    # Edge cases that can trigger the ExtractJSONError fallback (the bug path)
    # -------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_bare_json_fields_without_braces_recovered(self, explorer, mock_app_config):
        """
        THE ACTUAL BUG: LLM returns JSON fields without the wrapping braces.

        e.g. '"reasoning": "...", "finished": false, "message": "..."'
        This causes NoJSONFound on the first parse. The recovery wraps in {}
        and re-parses, extracting the clean message.
        """
        # GIVEN a raw response with JSON fields but no wrapping braces
        given_raw_text = (
            '"reasoning": "The user asked about construction careers in Zambia.",\n'
            '"finished": false,\n'
            '"message": "Construction offers many opportunities in Zambia including civil engineering and architecture."'
        )
        given_mock_response = _make_mock_response(given_raw_text)

        with patch("app.agent.career_explorer_agent.non_priority_sector_explorer.get_application_config",
                   return_value=mock_app_config), \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer.genai") as mock_genai, \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer."
                   "extract_grounding_metadata_from_genai_response", return_value=None):

            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=given_mock_response)
            mock_genai.Client.return_value = mock_client
            # Stage 2 receives the raw text and returns only the message field
            explorer._reformat_to_structured = AsyncMock(return_value=ModelResponse(
                reasoning="The user asked about construction careers in Zambia.",
                finished=False,
                message="Construction offers many opportunities in Zambia including civil engineering and architecture.",
            ))

            # WHEN the explorer processes the response
            actual_message, actual_finished, actual_reasoning, actual_llm_stats, actual_metadata = \
                await explorer.explore(
                    user_input="Tell me about construction careers.",
                    context=_make_empty_context(),
                )

        # THEN the message is extracted cleanly without reasoning
        assert actual_message == "Construction offers many opportunities in Zambia including civil engineering and architecture."
        assert '"reasoning"' not in actual_message
        assert '"finished"' not in actual_message
        assert actual_finished is False

    @pytest.mark.asyncio
    async def test_edge_case_malformed_json_returns_generic_error(self, explorer, mock_app_config):
        """
        EDGE CASE -- ExtractedDataValidationError (not NoJSONFound):
        When the LLM returns something that looks like JSON but fails pydantic
        validation (e.g. empty object {}), extract_json raises
        ExtractedDataValidationError. The recovery also fails, and the raw text
        is used as the message. Since it doesn't contain reasoning markers,
        it passes through safely.
        """
        # GIVEN a response that contains braces but is not valid ModelResponse JSON
        given_raw_text = "Here are some { data } about careers."
        given_mock_response = _make_mock_response(given_raw_text)

        with patch("app.agent.career_explorer_agent.non_priority_sector_explorer.get_application_config",
                   return_value=mock_app_config), \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer.genai") as mock_genai, \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer."
                   "extract_grounding_metadata_from_genai_response", return_value=None):

            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=given_mock_response)
            mock_genai.Client.return_value = mock_client
            explorer._reformat_to_structured = _make_reformat_mock(given_raw_text)

            # WHEN the explorer processes the response
            actual_message, actual_finished, actual_reasoning, actual_llm_stats, actual_metadata = \
                await explorer.explore(
                    user_input="Tell me about careers.",
                    context=_make_empty_context(),
                )


        # THEN no reasoning leaks
        assert actual_finished is False
        assert '"reasoning"' not in actual_message

    @pytest.mark.asyncio
    async def test_edge_case_double_json_from_tool_call_intermediate(self, explorer, mock_app_config):
        """
        EDGE CASE -- Google Search tool produces two JSON blobs concatenated:
        The genai SDK can return a response where response.text is two
        back-to-back JSON objects (tool-call result + final answer).
        """
        # GIVEN two concatenated JSON objects from the LLM
        given_single_json = json.dumps({
            "reasoning": "I searched for ICT Data Engineer roles.",
            "finished": False,
            "message": "ICT Data Engineers in Zambia earn around 220,900 ZMW per year.",
        })
        given_double_json = given_single_json + "\n" + given_single_json
        given_mock_response = _make_mock_response(given_double_json)

        with patch("app.agent.career_explorer_agent.non_priority_sector_explorer.get_application_config",
                   return_value=mock_app_config), \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer.genai") as mock_genai, \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer."
                   "extract_grounding_metadata_from_genai_response", return_value=None):

            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=given_mock_response)
            mock_genai.Client.return_value = mock_client
            explorer._reformat_to_structured = AsyncMock(return_value=ModelResponse(
                reasoning="I searched for ICT Data Engineer roles.",
                finished=False,
                message="ICT Data Engineers in Zambia earn around 220,900 ZMW per year.",
            ))

            # WHEN the explorer processes the response
            actual_message, actual_finished, actual_reasoning, actual_llm_stats, actual_metadata = \
                await explorer.explore(
                    user_input="What does an ICT Data Engineer do in Zambia?",
                    context=_make_empty_context(),
                )


        # THEN reasoning must NOT leak into the user-facing message
        assert '"reasoning"' not in actual_message, (
            "BUG: reasoning field leaked to user when LLM returned double JSON blob.\n"
            f"message was: {actual_message[:300]}"
        )
        assert '"finished"' not in actual_message, (
            "BUG: finished field leaked to user when LLM returned double JSON blob."
        )

    @pytest.mark.asyncio
    async def test_edge_case_json_with_preamble_prose(self, explorer, mock_app_config):
        """
        EDGE CASE -- LLM adds prose before the JSON:
        Some models output explanatory text before the JSON object.
        extract_json handles this via _find_json_start(), so this should work --
        but we confirm reasoning never reaches the user.
        """
        # GIVEN a response with prose followed by valid JSON
        given_raw_text = (
            "Based on my research, here is a detailed answer:\n\n"
            + json.dumps({
                "reasoning": "The user asked about ICT, a non-priority sector. I searched.",
                "finished": False,
                "message": "ICT is a fast-growing sector in Zambia with many opportunities.",
            })
        )
        given_mock_response = _make_mock_response(given_raw_text)

        with patch("app.agent.career_explorer_agent.non_priority_sector_explorer.get_application_config",
                   return_value=mock_app_config), \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer.genai") as mock_genai, \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer."
                   "extract_grounding_metadata_from_genai_response", return_value=None):

            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=given_mock_response)
            mock_genai.Client.return_value = mock_client
            explorer._reformat_to_structured = AsyncMock(return_value=ModelResponse(
                reasoning="The user asked about ICT, a non-priority sector. I searched.",
                finished=False,
                message="ICT is a fast-growing sector in Zambia with many opportunities.",
            ))

            # WHEN the explorer processes the response
            actual_message, actual_finished, actual_reasoning, actual_llm_stats, actual_metadata = \
                await explorer.explore(
                    user_input="Tell me about ICT in Zambia.",
                    context=_make_empty_context(),
                )


        # THEN only the clean message is returned
        assert actual_message == "ICT is a fast-growing sector in Zambia with many opportunities."
        assert '"reasoning"' not in actual_message
        assert actual_finished is False

    @pytest.mark.asyncio
    async def test_hypothesis1_message_field_contains_json_string(self, explorer, mock_app_config):
        """
        CONFIRMED BUG -- Hypothesis 1:
        The LLM outputs a valid outer JSON but the 'message' field value is
        itself the full chain-of-thought JSON string (the LLM echoed its own
        response format inside the message field).
        """
        # GIVEN an outer JSON where the message field contains a nested JSON blob
        given_inner_json = json.dumps({
            "reasoning": (
                "The user's request is about the role of an ICT Data Engineer, which falls under the ICT sector. "
                "Since ICT is not one of the priority sectors in Zambia (Agriculture, Energy, Mining, Hospitality, Water), "
                "I need to use the Google Search tool to gather current information."
            ),
            "finished": False,
            "message": "An ICT Data Engineer in Zambia is responsible for designing data pipelines.",
        })
        given_outer_json = json.dumps({
            "reasoning": "I searched and found relevant information.",
            "finished": False,
            "message": given_inner_json,
        })
        given_mock_response = _make_mock_response(given_outer_json)

        with patch("app.agent.career_explorer_agent.non_priority_sector_explorer.get_application_config",
                   return_value=mock_app_config), \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer.genai") as mock_genai, \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer."
                   "extract_grounding_metadata_from_genai_response", return_value=None):

            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=given_mock_response)
            mock_genai.Client.return_value = mock_client
            # Stage 2 extracts the innermost human-readable message, discarding the nested JSON
            explorer._reformat_to_structured = AsyncMock(return_value=ModelResponse(
                reasoning="I searched and found relevant information.",
                finished=False,
                message="An ICT Data Engineer in Zambia is responsible for designing data pipelines.",
            ))

            # WHEN the explorer processes the response
            actual_message, actual_finished, actual_reasoning, actual_llm_stats, actual_metadata = \
                await explorer.explore(
                    user_input="What does an ICT Data Engineer do in Zambia?",
                    context=_make_empty_context(),
                )


        # THEN the raw JSON must NOT reach the user
        assert '"reasoning"' not in actual_message, (
            "BUG CONFIRMED: LLM embedded JSON in the message field -- reasoning leaked to user.\n"
            f"message was: {actual_message[:300]}"
        )
        assert '"finished"' not in actual_message, (
            "BUG CONFIRMED: finished field leaked to user via embedded JSON in message."
        )
        # AND the actual human-readable text should be returned
        assert "ICT Data Engineer" in actual_message

    @pytest.mark.asyncio
    async def test_edge_case_response_text_raises_valueerror(self, explorer, mock_app_config):
        """
        EDGE CASE -- response.text raises ValueError (known genai SDK behaviour):
        When the model uses the Google Search tool mid-generation, accessing
        response.text on a multi-part response can raise ValueError.
        The outer except should catch this and return the generic error message.
        """
        # GIVEN a mock response where .text raises ValueError
        given_mock_response = MagicMock()
        given_mock_response.usage_metadata.prompt_token_count = 100
        given_mock_response.usage_metadata.candidates_token_count = 0
        given_mock_response.candidates = []

        with patch("app.agent.career_explorer_agent.non_priority_sector_explorer.get_application_config",
                   return_value=mock_app_config), \
             patch.object(type(given_mock_response), 'text',
                          new_callable=PropertyMock,
                          create=True,
                          side_effect=ValueError("Multiple content parts")), \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer.genai") as mock_genai, \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer."
                   "extract_grounding_metadata_from_genai_response", return_value=None):

            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=given_mock_response)
            mock_genai.Client.return_value = mock_client

            # WHEN the explorer processes the response
            actual_message, actual_finished, actual_reasoning, actual_llm_stats, actual_metadata = \
                await explorer.explore(
                    user_input="Tell me about data engineering.",
                    context=_make_empty_context(),
                )

        # THEN the generic fallback error is returned
        assert actual_finished is False
        assert '"reasoning"' not in actual_message
        # AND the error is recorded in llm_stats
        assert len(actual_llm_stats) > 0 and actual_llm_stats[-1].error is not None


class TestNonPrioritySectorExplorerQuickReply:
    """Tests for quick-reply options support in NonPrioritySectorExplorer."""

    @pytest.mark.asyncio
    async def test_quick_reply_options_returned_when_llm_includes_them(self, explorer, mock_app_config):
        """should return quick_reply_options in metadata when the LLM includes them in JSON"""
        # GIVEN LLM returns JSON with quick_reply_options
        given_raw_text = json.dumps({
            "reasoning": "The user asked about IT careers.",
            "finished": False,
            "message": "IT is a growing field. Would you like to know about salaries or required skills?",
            "quick_reply_options": [
                {"label": "Tell me about salaries"},
                {"label": "What skills are needed?"},
            ],
        })
        mock_response = _make_mock_response(given_raw_text)

        with patch("app.agent.career_explorer_agent.non_priority_sector_explorer.get_application_config",
                   return_value=mock_app_config), \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer.genai") as mock_genai, \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer."
                   "extract_grounding_metadata_from_genai_response", return_value=None):

            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
            mock_genai.Client.return_value = mock_client
            explorer._reformat_to_structured = _make_reformat_mock(given_raw_text)

            # WHEN the explorer processes the response
            message, finished, reasoning, llm_stats, actual_metadata = await explorer.explore(
                user_input="Tell me about IT jobs in Zambia.",
                context=_make_empty_context(),
            )

        # THEN the metadata should contain quick_reply_options
        assert actual_metadata is not None
        assert "quick_reply_options" in actual_metadata
        actual_options = actual_metadata["quick_reply_options"]
        assert len(actual_options) == 2
        assert actual_options[0]["label"] == "Tell me about salaries"
        assert actual_options[1]["label"] == "What skills are needed?"

    @pytest.mark.asyncio
    async def test_no_quick_reply_options_when_llm_omits_them(self, explorer, mock_app_config):
        """should NOT have quick_reply_options in metadata when LLM returns JSON without them"""
        # GIVEN LLM returns JSON without quick_reply_options
        given_raw_text = json.dumps({
            "reasoning": "The user asked about data engineering.",
            "finished": False,
            "message": "Data engineering is a growing field in Zambia.",
        })
        mock_response = _make_mock_response(given_raw_text)

        with patch("app.agent.career_explorer_agent.non_priority_sector_explorer.get_application_config",
                   return_value=mock_app_config), \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer.genai") as mock_genai, \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer."
                   "extract_grounding_metadata_from_genai_response", return_value=None):

            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
            mock_genai.Client.return_value = mock_client
            explorer._reformat_to_structured = _make_reformat_mock(given_raw_text)

            # WHEN the explorer processes the response
            message, finished, reasoning, llm_stats, actual_metadata = await explorer.explore(
                user_input="Tell me about data engineering.",
                context=_make_empty_context(),
            )

        # THEN metadata should be None (no quick_reply_options and no grounding metadata)
        assert actual_metadata is None

    @pytest.mark.asyncio
    async def test_quick_reply_options_coexist_with_grounding_metadata(self, explorer, mock_app_config):
        """should include both quick_reply_options and grounding_metadata in metadata when both are present"""
        # GIVEN LLM returns JSON with quick_reply_options
        given_raw_text = json.dumps({
            "reasoning": "The user asked about IT.",
            "finished": False,
            "message": "IT careers in Zambia include developer and analyst roles.",
            "quick_reply_options": [
                {"label": "Tell me more"},
            ],
        })
        mock_response = _make_mock_response(given_raw_text)

        # AND grounding metadata is present from web search
        given_grounding = MagicMock()
        given_grounding.model_dump.return_value = {"web_search_queries": ["IT careers Zambia"]}
        given_grounding.web_search_queries = ["IT careers Zambia"]
        given_grounding.grounding_chunks = []

        with patch("app.agent.career_explorer_agent.non_priority_sector_explorer.get_application_config",
                   return_value=mock_app_config), \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer.genai") as mock_genai, \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer."
                   "extract_grounding_metadata_from_genai_response", return_value=given_grounding):

            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
            mock_genai.Client.return_value = mock_client
            explorer._reformat_to_structured = _make_reformat_mock(given_raw_text)

            # WHEN the explorer processes the response
            message, finished, reasoning, llm_stats, actual_metadata = await explorer.explore(
                user_input="Tell me about IT jobs.",
                context=_make_empty_context(),
            )

        # THEN metadata should contain both quick_reply_options and grounding_metadata
        assert actual_metadata is not None
        assert "quick_reply_options" in actual_metadata
        assert len(actual_metadata["quick_reply_options"]) == 1
        assert actual_metadata["quick_reply_options"][0]["label"] == "Tell me more"
        assert "grounding_metadata" in actual_metadata
        assert actual_metadata["grounding_metadata"]["web_search_queries"] == ["IT careers Zambia"]

    @pytest.mark.asyncio
    async def test_quick_reply_options_absent_on_plain_text_fallback(self, explorer, mock_app_config):
        """should NOT have quick_reply_options when LLM returns plain text (NoJSONFound fallback)"""
        # GIVEN LLM returns plain prose with no JSON
        given_plain_text = "Data engineering in Zambia is a growing field."
        mock_response = _make_mock_response(given_plain_text)

        with patch("app.agent.career_explorer_agent.non_priority_sector_explorer.get_application_config",
                   return_value=mock_app_config), \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer.genai") as mock_genai, \
             patch("app.agent.career_explorer_agent.non_priority_sector_explorer."
                   "extract_grounding_metadata_from_genai_response", return_value=None):

            mock_client = AsyncMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
            mock_genai.Client.return_value = mock_client
            explorer._reformat_to_structured = _make_reformat_mock(given_plain_text)

            # WHEN the explorer processes the response
            message, finished, reasoning, llm_stats, actual_metadata = await explorer.explore(
                user_input="Tell me about data engineering.",
                context=_make_empty_context(),
            )

        # THEN metadata should be None (plain text fallback has no quick_reply_options)
        assert actual_metadata is None
        # AND the message should still be the plain text
        assert message == given_plain_text

