"""
Career readiness agent that chats with users grounded in module content.

Uses composition to wrap a SimpleLLMAgent — this agent is standalone and is
NOT part of the AgentDirector pipeline.
"""
import logging
import re
import time
from dataclasses import dataclass, field
from enum import Enum
from textwrap import dedent
from typing import Type

from pydantic import BaseModel, ConfigDict, create_model, model_validator

from app.agent.agent_types import AgentInput, AgentOutput, AgentType, LLMQuickReplyOption, LLMStats, AgentOutputWithReasoning
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template.locale_style import get_language_style
from app.app_config import get_application_config
from app.context_vars import user_language_ctx_var
from app.i18n.types import Locale
from app.agent.prompt_template.quick_reply_prompt import QUICK_REPLY_PROMPT
from app.agent.prompt_template.format_prompt import append_user_ctx
from app.agent.simple_llm_agent.prompt_response_template import (
    get_json_response_instructions,
)
from app.career_readiness.types import ConversationMode, TopicStatusRecord
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, LOW_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG
from common_libs.llm.schema_builder import with_response_schema


class CareerReadinessModelResponse(BaseModel):
    """
    Custom response schema for the career readiness agent.

    Order matters for model prediction quality:
    1. reasoning — sets context
    2. topic_status — full coverage report (one entry per canonical module topic)
    3. message — the message shown to the student
    4. quick_reply_options — optional follow-up buttons

    The LLM does not decide completion; the server computes `finished` from
    `topic_status`. `topic_status` is the single source of truth for coverage.
    """

    model_config = ConfigDict(extra="forbid")

    reasoning: str
    """Chain of Thought reasoning behind the response"""

    topic_status: list[TopicStatusRecord] = []
    """Full coverage state: one TopicStatusRecord per canonical module topic. The
    per-module dynamic subclass enforces the one-entry-per-topic contract."""

    message: str
    """Message for the user"""

    quick_reply_options: list[LLMQuickReplyOption] | None = None
    """Optional quick-reply button labels"""


@dataclass
class CareerReadinessAgentOutput:
    """Wraps AgentOutput with per-turn topic status data from the custom response schema."""

    agent_output: AgentOutput
    """The standard agent output (message, stats, etc.)"""

    proposed_topic_status: list[TopicStatusRecord] = field(default_factory=list)
    """The LLM's proposed per-topic status for this turn; the service merges this
    monotonically against prior state to produce the authoritative coverage."""


def _safe_enum_member_name(topic: str, index: int) -> str:
    """Build a valid Python identifier for an Enum member from an arbitrary topic string."""
    cleaned = re.sub(r"[^0-9A-Za-z]+", "_", topic).strip("_").upper()
    if not cleaned or cleaned[0].isdigit():
        cleaned = f"T_{cleaned}" if cleaned else "T"
    return f"{cleaned}_{index}"


def _render_state_block(current_topic_status: list[TopicStatusRecord]) -> str:
    """Render the authoritative-from-server topic_status block injected into the LLM prompt each turn."""
    if not current_topic_status:
        lines = ["(no topics — this module does not track coverage)"]
    else:
        lines = []
        for record in current_topic_status:
            topic_id = record.topic_id.value if isinstance(record.topic_id, Enum) else record.topic_id
            if record.evidence:
                lines.append(f'- "{topic_id}": {record.status.value} — evidence: "{record.evidence}"')
            else:
                lines.append(f'- "{topic_id}": {record.status.value}')
    return "# Conversation State (authoritative — from server)\nCurrent topic_status:\n" + "\n".join(lines)


def _unwrap_topic_status_record(record: TopicStatusRecord) -> TopicStatusRecord:
    """Coerce any dynamic-enum topic_id to its plain string value for downstream use."""
    if isinstance(record.topic_id, Enum):
        return TopicStatusRecord(
            topic_id=record.topic_id.value,
            status=record.status,
            evidence=record.evidence,
        )
    return record


_module_response_model_cache: dict[tuple[str, ...], Type[CareerReadinessModelResponse]] = {}


def _build_module_response_model(
    topics: list[str],
) -> Type[CareerReadinessModelResponse]:
    """Build a per-module response model where topic_status is enum-constrained to the module's topics and requires exactly one entry per topic (cached by topics tuple)."""
    if not topics:
        return CareerReadinessModelResponse

    cache_key = tuple(topics)
    cached_model = _module_response_model_cache.get(cache_key)
    if cached_model is not None:
        return cached_model

    enum_members = {
        _safe_enum_member_name(topic, i): topic
        for i, topic in enumerate(topics)
    }
    topics_enum = Enum("TopicsEnum", enum_members, type=str)
    canonical_topic_values = frozenset(topics)

    dynamic_record = create_model(
        "TopicStatusRecordWithTopicEnum",
        __base__=TopicStatusRecord,
        topic_id=(topics_enum, ...),
    )

    class CareerReadinessModelResponseWithTopicEnum(CareerReadinessModelResponse):
        # Intentionally no default: keeps this in Pydantic's `required` list so
        # Vertex AI structured output enforces it (default -> not required -> omittable).
        topic_status: list[dynamic_record]  # type: ignore[valid-type]

        @model_validator(mode="after")
        def _enforce_one_record_per_topic(self):
            records = self.topic_status
            if len(records) != len(canonical_topic_values):
                raise ValueError(
                    f"topic_status must contain exactly one entry per module topic "
                    f"(expected {len(canonical_topic_values)}, got {len(records)})"
                )
            seen_ids = {
                r.topic_id.value if isinstance(r.topic_id, Enum) else r.topic_id
                for r in records
            }
            if seen_ids != canonical_topic_values:
                missing = sorted(canonical_topic_values - seen_ids)
                extra = sorted(seen_ids - canonical_topic_values)
                raise ValueError(
                    f"topic_status topic_ids must match the canonical module topic set exactly "
                    f"(missing={missing}, extra={extra})"
                )
            return self

    _module_response_model_cache[cache_key] = CareerReadinessModelResponseWithTopicEnum
    return CareerReadinessModelResponseWithTopicEnum


def _ensure_active_locale() -> None:
    """Ensure an active locale is set before building locale-aware instructions.

    The career readiness agent must reply in the active language, so the prompt's language
    style is built with the locale section enabled (`with_locale=True`), which requires the
    active locale to be set. Routes set it from the configured `default_locale`; this guard
    backstops any caller (and unit tests) that build instructions without having done so,
    falling back to the configured `default_locale` and finally to English.
    """
    try:
        user_language_ctx_var.get()
        return
    except LookupError:
        pass
    try:
        locale = get_application_config().language_config.default_locale
    except Exception:  # pylint: disable=broad-except
        locale = Locale.EN_US
    user_language_ctx_var.set(locale)


def _build_instruction_mode_instructions(module_title: str, module_content: str, topics: list[str]) -> str:
    """Build system instructions for instruction mode (scaffolded Socratic tutoring)."""
    _ensure_active_locale()
    topics_list = "\n".join(f"- {topic}" for topic in topics)
    language_style = get_language_style(with_locale=True, for_json_output=True)

    response_instructions = dedent("""\
        # Response Format
        You must respond with valid JSON matching this exact schema:
        {
            "reasoning": "Your internal chain-of-thought reasoning (not shown to the user)",
            "topic_status": [
                {"topic_id": "Topic Name 1", "status": "covered", "evidence": "student explained it as..."},
                {"topic_id": "Topic Name 2", "status": "partial", "evidence": "student mentioned X but did not elaborate"},
                {"topic_id": "Topic Name 3", "status": "not_covered", "evidence": ""}
            ],
            "message": "Your message to the student"
        }

        - "reasoning": Explain your pedagogical reasoning — what the student knows, what to cover next, which scaffolding level to use.
        - "topic_status": A list with EXACTLY one entry for each topic in the module topic list above. Each entry has:
            - "topic_id": The canonical topic name, matching exactly a value from the module topic list.
            - "status": One of:
                - "covered" — the student has substantively engaged with this topic and demonstrated understanding across the conversation so far.
                - "partial" — the topic was touched but the student's engagement was thin, off-topic, or just acknowledgment.
                - "not_covered" — the topic has not been addressed yet in this conversation.
            - "evidence": A short quote from the student, or paraphrase of what they said. REQUIRED (non-empty) when status is "covered" or "partial". MUST be an empty string "" when status is "not_covered".
        - "message": Your response to the student. Do not format with markdown. Keep under 200 words.
        - "quick_reply_options": An optional array of quick-reply button options. Each option is an object with a "label" field (the button text). Only include when your message asks a question with limited clear answers.

        # Updating topic_status across turns
        Each turn you will receive the CURRENT topic_status in a "# Conversation State" block attached to the student's message.
        That state is authoritative — the server maintains it. On each turn:
        - You may UPGRADE a topic's status (not_covered → partial → covered) when the student's most recent turn justifies the upgrade.
        - Do NOT downgrade. The server rejects downgrades and retains the prior status.
        - For topics whose status you are not changing this turn, repeat the current status and evidence exactly as the state block shows them.
        - Never fabricate evidence. If you cannot cite what the student said, the topic is not covered.

        The server — not you — decides when the module is complete. Continue asking the student about any topic whose current status is not "covered".

        # Driving the Conversation Forward
        While any topic in the current state is NOT "covered", your `message` field MUST end with
        a question that moves the conversation toward one of those topics. Do NOT write a message
        that only affirms the student's previous answer and stops (e.g., "You're doing great!" with
        no question). Every response either (a) digs deeper into the current topic with a follow-up
        question, or (b) transitions to an uncovered topic with a clear question about it.
        Closing remarks, farewells, or "great work!" messages without a question are forbidden
        while any topic remains uncovered.""")

    template = dedent("""\
        You are a career readiness tutor specialising in "{module_title}".
        Your role is to guide the student through this topic using scaffolded Socratic tutoring.

        # Teaching Method: Scaffolded Socratic Tutoring
        Follow this graduated assistance model for EACH topic:
        1. ASSESS — Begin by asking what the student already knows about the topic. Do not assume prior knowledge.
        2. GUIDE — Ask leading questions that help the student reason through the material themselves.
        3. HINT — If the student struggles (wrong answer, "I don't know", confusion), provide partial information or worked examples.
        4. EXPLAIN — Give direct explanations ONLY as a last resort, after hints have not helped.
        5. FADE — As the student demonstrates understanding, reduce your support and encourage independent reasoning.

        # Comprehension Checks
        Embed checks throughout the conversation:
        - Ask the student to explain concepts back in their own words
        - Ask application questions (e.g., "How would this apply to your situation?")
        - Ask prediction questions (e.g., "What do you think would happen if...?")
        - Periodically return to earlier topics to reinforce retention

        # Handling Minimal Responses
        If the student gives a minimal response like "yes", "yeah", "okay", "sure", "definitely",
        or any other one-word agreement, do NOT treat this as evidence of understanding.
        Instead, ask a follow-up question that requires them to demonstrate comprehension, such as:
        - "Can you explain that back to me in your own words?"
        - "Can you give me an example from your own experience?"
        - "How would you apply this in a real situation?"
        Never ask "Does that make sense?" or similar yes/no questions as comprehension checks.
        Only mark a topic as "covered" when the student has given a substantive response
        that shows genuine understanding — not just agreement. Use "partial" for thin or
        ambiguous engagement.

        # Handling Off-Topic Responses
        Sometimes the student will give a substantive answer that does not actually address the
        topic you asked about — they answer about a different topic instead. In that case:
        - DO NOT upgrade the topic you asked about — the student has not demonstrated
          understanding of it. Leave its status at "not_covered" or "partial" as appropriate.
        - You MAY upgrade the topic the student ACTUALLY addressed (if it is on the module
          topic list) provided their content shows genuine understanding of that topic.
        - Acknowledge what the student said, then politely redirect to the original question.
          Example pattern: "Those are good points about [topic the student actually covered] —
          we can come back to those. First though, let's stay with what I asked:
          [re-ask the original question]."
        Never paper over the mismatch.

        # Module Topics
        {topics_list}

        # Grounding Content
        Use the following content as your curriculum guide — it defines the topics and structure
        you must cover. You may freely draw on general knowledge and best practices to teach
        at depth, but always stay aligned with the topics and structure defined here.

        {module_content}

        # Rules
        - Be encouraging, supportive, and practical.
        - Keep responses concise and focused (under 200 words per message).
        - Do not format or style your response with markdown.
        - Do not discuss, mention, or reveal anything about any quiz.
        - If the user asks something outside the scope of the grounding content,
          politely redirect them to the topics you can help with.
        - Cover topics in a natural conversational order, not necessarily the order listed above.
        - Do not rush through topics. Spend adequate time on each one based on the student's responses.
        - When the student gives a correct or thoughtful answer, briefly affirm and build on it before moving forward — don't immediately pivot to the next question.
        - Approach conversations as a coach, not an examiner. The student is not being tested — they are being helped to articulate what they already know and build on it.
        - Prefer questions that draw out the student's own experience over questions that test whether they recall information.
        - Where relevant, offer a worked example before asking the student to apply the concept to their own situation.

        {language_style}

        {quick_reply_prompt}

        {response_instructions}
        """)

    return template.format(
        module_title=module_title,
        module_content=module_content,
        topics_list=topics_list,
        language_style=language_style,
        quick_reply_prompt=QUICK_REPLY_PROMPT,
        response_instructions=response_instructions,
    )


def _build_support_mode_instructions(module_title: str, module_content: str,
                                      quiz_answer_key: list[dict] | None = None) -> str:
    """Build system instructions for support mode (post-quiz follow-up Q&A).

    The student has already passed the lesson plan; topic coverage is no longer tracked,
    so the support-mode response carries an empty topic_status list.
    """
    _ensure_active_locale()
    language_style = get_language_style(with_locale=True, for_json_output=True)

    response_instructions = dedent("""\
        # Response Format
        You must respond with valid JSON matching this exact schema:
        {
            "reasoning": "Your internal reasoning (not shown to the user)",
            "topic_status": [],
            "message": "Your response to the student"
        }

        - "topic_status": Always set to an empty list in support mode.
        - "message": Your response to the student. Do not format with markdown. Keep under 200 words.
        - "quick_reply_options": An optional array of quick-reply button options. Each option is an object with a "label" field (the button text). Only include when your message asks a question with limited clear answers.""")

    if quiz_answer_key:
        lines = ["# Quiz Answer Key"]
        for entry in quiz_answer_key:
            lines.append(f"Q{entry['index']}. {entry['question']}")
            for opt in entry["options"]:
                marker = " ✓" if opt.startswith(entry["correct_answer"] + ".") else ""
                lines.append(f"  {opt}{marker}")
        quiz_section = "\n".join(lines)
    else:
        quiz_section = ""

    template = dedent("""\
        You are a career readiness support assistant for "{module_title}".
        The student has already completed the lesson and passed the quiz for this module.

        Your role is to answer follow-up questions about the module's topics.

        # Grounding Content
        Use the following content as your primary knowledge base:

        {module_content}

        {quiz_section}
        # Rules
        - Answer questions grounded in the module content above.
        - Be helpful, encouraging, and concise.
        - Do not re-initiate the lesson plan or deliver a quiz.
        - Do not format or style your response with markdown.
        - Keep responses under 200 words.
        - If the user asks something outside the scope of this module,
          politely redirect them.
        - If the student asks about their quiz results or which answers were wrong,
          use the Quiz Answer Key above together with the "Quiz answers: ..." message
          in the conversation history to give an accurate, specific answer.

        {language_style}

        {quick_reply_prompt}

        {response_instructions}
        """)

    return template.format(
        module_title=module_title,
        module_content=module_content,
        quiz_section=quiz_section + "\n" if quiz_section else "",
        language_style=language_style,
        quick_reply_prompt=QUICK_REPLY_PROMPT,
        response_instructions=response_instructions,
    )


class CareerReadinessAgent:
    """
    AI agent that coaches users on a specific career readiness module.

    Uses composition — wraps a GeminiGenerativeLLM + LLMCaller rather than
    inheriting from Agent/SimpleLLMAgent, because this agent operates outside
    the AgentDirector pipeline.
    """

    def __init__(self, module_title: str, module_content: str,
                 mode: ConversationMode = ConversationMode.INSTRUCTION,
                 topics: list[str] | None = None,
                 quiz_answer_key: list[dict] | None = None):
        self._logger = logging.getLogger(CareerReadinessAgent.__name__)

        resolved_topics = topics or []

        if mode == ConversationMode.INSTRUCTION:
            self._base_system_instructions = _build_instruction_mode_instructions(
                module_title, module_content, resolved_topics)
        else:
            self._base_system_instructions = _build_support_mode_instructions(
                module_title, module_content, quiz_answer_key=quiz_answer_key)

        # Build a per-module response model so Vertex AI structured output only
        # permits topic values from the module's topics list. Falls back to the
        # base class when topics is empty.
        self._response_model: Type[CareerReadinessModelResponse] = (
            _build_module_response_model(resolved_topics)
        )

        self._config = LLMConfig(
            generation_config=LOW_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | with_response_schema(
                self._response_model)
        )
        self._llm_caller: LLMCaller[CareerReadinessModelResponse] = LLMCaller[CareerReadinessModelResponse](
            model_response_type=self._response_model)

    @property
    def _system_instructions(self) -> str:
        """Build system instructions with user profile context if available."""
        return append_user_ctx(self._base_system_instructions)

    def _get_llm(self) -> GeminiGenerativeLLM:
        """Create LLM with the base system instructions (the per-turn state block is attached to the user input, not here)."""
        return GeminiGenerativeLLM(system_instructions=self._system_instructions, config=self._config)

    @property
    def system_instructions(self) -> str:
        return self._base_system_instructions

    async def execute(self, user_input: AgentInput, context: ConversationContext,
                      current_topic_status: list[TopicStatusRecord] | None = None) -> CareerReadinessAgentOutput:
        """
        Process user input and return the agent's response with a proposed per-topic coverage update.

        :param user_input: The user's message
        :param context: The conversation context with history
        :param current_topic_status: Authoritative per-topic status from the server. When
            provided, the rendered state block is prepended to the CURRENT user message only
            (recency-attention position) so the LLM reads it right before reasoning about the
            response. Historical turns in `context` are kept clean — past state blocks are not
            persisted or replayed.
        :return: The agent's output carrying the LLM's proposed topic_status
        """
        agent_start_time = time.time()

        msg = user_input.message.strip()
        if msg == "":
            msg = "(silence)"

        if current_topic_status is not None:
            state_block = _render_state_block(current_topic_status)
            msg_for_llm = f"{state_block}\n\n# Student's latest message\n{msg}"
        else:
            msg_for_llm = msg

        model_response: CareerReadinessModelResponse | None
        llm_stats_list: list[LLMStats]

        try:
            model_response, llm_stats_list = await self._llm_caller.call_llm(
                llm=self._get_llm(),
                llm_input=ConversationHistoryFormatter.format_for_agent_generative_prompt(
                    model_response_instructions=get_json_response_instructions(),
                    context=context,
                    user_input=msg_for_llm,
                ),
                logger=self._logger,
            )
        except Exception as e:
            self._logger.exception("An error occurred while calling the LLM: %s", e)
            model_response = None
            llm_stats_list = []

        if model_response is None:
            model_response = CareerReadinessModelResponse(
                reasoning="Failed to get a response",
                message="I am facing some difficulties right now, could you please repeat what you said?",
                topic_status=[],
            )

        agent_end_time = time.time()
        metadata = None
        if model_response.quick_reply_options:
            metadata = {"quick_reply_options": [opt.model_dump() for opt in model_response.quick_reply_options]}
        agent_output = AgentOutputWithReasoning(
            message_for_user=model_response.message.strip('"'),
            finished=False,
            reasoning=model_response.reasoning,
            agent_type=AgentType.CAREER_READINESS_AGENT,
            agent_response_time_in_sec=round(agent_end_time - agent_start_time, 2),
            llm_stats=llm_stats_list,
            metadata=metadata,
        )

        return CareerReadinessAgentOutput(
            agent_output=agent_output,
            proposed_topic_status=[
                _unwrap_topic_status_record(r) for r in model_response.topic_status
            ],
        )

    async def generate_intro_message(self, context: ConversationContext) -> CareerReadinessAgentOutput:
        """
        Generate the introductory message for a new conversation.

        Sends an artificial "(silence)" input to trigger the agent's greeting.

        :param context: An empty conversation context
        :return: The agent's introductory output with topics_covered
        """
        artificial_input = AgentInput(
            message="(silence)",
            is_artificial=True,
        )
        return await self.execute(artificial_input, context)
