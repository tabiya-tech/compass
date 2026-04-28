"""
Explorer for non-priority sectors using Google Search grounding. Answers about careers outside priority sectors.
Uses google-genai SDK (Tool with google_search) as vertexai's google_search_retrieval is deprecated.

Two-stage design
----------------
Stage 1 (Google Search grounded call): generates a free-text answer using live web results.
         Cannot use structured outputs because the Gemini API disallows response_schema when
         tools are active.
Stage 2 (structured reformat call): takes the raw Stage-1 text and reformats it into the
         required {reasoning, finished, message} JSON using response_schema enforcement.
         This guarantees reasoning never leaks into the message field sent to the user.
"""

import json
import logging
import os
from textwrap import dedent

from google import genai
from google.genai import types
from google.genai.types import GenerateContentConfig, GoogleSearch, HttpOptions, Tool, GroundingMetadata

from app.agent.agent_types import LLMStats, LLMQuickReplyOption
from app.agent.config import AgentsConfig
from app.agent.prompt_template.agent_prompt_template import STD_AGENT_CHARACTER
from app.agent.prompt_template.locale_style import get_language_style
from app.agent.prompt_template.quick_reply_prompt import QUICK_REPLY_PROMPT
from app.agent.simple_llm_agent.llm_response import ModelResponse
from app.agent.simple_llm_agent.prompt_response_template import get_conversation_finish_instructions
from app.agent.llm_caller import LLMCaller
from app.app_config import get_application_config
from app.i18n.translation_service import t
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.utils import extract_grounding_metadata_from_genai_response
from common_libs.llm.models_utils import DEFAULT_VERTEX_API_GEN_AI_REGION, LLMConfig, LOW_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG
from common_libs.llm.schema_builder import with_response_schema


def _build_non_priority_instructions() -> str:
    config = get_application_config()
    sectors = config.career_explorer_config.sectors
    sector_names = [s["name"] for s in sectors] if sectors else []
    sector_list_str = ", ".join(sector_names) if sector_names else "the priority sectors"
    country_name = config.career_explorer_config.country
    language_style = get_language_style(with_locale=True)
    finish_instructions = get_conversation_finish_instructions(
        "When the user explicitly indicates they are done or want to exit"
    )
    escaped_quick_reply = QUICK_REPLY_PROMPT.replace("{", "{{").replace("}", "}}")
    return dedent(f"""\
        <system_instructions>
        # Role
            You are a career exploration counselor helping people in {country_name} explore careers and sectors.
            You answer questions about ANY career, sector, or employment field using your knowledge and web search.

        {language_style}

        {STD_AGENT_CHARACTER}

        # Guard Rails (stay on topic)
            - Only answer questions related to: careers, sectors, employment, jobs, industries, or work in {country_name}
            - If the user asks about something completely unrelated (e.g. sports, recipes, entertainment,
              politics, personal advice), politely redirect: "I'm here to help with career exploration and
              sector information. Would you like to know about careers in {{sector_list_str}} or another field?"
            - Keep answers focused on career and employment context
            - Prefer {country_name}-relevant information when available

        # Instructions
            - You answer questions about ANY career or sector, not just TEVET-related or priority sectors
            - CRITICAL: When asked about careers outside priority sectors ({{sector_list_str}}), you MUST use the Google Search tool that is available to you
            - The Google Search tool will search the web and provide you with current information - use it for every non-priority sector question
            - After the search tool provides results, answer the question using those search results and your knowledge of the topic
            - DO NOT say "I'll search", "let me search", "I need to search", or "bear with me" - just use the tool silently and answer
            - DO NOT ask permission - use the search tool immediately and provide the answer
            - DO NOT deflect or redirect when asked about non-priority sectors - always use search and answer
            - Always use the search tool for non-priority sectors - never assume you have current information
            - Be encouraging and conversational
            - If asked about priority sectors ({{sector_list_str}}), suggest the user can get detailed info there

        # Keeping the Conversation Going
            ALWAYS end every response with a nudge — never leave the user with nowhere to go.

            After answering, choose one:
            - If the topic feels covered: bridge naturally back to priority sectors ({{sector_list_str}}),
              which have rich, locally-verified data for {country_name}.
            - If the user needs more depth: ask one follow-up question, then offer the priority sectors
              as an alternative.
            - If broadly browsing: offer 2-3 options, always including at least one priority sector.

            Example ending: "Want to go deeper into IT - or explore {{sector_list_str}} where we have
            detailed local data for {country_name}?"

        {finish_instructions}

        {escaped_quick_reply}
        </system_instructions>
    """).format(sector_list_str=sector_list_str)


_REFORMAT_SYSTEM_INSTRUCTIONS = dedent("""\
    You are a JSON formatter. You will be given a career counselor's response text.
    Your only job is to reformat it into the required JSON structure.

    Rules:
    - "message": the user-facing reply only -- clean prose, no JSON, no internal notes
    - "reasoning": a brief internal note on what the response covers
    - "finished": true only if the counselor explicitly indicated the conversation is ending

    Do not add, remove, or change any information from the original response.
""")


def _llm_input_to_contents(llm_input) -> list[types.Content]:
    contents = []
    for turn in llm_input.turns:
        role = "user" if turn.role == "user" else "model"
        part = types.Part.from_text(text=turn.content)
        contents.append(types.Content(role=role, parts=[part]))
    return contents


def _build_pending_sectors_section(pending_sectors: list[dict] | None) -> str:
    if not pending_sectors:
        return ""
    formatted = ", ".join(s["sector_name"] for s in pending_sectors)
    next_sector = pending_sectors[0]["sector_name"]
    return dedent(f"""\

        # Pending Sectors
            The user has also expressed interest in these sectors (not yet explored): {formatted}
            IMPORTANT: Do not redirect the user away from these sectors -- they explicitly asked about them.
            Acknowledge ALL of them in your first response, then explore the current sector first.
            When the current topic reaches a natural pause (user's question has been answered, they say "ok"/"thanks",
            or the conversation on this sector winds down), proactively transition to the next pending sector.
            Example: "Now, you also mentioned interest in {next_sector}. Let me tell you about opportunities there..."
            Do NOT rush -- finish the current topic first, then transition naturally.
    """)


class NonPrioritySectorExplorer:
    def __init__(self):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._reformat_llm_config = LLMConfig(
            generation_config=LOW_TEMPERATURE_GENERATION_CONFIG
            | JSON_GENERATION_CONFIG
            | with_response_schema(ModelResponse)
        )
        self._reformat_caller = LLMCaller[ModelResponse](model_response_type=ModelResponse)

    async def _reformat_to_structured(
        self, raw_text: str, llm_stats: list[LLMStats]
    ) -> ModelResponse | None:
        """Stage 2: reformat raw Stage-1 text into a structured ModelResponse using response_schema."""
        llm = GeminiGenerativeLLM(
            system_instructions=_REFORMAT_SYSTEM_INSTRUCTIONS,
            config=self._reformat_llm_config,
        )
        model_response, reformat_stats = await self._reformat_caller.call_llm(
            llm=llm,
            llm_input=raw_text,
            logger=self._logger,
        )
        llm_stats.extend(reformat_stats)
        return model_response

    async def explore(
        self,
        user_input: str,
        context,
        pending_sectors: list[dict] | None = None,
        user_profile_context: str | None = None,
    ) -> tuple[str, bool, str, list[LLMStats], dict | None]:
        full_instructions = _build_non_priority_instructions()
        full_instructions += _build_pending_sectors_section(pending_sectors)
        if user_profile_context:
            full_instructions = user_profile_context + "\n\n" + full_instructions

        llm_input = ConversationHistoryFormatter.format_for_agent_generative_prompt(
            model_response_instructions="Respond conversationally. Your answer will be reformatted into JSON automatically.",
            context=context,
            user_input=user_input,
        )
        contents = _llm_input_to_contents(llm_input)

        project = os.getenv("GOOGLE_CLOUD_PROJECT")
        location = os.getenv("VERTEX_API_GEN_AI_REGION") or DEFAULT_VERTEX_API_GEN_AI_REGION
        client = genai.Client(
            vertexai=True,
            project=project,
            location=location,
            http_options=HttpOptions(api_version="v1"),
        )

        stage1_config = GenerateContentConfig(
            system_instruction=full_instructions,
            tools=[Tool(google_search=GoogleSearch())],
            temperature=1.0,
        )

        llm_stats: list[LLMStats] = []
        grounding_metadata: GroundingMetadata | None = None
        raw_text: str | None = None

        # Stage 1: Google Search grounded call -- produces free-text answer
        try:
            response = await client.aio.models.generate_content(
                model=AgentsConfig.default_model,
                contents=contents,
                config=stage1_config,
            )
            llm_stats.append(
                LLMStats(
                    prompt_token_count=getattr(response.usage_metadata, "prompt_token_count", 0) or 0,
                    response_token_count=getattr(response.usage_metadata, "candidates_token_count", 0) or 0,
                    response_time_in_sec=0,
                )
            )
            raw_text = response.text
            self._logger.debug("Stage 1 raw response (first 500 chars): %.500s", raw_text)
            grounding_metadata = extract_grounding_metadata_from_genai_response(response)
        except Exception as e:  # pylint: disable=broad-except
            self._logger.exception("Stage 1 (Google Search) LLM call failed: %s", e)
            llm_stats.append(
                LLMStats(error=str(e), prompt_token_count=0, response_token_count=0, response_time_in_sec=0)
            )

        if grounding_metadata:
            self._logger.info(
                "Web search for query '%s': search_queries=%s, sources_count=%d",
                user_input,
                grounding_metadata.web_search_queries,
                len(grounding_metadata.grounding_chunks or []),
            )
            for i, chunk in enumerate((grounding_metadata.grounding_chunks or [])[:5]):
                if chunk.web:
                    uri = chunk.web.uri
                    title = chunk.web.title
                    self._logger.info("  Source %d: %s | %s", i + 1, title or "(no title)", uri[:80] + "..." if len(uri) > 80 else uri)
        else:
            self._logger.info("Web search for query '%s': no grounding metadata returned", user_input)

        if not raw_text:
            error_msg = t("messages", "careerExplorer.errorRetry", "I'm having trouble right now. Could you try again?")
            return error_msg, False, "", llm_stats, None

        # Extract quick_reply_options from Stage 1 JSON before Stage 2 strips unknown fields.
        quick_reply_options: list[LLMQuickReplyOption] | None = None
        try:
            raw_data = json.loads(raw_text)
            raw_options = raw_data.get("quick_reply_options")
            if raw_options:
                quick_reply_options = [LLMQuickReplyOption(**opt) for opt in raw_options]
        except Exception as e:  # pylint: disable=broad-except
            self._logger.debug("Could not extract quick_reply_options from Stage 1 response: %s", e)

        # Stage 2: structured reformat -- enforces response_schema, reasoning cannot leak
        model_response = await self._reformat_to_structured(raw_text, llm_stats)

        if model_response is None:
            error_msg = t("messages", "careerExplorer.errorRetry", "I'm having trouble right now. Could you try again?")
            return error_msg, False, "", llm_stats, None

        message = model_response.message.strip('"').strip() if model_response.message else ""
        if not message:
            error_msg = t("messages", "careerExplorer.errorRetry", "I'm having trouble right now. Could you try again?")
            return error_msg, False, "", llm_stats, None

        metadata: dict | None = None
        if grounding_metadata:
            metadata = {"grounding_metadata": grounding_metadata.model_dump(mode="json")}
        if quick_reply_options:
            if metadata is None:
                metadata = {}
            metadata["quick_reply_options"] = [opt.model_dump() for opt in quick_reply_options]

        return (
            message,
            model_response.finished,
            model_response.reasoning,
            llm_stats,
            metadata,
        )
