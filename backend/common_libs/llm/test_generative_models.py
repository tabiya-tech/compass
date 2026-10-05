"""
Tests for the Gemini LLM on the google-genai Interactions API.
"""
from types import SimpleNamespace
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import BaseModel, Field

from common_libs.llm.generative_models import GeminiGenerativeLLM, llm_input_to_interactions_input, response_format_for
from common_libs.llm.models_utils import LLMConfig, LLMInput, LLMTurn, DEFAULT_SAFETY_SETTINGS
from common_libs.llm.schema_builder import with_response_schema


class _Response(BaseModel):
    reasoning: str = Field(description="Why")
    answer: Optional[int] = Field(default=None, description="The answer")


def _fake_interaction(*, output_text: str = "foo", usage=None):
    return SimpleNamespace(
        output_text=output_text,
        usage=usage if usage is not None else SimpleNamespace(total_input_tokens=11, total_output_tokens=22),
    )


def _patch_client(given_interaction) -> tuple:
    """Patch the google-genai client, returning the patcher and the mock of interactions.create."""
    mock_create = AsyncMock(return_value=given_interaction)
    mock_client = MagicMock()
    mock_client.aio.interactions.create = mock_create
    return patch("common_libs.llm.generative_models.get_genai_client", return_value=mock_client), mock_create


class TestLLMInputToInteractionsInput:
    def test_string_input_is_kept(self):
        # GIVEN a string input
        given_input = "foo"

        # WHEN it is converted
        actual_input = llm_input_to_interactions_input(given_input)

        # THEN expect the same string
        assert actual_input == given_input

    def test_turns_are_converted_to_steps(self):
        # GIVEN a conversation with user and model turns
        given_input = LLMInput(turns=[LLMTurn(role="user", content="hi"), LLMTurn(role="model", content="hello")])

        # WHEN it is converted
        actual_input = llm_input_to_interactions_input(given_input)

        # THEN expect a user input step and a model output step, in order
        assert actual_input == [
            {"type": "user_input", "content": [{"type": "text", "text": "hi"}]},
            {"type": "model_output", "content": [{"type": "text", "text": "hello"}]},
        ]


    def test_empty_string_input_is_sent_as_a_blank_text(self):
        # GIVEN an empty string input
        given_input = ""

        # WHEN it is converted
        actual_input = llm_input_to_interactions_input(given_input)

        # THEN expect a blank text, as the API rejects an empty text
        assert actual_input == " "

    def test_empty_turn_is_sent_as_a_step_without_content(self):
        # GIVEN a conversation whose first user turn is empty
        given_input = LLMInput(turns=[LLMTurn(role="user", content=""), LLMTurn(role="model", content="hello")])

        # WHEN it is converted
        actual_input = llm_input_to_interactions_input(given_input)

        # THEN expect the empty turn as a step without content, as the API rejects an empty text
        assert actual_input == [
            {"type": "user_input"},
            {"type": "model_output", "content": [{"type": "text", "text": "hello"}]},
        ]


class TestResponseFormatFor:
    def test_schema_of_the_pydantic_class(self):
        # GIVEN a response schema
        # WHEN the response format is built
        actual_format = response_format_for({}, _Response)

        # THEN expect a JSON response format with the JSON schema of the class, including the field descriptions
        assert actual_format == {"type": "text", "mime_type": "application/json", "schema": _Response.model_json_schema()}
        assert actual_format["schema"]["properties"]["answer"]["description"] == "The answer"

    def test_json_without_schema(self):
        # GIVEN a JSON generation config without a schema
        # WHEN the response format is built
        actual_format = response_format_for({"response_mime_type": "application/json"}, None)

        # THEN expect a JSON response format without a schema
        assert actual_format == {"type": "text", "mime_type": "application/json"}

    def test_plain_text(self):
        # GIVEN a generation config without a response mime type
        # WHEN the response format is built
        actual_format = response_format_for({"temperature": 0.1}, None)

        # THEN expect no response format
        assert actual_format is None


class TestGeminiGenerativeLLM:
    @pytest.mark.asyncio
    async def test_sends_the_request_and_returns_the_response(self, setup_application_config):
        # GIVEN an LLM with system instructions and a generation config with an unsupported parameter
        given_llm = GeminiGenerativeLLM(
            system_instructions=["foo", "bar"],
            config=LLMConfig(language_model_name="given-model",
                             generation_config={"temperature": 0.3, "top_p": 0.9, "candidate_count": 1}))
        # AND the API returns an interaction
        given_interaction = _fake_interaction(output_text='{"reasoning": "r", "answer": 1}')
        client_patch, mock_create = _patch_client(given_interaction)

        # WHEN content is generated with a response schema
        with client_patch:
            actual_response = await given_llm.generate_content("baz", response_schema=_Response)

        # THEN expect the request to the Interactions API
        actual_request = mock_create.call_args.kwargs
        assert actual_request["model"] == "given-model"
        assert actual_request["input"] == "baz"
        assert actual_request["system_instruction"] == "foo\nbar"
        # AND only the supported generation parameters
        assert actual_request["generation_config"] == {"temperature": 0.3, "top_p": 0.9}
        # AND the structured output of the response schema
        assert actual_request["response_format"]["schema"] == _Response.model_json_schema()
        # AND the safety settings
        assert actual_request["safety_settings"] == [dict(setting) for setting in DEFAULT_SAFETY_SETTINGS]
        # AND the interaction not to be stored, as the history is sent with every request
        assert actual_request["store"] is False
        # AND expect the text and the token counts of the response
        assert actual_response.text == given_interaction.output_text
        assert actual_response.prompt_token_count == 11
        assert actual_response.response_token_count == 22

    @pytest.mark.asyncio
    async def test_uses_the_response_schema_of_the_generation_config(self, setup_application_config):
        # GIVEN an LLM with a response schema in its generation config
        given_llm = GeminiGenerativeLLM(config=LLMConfig(generation_config=with_response_schema(_Response)))
        client_patch, mock_create = _patch_client(_fake_interaction())

        # WHEN content is generated without a response schema for the call
        with client_patch:
            await given_llm.generate_content("foo")

        # THEN expect the structured output of the generation config's response schema
        assert mock_create.call_args.kwargs["response_format"]["schema"] == _Response.model_json_schema()
        # AND no system instruction, as none was given
        assert "system_instruction" not in mock_create.call_args.kwargs

    @pytest.mark.asyncio
    async def test_generation_config_is_read_at_call_time(self, setup_application_config):
        # GIVEN an LLM
        given_llm = GeminiGenerativeLLM(config=LLMConfig(generation_config={"temperature": 0.1}))
        client_patch, mock_create = _patch_client(_fake_interaction())

        # WHEN the temperature is changed before content is generated
        given_llm.generation_config["temperature"] = 0.7
        with client_patch:
            await given_llm.generate_content("foo")

        # THEN expect the changed temperature to be sent
        assert mock_create.call_args.kwargs["generation_config"] == {"temperature": 0.7}

    @pytest.mark.asyncio
    async def test_missing_usage_and_text(self, setup_application_config):
        # GIVEN the API returns an interaction without usage and output text
        given_llm = GeminiGenerativeLLM()
        client_patch, _ = _patch_client(SimpleNamespace(output_text=None, usage=None))

        # WHEN content is generated
        with client_patch:
            actual_response = await given_llm.generate_content("foo")

        # THEN expect an empty text and zero token counts
        assert actual_response.text == ""
        assert actual_response.prompt_token_count == 0
        assert actual_response.response_token_count == 0
