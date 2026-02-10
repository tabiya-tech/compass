import json
import logging
from enum import Enum
from typing import Optional

from pydantic import BaseModel

from app.agent.agent_types import AgentInput, LLMStats
from app.agent.config import AgentsConfig
from app.agent.llm_caller import LLMCaller
from app.agent.penalty import get_penalty
from app.agent.prompt_template import sanitize_input
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.agent.experience.work_type import WorkType
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, ZERO_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG, \
    get_config_variation
from common_libs.llm.schema_builder import with_response_schema
from common_libs.retry import Retry
from ._conversation_llm import _find_incomplete_experiences, _get_experience_type, _ask_experience_type_question
from ._types import CollectedData

_TAGS_TO_FILTER = [
    "system instructions",
    "conversation history",
    "collected experience data",
]

MAX_REASONING_LENGTH = 100


def _generate_work_type_mapping() -> str:
    """
    Dynamically generate work type mapping from the WorkType enum.
    This ensures we don't hardcode work types and can easily add/remove them.
    """
    mapping_lines = []
    for work_type in WorkType:
        description = _get_experience_type(work_type)
        example_question = _ask_experience_type_question(work_type)
        mapping_lines.append(
            f"          - {work_type.name}: Questions about \"{description}\" "
            f"(e.g., \"{example_question}\")"
        )
    return "\n".join(mapping_lines)


class TransitionDecision(Enum):
    CONTINUE = "CONTINUE"
    END_WORKTYPE = "END_WORKTYPE"
    END_CONVERSATION = "END_CONVERSATION"


class TransitionReasoning(BaseModel):
    reasoning: str
    confidence: str


class _TransitionDecisionOutput(BaseModel):
    continue_current_type: bool
    done_with_collection: bool
    reasoning: str

    class Config:
        extra = "forbid"


class TransitionDecisionTool:

    def __init__(self, logger: logging.Logger):
        self._logger = logger
        self._llm_caller = LLMCaller[_TransitionDecisionOutput](model_response_type=_TransitionDecisionOutput)

    @staticmethod
    def _get_llm(collected_data_json: str, temperature_config: Optional[dict] = None) -> GeminiGenerativeLLM:
        if temperature_config is None:
            temperature_config = {}

        return GeminiGenerativeLLM(
            system_instructions=_SYSTEM_INSTRUCTIONS.format(
                collected_data=collected_data_json,
            ),
            config=LLMConfig(
                language_model_name=AgentsConfig.deep_reasoning_model,
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG
                | JSON_GENERATION_CONFIG
                | temperature_config
                | with_response_schema(_TransitionDecisionOutput)
            ))

    async def execute(self,
                      *,
                      collected_data: list[CollectedData],
                      exploring_type: Optional[WorkType],
                      unexplored_types: list[WorkType],
                      explored_types: list[WorkType],
                      conversation_context: ConversationContext,
                      user_input: AgentInput) -> tuple[TransitionDecision, Optional[TransitionReasoning], list[LLMStats]]:
        
        # Rule-based check 1: Incomplete experiences
        incomplete_experiences = _find_incomplete_experiences(collected_data)
        if incomplete_experiences:
            self._logger.info(
                "Incomplete experiences found - returning CONTINUE. "
                "Incomplete experiences: %s",
                [(idx, exp.experience_title, missing) for idx, exp, missing in incomplete_experiences]
            )
            return TransitionDecision.CONTINUE, None, []
        
        
        cleaned_experience_dicts = []
        for collected_item in collected_data:
            collected_item_dict = collected_item.model_dump(exclude={"defined_at_turn_number"})
            cleaned_experience_dicts.append(collected_item_dict)
        
        json_data = json.dumps(cleaned_experience_dicts, indent=2)
        
        conversation_history = ConversationHistoryFormatter.format_history_for_agent_generative_prompt(
            conversation_context
        )
        
        exploring_type_str = exploring_type.name if exploring_type else "None"
        unexplored_types_str = ", ".join([wt.name for wt in unexplored_types])
        explored_types_str = ", ".join([wt.name for wt in explored_types])
        
        exploring_type_description = _get_experience_type(exploring_type) if exploring_type else "None"
        work_type_mapping = _generate_work_type_mapping()
        
        prompt = _PROMPT_TEMPLATE.format(
            user_input=user_input.message,
            conversation_history=conversation_history,
            exploring_type=exploring_type_str,
            exploring_type_enum=exploring_type.name if exploring_type else "None",
            exploring_type_description=exploring_type_description,
            work_type_mapping=work_type_mapping,
            unexplored_types=unexplored_types_str,
            explored_types=explored_types_str
        )
        
        _llm_stats = []
        _reasoning = None
        
        async def _callback(attempt: int, max_retries: int) -> tuple[TransitionDecision, float, BaseException | None]:
            temperature_config = get_config_variation(start_temperature=0.0, end_temperature=0.1,
                                                      start_top_p=0.95, end_top_p=1.0,
                                                      attempt=attempt, max_retries=max_retries)
            
            llm = self._get_llm(collected_data_json=json_data, temperature_config=temperature_config)
            self._logger.debug("Calling transition decision LLM with temperature: %s, top_p: %s",
                               temperature_config["temperature"],
                               temperature_config["top_p"])
            
            data, reasoning, llm_stats, penalty, error = await self._internal_execute(
                llm=llm, 
                prompt=prompt,
                unexplored_types=unexplored_types
            )
            
            nonlocal _reasoning
            _reasoning = reasoning
            _llm_stats.extend(llm_stats)
            
            return data, penalty, error
        
        result, _result_penalty, _error = await Retry[TransitionDecision].call_with_penalty(
            callback=_callback, logger=self._logger)
        
        reasoning = _reasoning
        if reasoning is None:
            reasoning = TransitionReasoning(
                reasoning="No reasoning provided - error occurred during LLM call",
                confidence="low"
            )
        
        # Additional validation: ensure END_CONVERSATION only when all types explored
        if result == TransitionDecision.END_CONVERSATION and unexplored_types:
            self._logger.warning(
                "Invalid decision: END_CONVERSATION returned but unexplored_types is not empty: %s. "
                "Forcing END_WORKTYPE instead. Original reasoning: %s",
                [wt.name for wt in unexplored_types],
                reasoning.reasoning if reasoning else "None"
            )
            result = TransitionDecision.END_WORKTYPE
            reasoning = TransitionReasoning(
                reasoning=f"Invalid END_CONVERSATION decision - unexplored_types not empty: {[wt.name for wt in unexplored_types]}. Original reasoning: {reasoning.reasoning if reasoning else 'None'}",
                confidence="high"
            )
        
        self._logger.info(
            "Transition decision: %s. "
            "Exploring type: %s, Unexplored types: %s, Explored types: %s, "
            "Collected experiences: %d",
            result,
            exploring_type.name if exploring_type else "None",
            [wt.name for wt in unexplored_types],
            [wt.name for wt in explored_types],
            len(collected_data),
        )
        self._logger.info("Transition decision reasoning: %s", reasoning.reasoning if reasoning else "None")

        return result, reasoning, _llm_stats

    async def _internal_execute(self,
                                *,
                                llm: GeminiGenerativeLLM,
                                prompt: str,
                                unexplored_types: list[WorkType]) -> tuple[TransitionDecision, TransitionReasoning, list[LLMStats], float, BaseException | None]:
        
        no_response_penalty_level = 3
        response_data, llm_stats = await self._llm_caller.call_llm(
            llm=llm,
            llm_input=sanitize_input(prompt, _TAGS_TO_FILTER),
            logger=self._logger
        )
        
        if not response_data:
            _error = ValueError("LLM did not return any output")
            self._logger.error(_error, stack_info=True)
            reasoning = TransitionReasoning(
                reasoning="LLM returned no output",
                confidence="low"
            )
            return TransitionDecision.CONTINUE, reasoning, llm_stats, get_penalty(no_response_penalty_level), _error

        continue_current_type = response_data.continue_current_type
        done_with_collection = response_data.done_with_collection
        reasoning_text = response_data.reasoning if hasattr(response_data, 'reasoning') else "No reasoning provided"
        
        # Truncate reasoning if too long to prevent bloat
        if len(reasoning_text) > MAX_REASONING_LENGTH:
            reasoning_text = reasoning_text[:MAX_REASONING_LENGTH].rsplit('.', 1)[0] + "."
            self._logger.warning("Reasoning truncated from %d to %d characters", len(response_data.reasoning), len(reasoning_text))
        
        # Ensure reasoning doesn't exceed limit (safety check)
        if len(reasoning_text) > MAX_REASONING_LENGTH:
            reasoning_text = reasoning_text[:MAX_REASONING_LENGTH]
        
        # Validate done_with_collection against state (deterministic check)
        if done_with_collection and unexplored_types:
            self._logger.warning(
                "Invalid done_with_collection=true when unexplored_types is not empty: %s. "
                "Forcing done_with_collection=false. Original reasoning: %s",
                [wt.name for wt in unexplored_types],
                reasoning_text
            )
            done_with_collection = False
        
        # Map binary outputs to transition decision
        if continue_current_type:
            decision = TransitionDecision.CONTINUE
        elif done_with_collection:
            decision = TransitionDecision.END_CONVERSATION
        else:
            decision = TransitionDecision.END_WORKTYPE
        
        self._logger.debug("Transition decision: %s (continue_current_type=%s, done_with_collection=%s). Reasoning: %s", 
                          decision, continue_current_type, done_with_collection, reasoning_text)
        
        reasoning = TransitionReasoning(
            reasoning=reasoning_text,
            confidence="medium"
        )
        
        return decision, reasoning, llm_stats, 0, None


_SYSTEM_INSTRUCTIONS = """
<System Instructions>
#Role
You decide when to transition between phases in a work experience collection conversation.

#Decision Logic
Answer two boolean questions:

1. continue_current_type: Should we continue asking about the current work type?
   - true: User providing info, agent asking questions, or haven't asked about this type yet
   - false: User indicated no more experiences for this type

2. done_with_collection: Are we completely done collecting all work experiences?
   - Only evaluate if continue_current_type is false
   - true: All work types explored AND user confirmed satisfied with recap
   - false: More work types remain or user wants changes

#Constraints
- Use semantic understanding, not keyword matching
- If incomplete experiences exist, continue_current_type must be true
- If unexplored_types is not empty, done_with_collection must be false

#Collected Experience Data
{collected_data}

An experience is incomplete if it has a title but missing start_date, end_date, company, or location.
Empty strings ("") mean user declined to provide - these are complete.
Only None values indicate missing information.
</System Instructions>
"""

_PROMPT_TEMPLATE = """
<Conversation History>
{conversation_history}
</Conversation History>

<User's Last Input>
{user_input}
</User's Last Input>

<Current State>
- Exploring work type: {exploring_type_enum} ({exploring_type_description})
- Unexplored types: {unexplored_types}
- Explored types: {explored_types}
</Current State>

#Task
Answer both questions:

1. continue_current_type: Keep asking about {exploring_type_enum}?
   Work type patterns: {work_type_mapping}

2. done_with_collection: Completely done? (only if continue_current_type is false)

Reasoning: Brief 1-2 sentence explanation.

Limit the output to 50 words (a single short JSON object).

#Output
Return complete valid JSON with all three fields. Start with {{:
{{"continue_current_type": true, "done_with_collection": false, "reasoning": "Brief explanation here"}}

You must complete the entire JSON object including the closing brace }}.
"""
