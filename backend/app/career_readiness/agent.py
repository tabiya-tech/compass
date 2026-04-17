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

from pydantic import BaseModel, ConfigDict, Field, create_model

from app.agent.agent_types import AgentInput, AgentOutput, AgentType, LLMQuickReplyOption, LLMStats, AgentOutputWithReasoning
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template.locale_style import get_language_style
from app.agent.prompt_template.quick_reply_prompt import QUICK_REPLY_PROMPT
from app.agent.prompt_template.format_prompt import append_user_ctx
from app.agent.simple_llm_agent.prompt_response_template import (
    get_json_response_instructions,
)
from app.career_readiness.types import ConversationMode
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, LOW_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG
from common_libs.llm.schema_builder import with_response_schema


class CareerReadinessModelResponse(BaseModel):
    """
    Custom response schema for the career readiness agent with topic tracking.

    Order matters for model prediction quality:
    1. reasoning — sets context
    2. topics_covered — what was addressed this turn
    3. finished — whether all topics have been covered
    4. message — depends on finished
    5. quick_reply_options — optional follow-up buttons
    """

    model_config = ConfigDict(extra="forbid")

    reasoning: str
    """Chain of Thought reasoning behind the response"""

    topics_covered: list[str] = []
    """Topics from the module's topic list that were addressed in this turn"""

    finished: bool
    """Whether the agent judges all topics have been sufficiently covered"""

    message: str
    """Message for the user"""

    quick_reply_options: list[LLMQuickReplyOption] | None = None
    """Optional quick-reply button labels"""


@dataclass
class CareerReadinessAgentOutput:
    """Wraps AgentOutput with topic tracking data from the custom response schema."""

    agent_output: AgentOutput
    """The standard agent output (message, finished, stats, etc.)"""

    topics_covered: list[str] = field(default_factory=list)
    """Topics reported as covered in this turn"""


def _safe_enum_member_name(topic: str, index: int) -> str:
    """Build a valid Python identifier for an Enum member from an arbitrary topic string."""
    cleaned = re.sub(r"[^0-9A-Za-z]+", "_", topic).strip("_").upper()
    if not cleaned or cleaned[0].isdigit():
        cleaned = f"T_{cleaned}" if cleaned else "T"
    return f"{cleaned}_{index}"


_module_response_model_cache: dict[tuple[str, ...], Type[CareerReadinessModelResponse]] = {}


def _build_module_response_model(
    topics: list[str],
) -> Type[CareerReadinessModelResponse]:
    """Build a per-module response model whose topics_covered is enum-constrained to the module's topics (cached by topics tuple)."""
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

    dynamic_model = create_model(
        "CareerReadinessModelResponseWithTopicEnum",
        __base__=CareerReadinessModelResponse,
        topics_covered=(list[topics_enum], Field(default_factory=list)),
    )
    _module_response_model_cache[cache_key] = dynamic_model
    return dynamic_model


def _build_instruction_mode_instructions(module_title: str, module_content: str, topics: list[str]) -> str:
    """Build system instructions for instruction mode (scaffolded Socratic tutoring)."""
    topics_list = "\n".join(f"- {topic}" for topic in topics)
    language_style = get_language_style(with_locale=False, for_json_output=True)

    response_instructions = dedent("""\
        # Response Format
        You must respond with valid JSON matching this exact schema:
        {
            "reasoning": "Your internal chain-of-thought reasoning (not shown to the user)",
            "topics_covered": ["Topic Name 1"],
            "finished": true/false,
            "message": "Your message to the student"
        }

        - "reasoning": Explain your pedagogical reasoning — what the student knows, what to cover next, which scaffolding level to use.
        - "topics_covered": List ONLY topic names from the module topic list where the STUDENT provided content that directly addresses that specific topic THIS turn. The student's content must match the topic — an off-topic answer (substantive content, but about a different topic than the one asked) does NOT count as covering the topic you asked about. If you only briefly mentioned a topic yourself without substantive student engagement, do not include it. Never fabricate coverage — if the topic was not actually discussed by the student, do not list it.
        - "finished": Set to true ONLY when the `Topics still remaining to cover` state block (injected at the end of these instructions) is empty AND the student has demonstrated understanding. That state block is authoritative — do not derive coverage from your own prior messages. When topics still remain, `finished` MUST be false.
        - "message": Your response to the student. Do not format with markdown. Keep under 200 words.
        - "quick_reply_options": An optional array of quick-reply button options. Each option is an object with a "label" field (the button text). Only include when your message asks a question with limited clear answers.""")

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
        Only mark a topic in topics_covered when the student has given a substantive response
        that shows genuine understanding — not just agreement.

        # Handling Off-Topic Responses
        Sometimes the student will give a substantive answer that does not actually address the
        topic you asked about — they answer about a different topic instead. In that case:
        - DO NOT mark the topic you asked about as covered in topics_covered — the student has
          not demonstrated understanding of it.
        - You MAY mark the topic the student ACTUALLY addressed as covered (if it is on the
          module topic list) provided their content shows genuine understanding of that topic.
        - Acknowledge what the student said, then politely redirect to the original question.
          Example pattern: "Those are good points about [topic the student actually covered] —
          we can come back to those. First though, let's stay with what I asked:
          [re-ask the original question]."
        Never paper over the mismatch by claiming both topics are covered when only one was
        actually discussed.

        # Module Topics
        You must cover ALL of the following topics before setting "finished" to true:
        {topics_list}

        # Before Marking finished=true — Mandatory Pre-Check
        Before you set `finished` to true, perform this explicit check on EVERY turn:
        1. Look at the "Topics still remaining to cover" block injected at the end of these instructions.
        2. If that list is non-empty, you MUST set `finished` to false. Do NOT write a farewell or
           "well done" message. Instead, pick one topic from that list and ask the student about it.
        3. Only if that list is literally empty may you consider setting `finished` to true, and
           only then after the student has demonstrated understanding.
        Do not skip this check. Do not rely on your own sense of how much you've covered.
        The injected list is the single source of truth.

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


def _build_support_mode_instructions(module_title: str, module_content: str) -> str:
    """Build system instructions for support mode (post-quiz follow-up Q&A)."""
    language_style = get_language_style(with_locale=False, for_json_output=True)

    response_instructions = dedent("""\
        # Response Format
        You must respond with valid JSON matching this exact schema:
        {
            "reasoning": "Your internal reasoning (not shown to the user)",
            "topics_covered": [],
            "finished": false,
            "message": "Your response to the student"
        }

        - "topics_covered": Always set to an empty list in support mode.
        - "finished": Always set to false in support mode.
        - "message": Your response to the student. Do not format with markdown. Keep under 200 words.
        - "quick_reply_options": An optional array of quick-reply button options. Each option is an object with a "label" field (the button text). Only include when your message asks a question with limited clear answers.""")

    template = dedent("""\
        You are a career readiness support assistant for "{module_title}".
        The student has already completed the lesson and passed the quiz for this module.

        Your role is to answer follow-up questions about the module's topics.

        # Grounding Content
        Use the following content as your primary knowledge base:

        {module_content}

        # Rules
        - Answer questions grounded in the module content above.
        - Be helpful, encouraging, and concise.
        - Do not re-initiate the lesson plan or deliver a quiz.
        - Do not format or style your response with markdown.
        - Keep responses under 200 words.
        - If the user asks something outside the scope of this module,
          politely redirect them.

        {language_style}

        {quick_reply_prompt}

        {response_instructions}
        """)

    return template.format(
        module_title=module_title,
        module_content=module_content,
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
                 topics: list[str] | None = None):
        self._logger = logging.getLogger(CareerReadinessAgent.__name__)

        resolved_topics = topics or []

        if mode == ConversationMode.INSTRUCTION:
            self._base_system_instructions = _build_instruction_mode_instructions(
                module_title, module_content, resolved_topics)
        else:
            self._base_system_instructions = _build_support_mode_instructions(
                module_title, module_content)

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

    def _get_llm(self, remaining_topics: list[str] | None = None) -> GeminiGenerativeLLM:
        """Create LLM with current system instructions (including user profile context and per-turn remaining topics)."""
        instructions = self._system_instructions
        if remaining_topics is not None:
            topic_list = ", ".join(remaining_topics) if remaining_topics else "(all topics have been covered)"
            instructions = f"{instructions}\n\n# Current Conversation State (authoritative — from server)\nTopics still remaining to cover: {topic_list}"
        return GeminiGenerativeLLM(system_instructions=instructions, config=self._config)

    @property
    def system_instructions(self) -> str:
        return self._base_system_instructions

    async def execute(self, user_input: AgentInput, context: ConversationContext,
                      remaining_topics: list[str] | None = None) -> CareerReadinessAgentOutput:
        """
        Process user input and return the agent's response with topic tracking.

        :param user_input: The user's message
        :param context: The conversation context with history
        :param remaining_topics: Authoritative list of module topics not yet covered (from server).
            When provided, injected into system instructions for this call so the LLM
            doesn't have to re-derive global coverage state from conversation history.
        :return: The agent's output with topics_covered
        """
        agent_start_time = time.time()

        msg = user_input.message.strip()
        if msg == "":
            msg = "(silence)"

        model_response: CareerReadinessModelResponse | None
        llm_stats_list: list[LLMStats]

        try:
            model_response, llm_stats_list = await self._llm_caller.call_llm(
                llm=self._get_llm(remaining_topics),
                llm_input=ConversationHistoryFormatter.format_for_agent_generative_prompt(
                    model_response_instructions=get_json_response_instructions(),
                    context=context,
                    user_input=msg,
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
                finished=False,
                topics_covered=[],
            )

        agent_end_time = time.time()
        metadata = None
        if model_response.quick_reply_options:
            metadata = {"quick_reply_options": [opt.model_dump() for opt in model_response.quick_reply_options]}
        agent_output = AgentOutputWithReasoning(
            message_for_user=model_response.message.strip('"'),
            finished=model_response.finished,
            reasoning=model_response.reasoning,
            agent_type=AgentType.CAREER_READINESS_AGENT,
            agent_response_time_in_sec=round(agent_end_time - agent_start_time, 2),
            llm_stats=llm_stats_list,
            metadata=metadata,
        )

        return CareerReadinessAgentOutput(
            agent_output=agent_output,
            topics_covered=[
                t.value if isinstance(t, Enum) else t
                for t in model_response.topics_covered
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
