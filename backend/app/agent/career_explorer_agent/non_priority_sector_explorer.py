"""
Explorer for non-priority sectors using Google Search grounding. Answers about careers outside priority sectors.
Uses google-genai SDK (Tool with google_search) as vertexai's google_search_retrieval is deprecated.
"""

import logging
import os
from textwrap import dedent

from google import genai
from google.genai import types
from google.genai.types import GenerateContentConfig, GoogleSearch, HttpOptions, Tool, GroundingMetadata
from common_libs.text_formatters import extract_json
from common_libs.text_formatters.extract_json import ExtractJSONError

from app.agent.agent_types import LLMStats
from app.agent.prompt_template.locale_style import get_language_style
from app.agent.prompt_template.agent_prompt_template import STD_AGENT_CHARACTER
from app.agent.simple_llm_agent.llm_response import ModelResponse
from app.agent.simple_llm_agent.prompt_response_template import get_conversation_finish_instructions, get_json_response_instructions
from app.app_config import get_application_config
from app.i18n.translation_service import t
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.agent.config import AgentsConfig
from common_libs.llm.utils import extract_grounding_metadata_from_genai_response
from common_libs.llm.models_utils import DEFAULT_VERTEX_API_REGION


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
              sector information. Would you like to know about careers in {sector_list_str} or another field?"
            - Keep answers focused on career and employment context
            - Prefer {country_name}-relevant information when available

        # Instructions
            - You answer questions about ANY career or sector, not just TEVET-related or priority sectors
            - CRITICAL: When asked about careers outside priority sectors ({sector_list_str}), you MUST use the Google Search tool that is available to you
            - The Google Search tool will search the web and provide you with current information - use it for every non-priority sector question
            - After the search tool provides results, answer the question using those search results and your knowledge of the topic
            - DO NOT say "I'll search", "let me search", "I need to search", or "bear with me" - just use the tool silently and answer
            - DO NOT ask permission - use the search tool immediately and provide the answer
            - DO NOT deflect or redirect when asked about non-priority sectors - always use search and answer
            - Always use the search tool for non-priority sectors - never assume you have current information
            - Be encouraging and conversational
            - If asked about priority sectors ({sector_list_str}), suggest the user can get detailed info there

        # Keeping the Conversation Going
            ALWAYS end every response with a nudge — never leave the user with nowhere to go.

            After answering, choose one:
            - If the topic feels covered: bridge naturally back to priority sectors ({sector_list_str}),
              which have rich, locally-verified data for {country_name}.
            - If the user needs more depth: ask one follow-up question, then offer the priority sectors
              as an alternative.
            - If broadly browsing: offer 2–3 options, always including at least one priority sector.

            Example ending: "Want to go deeper into IT — or explore {sector_list_str} where we have
            detailed local data for {country_name}?"

        {finish_instructions}
        </system_instructions>
    """).format(sector_list_str=sector_list_str)


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
            IMPORTANT: Do not redirect the user away from these sectors — they explicitly asked about them.
            Acknowledge ALL of them in your first response, then explore the current sector first.
            When the current topic reaches a natural pause (user's question has been answered, they say "ok"/"thanks",
            or the conversation on this sector winds down), proactively transition to the next pending sector.
            Example: "Now, you also mentioned interest in {next_sector}. Let me tell you about opportunities there..."
            Do NOT rush — finish the current topic first, then transition naturally.
    """)


class NonPrioritySectorExplorer:
    def __init__(self):
        self._logger = logging.getLogger(self.__class__.__name__)

    async def explore(
        self,
        user_input: str,
        context,
        pending_sectors: list[dict] | None = None,
        user_profile_context: str | None = None,
    ) -> tuple[str, bool, str, list[LLMStats], GroundingMetadata | None]:
        full_instructions = _build_non_priority_instructions()
        full_instructions += _build_pending_sectors_section(pending_sectors)
        if user_profile_context:
            full_instructions = user_profile_context + "\n\n" + full_instructions
        example_response = ModelResponse(
            reasoning="The user asked about a non-priority sector, so I used Google Search to find current information and provided a substantive answer.",
            finished=False,
            message="Software development is a growing field in Zambia with opportunities in web development, mobile apps, and enterprise software. According to recent job postings, roles include Software Developer, Full-Stack Developer, and Mobile App Developer.",
        )
        llm_input = ConversationHistoryFormatter.format_for_agent_generative_prompt(
            model_response_instructions=get_json_response_instructions(examples=[example_response]),
            context=context,
            user_input=user_input,
        )
        contents = _llm_input_to_contents(llm_input)

        project = os.getenv("GOOGLE_CLOUD_PROJECT")
        location = os.getenv("VERTEX_API_REGION") or DEFAULT_VERTEX_API_REGION
        client = genai.Client(
            vertexai=True,
            project=project,
            location=location,
            http_options=HttpOptions(api_version="v1"),
        )

        config = GenerateContentConfig(
            system_instruction=full_instructions,
            tools=[Tool(google_search=GoogleSearch())],
            temperature=1.0,
        )

        llm_stats: list[LLMStats] = []
        grounding_metadata: GroundingMetadata | None = None
        model_response: ModelResponse | None = None

        try:
            response = await client.aio.models.generate_content(
                model=AgentsConfig.default_model,
                contents=contents,
                config=config,
            )
            llm_stats.append(
                LLMStats(
                    prompt_token_count=getattr(response.usage_metadata, "prompt_token_count", 0) or 0,
                    response_token_count=getattr(response.usage_metadata, "candidates_token_count", 0) or 0,
                    response_time_in_sec=0,
                )
            )
            raw_text = response.text
            self._logger.debug("Raw LLM response text (first 500 chars): %.500s", raw_text)
            if raw_text:
                try:
                    model_response = extract_json.extract_json(raw_text, ModelResponse)
                    self._logger.debug("Parsed model_response — finished: %s | message (first 200): %.200s",
                                       model_response.finished, model_response.message)
                except ExtractJSONError:
                    # The LLM sometimes returns JSON fields without the wrapping braces.
                    # Try wrapping in {} and re-parsing before falling back to raw text.
                    wrapped = "{" + raw_text.strip() + "}"
                    try:
                        model_response = extract_json.extract_json(wrapped, ModelResponse)
                        self._logger.info("Recovered model_response by wrapping raw text in braces")
                    except Exception as recovery_err:  # pylint: disable=broad-except
                        self._logger.warning("No JSON found in LLM response, using raw text as message: %s", recovery_err)
                        model_response = ModelResponse(
                            reasoning="",
                            finished=False,
                            message=raw_text.strip(),
                        )

            grounding_metadata = extract_grounding_metadata_from_genai_response(response)
        except Exception as e:  # pylint: disable=broad-except
            self._logger.exception("Non-priority explorer LLM call failed: %s", e)
            llm_stats.append(
                LLMStats(error=str(e), prompt_token_count=0, response_token_count=0, response_time_in_sec=0)
            )

        if grounding_metadata:
            self._logger.info(
                "Web search for query '%s': search_queries=%s, sources_count=%d",
                user_input,
                grounding_metadata.web_search_queries,
                len(grounding_metadata.grounding_chunks),
            )
            for i, chunk in enumerate(grounding_metadata.grounding_chunks[:5]):
                if chunk.web:
                    uri = chunk.web.uri
                    title = chunk.web.title
                    self._logger.info("  Source %d: %s | %s", i + 1, title or "(no title)", uri[:80] + "..." if len(uri) > 80 else uri)
        else:
            self._logger.info("Web search for query '%s': no grounding metadata returned", user_input)

        if model_response is None:
            error_msg = t("messages", "careerExplorer.errorRetry", "I'm having trouble right now. Could you try again?")
            return error_msg, False, "", llm_stats, None

        message = model_response.message.strip('"').strip() if model_response.message else ""

        # Guard: if the message field itself contains a JSON blob (the LLM echoed its own
        # response format inside the message), unwrap and replace the full model_response.
        if message.startswith("{") and '"message"' in message:
            try:
                inner = extract_json.extract_json(message, ModelResponse)
                if inner.message:
                    model_response = inner
                    message = inner.message.strip('"').strip()
                else:
                    # Inner JSON parsed but has no message — return error fallback
                    self._logger.warning("Inner JSON has no message field, using fallback")
                    error_msg = t("messages", "careerExplorer.errorRetry", "I'm having trouble right now. Could you try again?")
                    return error_msg, False, "", llm_stats, None
            except Exception as unwrap_err:  # pylint: disable=broad-except
                self._logger.warning(
                    "Guard: message starts with '{' and contains '\"message\"' but failed to unwrap as JSON. "
                    "This may cause raw JSON/reasoning to leak to the user. Error: %s | Message content: %.500s",
                    unwrap_err, message
                )

        # Final safety check: if the message looks like leaked JSON structure
        # (contains BOTH "reasoning" and "finished" markers — a single marker alone
        # could appear in legitimate career-related prose), attempt recovery.
        _json_markers_found = sum(1 for m in ['"reasoning"', '"finished"'] if m in message)
        if _json_markers_found >= 2:
            self._logger.warning(
                "REASONING LEAK DETECTED: outgoing message contains JSON structure markers. "
                "Attempting recovery. Message (first 500 chars): %.500s", message
            )
            try:
                recovered = extract_json.extract_json("{" + message + "}", ModelResponse)
                if recovered.message:
                    message = recovered.message.strip('"').strip()
                    model_response = recovered
                    self._logger.info("Recovered clean message from leaked content")
            except Exception as recover_err:  # pylint: disable=broad-except
                # Last resort: return error rather than leaking reasoning
                self._logger.error("Could not recover from reasoning leak, returning error fallback: %s", recover_err)
                error_msg = t("messages", "careerExplorer.errorRetry",
                              "I'm having trouble right now. Could you try again?")
                return error_msg, False, "", llm_stats, grounding_metadata

        if not message:
            self._logger.warning("Model returned empty message, using fallback")
            error_msg = t("messages", "careerExplorer.errorRetry", "I'm having trouble right now. Could you try again?")
            return error_msg, False, "", llm_stats, None

        return (
            message,
            model_response.finished,
            model_response.reasoning,
            llm_stats,
            grounding_metadata,
        )
