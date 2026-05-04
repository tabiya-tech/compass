"""
Explorer for priority sectors using a hybrid RAG + general knowledge approach.

Answers are sourced in priority order:
  1. Retrieved content (vector search) — used for country-specific facts such as salaries,
     employer names, TEVET qualifications, and local market conditions.
  2. General knowledge — used to fill gaps when retrieved content is thin or absent,
     with hedging language to distinguish locally-verified data from general knowledge.
"""

import logging
from textwrap import dedent

from pydantic import BaseModel

from app.agent.agent_types import LLMStats, LLMQuickReplyOption
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template.locale_style import get_language_style
from app.agent.prompt_template.agent_prompt_template import STD_AGENT_CHARACTER
from app.agent.prompt_template.quick_reply_prompt import QUICK_REPLY_PROMPT
from app.agent.simple_llm_agent.prompt_response_template import get_conversation_finish_instructions, get_json_response_instructions
from app.app_config import get_application_config
from app.i18n.translation_service import t
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, LOW_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG
from common_libs.llm.schema_builder import with_response_schema
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter

from .sector_search_service import SectorChunkEntity, SectorSearchService


class _PrioritySectorResponse(BaseModel):
    reasoning: str
    finished: bool
    message: str
    quick_reply_options: list[LLMQuickReplyOption] | None = None

    class Config:
        extra = "forbid"


def _build_base_instructions(retrieved_content: str) -> str:
    config = get_application_config()
    # Escape braces in QUICK_REPLY_PROMPT so .format() treats them as literals
    escaped_quick_reply = QUICK_REPLY_PROMPT.replace("{", "{{").replace("}", "}}")
    sectors = config.career_explorer_config.sectors
    sector_names = [s["name"] for s in sectors] if sectors else []
    sector_list_str = ", ".join(sector_names) if sector_names else "the priority sectors"
    country_name = config.default_country_of_user.value
    language_style = get_language_style(with_locale=True)
    finish_instructions = get_conversation_finish_instructions(
        "When the user explicitly indicates they are done or want to exit"
    )
    return dedent(f"""\
        <system_instructions>
        # Role
            You are a career exploration counselor helping TEVET graduates in {country_name} discover career opportunities
            in priority sectors. You start by suggesting topics and wait for the user to choose or ask questions.

        {language_style}

        {STD_AGENT_CHARACTER}

        # Instructions
            - Your area of expertise is {country_name}'s priority sectors ({sector_list_str})
            - Answer any career question to the best of your ability
            - For topics outside your expertise, share what you know and be honest about your limitations — never refuse or redirect the user away
            - Be encouraging and conversational

        # How to Use Sources (follow this hierarchy strictly)
            ## Tier 1 — Retrieved Content (highest priority)
                - Always prefer the retrieved content below for {country_name}-specific facts:
                  salaries, employer names, provinces, TEVET qualification requirements, and local market conditions
                - When retrieved content answers the question, use it directly and cite specifics

            ## Tier 2 — General Knowledge (fill the gaps)
                - When retrieved content does not cover the user's question — or covers it only partially —
                  draw on your general knowledge about the sector, career, or role
                - This is expected and encouraged: our local data may not cover every sub-topic
                - Use general knowledge for universal career concepts: day-to-day work, career progression,
                  skills needed, global industry trends, typical entry requirements

            ## Hedging Language Rules
                - When answering from Tier 1 (local data): speak with confidence and cite specifics
                  e.g. "In {country_name}, Drillers can earn K6,300–K15,000+ monthly..."
                - When answering from Tier 2 (general knowledge): signal the scope shift naturally
                  e.g. "Generally in this field...", "Across the industry...", "While I don't have
                  {country_name}-specific data on this, typically..."
                - Never present general knowledge as {country_name}-specific fact

        # Keeping the Conversation Going (CRITICAL)
            You are a career counselor, not a search engine. A search engine dumps facts and stops.
            A counselor stays with the person, keeps them moving, and helps them discover what they
            didn't know to ask. ALWAYS end every response with a nudge — never leave the user
            with nowhere to go.

            Keep the nudge TOPIC-LOCAL: stay inside the sector the user is currently exploring.
            Do NOT cross-pitch other priority sectors unless the user signals they're done with this one.
            EXCEPTION: if a "Periodic Cross-Sector Reminder" block appears later in these
            instructions, you MUST also follow it — it adds a single soft offer after the
            topic-local follow-up. The two are complementary, not in conflict.

            After answering, choose the right nudge:
            - If there is more depth on the current topic → ask a deepening question
              e.g. "Would you like to know about salaries for these roles?"
            - If the current topic feels covered → suggest a related role, specialisation, or angle
              within the same sector
              e.g. "We've covered Driller/Blaster — want to look at the geology or supervisor track next?"
            - If the user is browsing broadly → offer 2–3 concrete options drawn from the current sector

            NEVER end a response with only information. ALWAYS end with a question or invitation.

            ## Example of a GOOD response (ends with a nudge):
            "In mining, roles like Heavy Equipment Repair, Driller/Blaster, and Geologist are in high
            demand — especially mechanics. Over 48% of mining workers earn above K7,500/month.
            Would you like to explore what skills you'd need for these roles, or dig into salary ranges?"

            ## Example of a BAD response — do NOT do this:
            "In mining, roles include Heavy Equipment Repair, Driller/Blaster, and Geologist."

        # Retrieved Content
            Use the following content as your primary source. Supplement with general knowledge where the content is thin or silent.

        {retrieved_content}

        {finish_instructions}

        {escaped_quick_reply}
    """)


_SYSTEM_INSTRUCTIONS_CLOSING_TAG = "\n        </system_instructions>\n"


def _format_chunks(chunks: list[SectorChunkEntity]) -> str:
    if not chunks:
        return (
            "(No local data was retrieved for this query. "
            "Answer using your general knowledge about the relevant sector or career. "
            "Apply the Tier 2 hedging language rules — do not present general knowledge as locally verified fact.)"
        )
    parts = []
    for c in chunks:
        parts.append(f"[{c.sector}]\n{c.text}")
    return "\n\n---\n\n".join(parts)


def _build_priority_nudge_section(should_nudge: bool) -> str:
    """Periodic cross-sector reminder. Only injected on the every-Nth user turn so the
    conversation does not push other priority sectors on every reply."""
    if not should_nudge:
        return ""
    config = get_application_config()
    sectors = config.career_explorer_config.sectors
    sector_names = [s["name"] for s in sectors] if sectors else []
    sector_list_str = ", ".join(sector_names) if sector_names else "the priority sectors"
    return dedent(f"""\

        # Periodic Cross-Sector Reminder (THIS TURN — MANDATORY)
            On this specific turn you MUST append a short, soft offer mentioning the other
            priority sectors ({sector_list_str}). This is not optional — include it on this turn.
            IMPORTANT: This reminder fires periodically. It is EXPECTED that your previous
            turns in this conversation did NOT include this offer — do not let the prior pattern
            override this instruction. On this turn, the offer MUST appear.
            Constraints on the offer:
            - Phrase it softly: an offer, not a redirect. The user should feel free to stay on
              their current sector.
            - Keep it to a single short clause appended AFTER your topic-local follow-up.
            - Do NOT replace the topic-local follow-up with this offer — both must be present.
    """)


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


class PrioritySectorExplorer:
    def __init__(self, sector_search_service: SectorSearchService):
        self._sector_search = sector_search_service
        self._llm_config = LLMConfig(
            generation_config=LOW_TEMPERATURE_GENERATION_CONFIG
            | JSON_GENERATION_CONFIG
            | with_response_schema(_PrioritySectorResponse)
        )
        self._llm_caller = LLMCaller[_PrioritySectorResponse](model_response_type=_PrioritySectorResponse)
        self._logger = logging.getLogger(self.__class__.__name__)

    async def explore(
        self,
        user_input: str,
        context,
        pending_sectors: list[dict] | None = None,
        user_profile_context: str | None = None,
        should_nudge_priority: bool = False,
    ) -> tuple[str, bool, str, list[LLMStats], dict | None]:
        chunks = await self._sector_search.search(query=user_input, k=5)
        retrieved = _format_chunks(chunks)
        full_instructions = _build_base_instructions(retrieved)
        full_instructions += _build_priority_nudge_section(should_nudge_priority)
        full_instructions += _build_pending_sectors_section(pending_sectors)
        full_instructions += _SYSTEM_INSTRUCTIONS_CLOSING_TAG
        if user_profile_context:
            full_instructions = user_profile_context + "\n\n" + full_instructions

        self._logger.info(
            "Priority sector RAG for query '%s': found %d chunks",
            user_input,
            len(chunks),
        )
        for i, chunk in enumerate(chunks):
            preview = chunk.text[:200] + "..." if len(chunk.text) > 200 else chunk.text
            self._logger.info("  Chunk %d [%s] (score=%.4f): %s", i + 1, chunk.sector, chunk.score, preview.replace("\n", " "))

        llm = GeminiGenerativeLLM(system_instructions=full_instructions, config=self._llm_config)
        response_instructions = get_json_response_instructions()
        if should_nudge_priority:
            response_instructions += (
                "\n\n[TURN-SPECIFIC REMINDER] On THIS reply, after your topic-local follow-up, "
                "append one short soft clause offering the other priority sectors as an alternative "
                "(see the Periodic Cross-Sector Reminder block in your system instructions). "
                "Do NOT skip this — it is required on this turn even though it was not present in earlier turns."
            )
        model_response, llm_stats = await self._llm_caller.call_llm(
            llm=llm,
            llm_input=ConversationHistoryFormatter.format_for_agent_generative_prompt(
                model_response_instructions=response_instructions,
                context=context,
                user_input=user_input,
            ),
            logger=self._logger,
        )

        if model_response is None:
            error_msg = t("messages", "careerExplorer.errorRetry", "I'm having trouble right now. Could you try again?")
            return error_msg, False, "", llm_stats, None

        metadata = None
        if model_response.quick_reply_options:
            metadata = {"quick_reply_options": [opt.model_dump() for opt in model_response.quick_reply_options]}
        return (
            model_response.message.strip('"'),
            model_response.finished,
            model_response.reasoning,
            llm_stats,
            metadata,
        )
