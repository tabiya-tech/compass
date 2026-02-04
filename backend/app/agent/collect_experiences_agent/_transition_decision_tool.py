import json
import logging
from enum import Enum
from typing import Optional

from pydantic import BaseModel

from app.agent.agent_types import AgentInput, LLMStats
from app.agent.llm_caller import LLMCaller
from app.agent.penalty import get_penalty
from app.agent.prompt_template import get_language_style
from app.agent.prompt_template import sanitize_input
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.agent.experience.work_type import WorkType
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, ZERO_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG, \
    get_config_variation
from common_libs.llm.schema_builder import with_response_schema
from common_libs.retry import Retry
from ._conversation_llm import _find_incomplete_experiences
from ._types import CollectedData

_TAGS_TO_FILTER = [
    "system instructions",
    "conversation history",
    "collected experience data",
]


class TransitionDecision(Enum):
    CONTINUE = "CONTINUE"
    END_WORKTYPE = "END_WORKTYPE"
    END_CONVERSATION = "END_CONVERSATION"


class TransitionReasoning(BaseModel):
    reasoning: str
    confidence: str


class _LLMOutput(BaseModel):
    transition_decision: TransitionDecision

    class Config:
        extra = "forbid"


class TransitionDecisionTool:

    def __init__(self, logger: logging.Logger):
        self._logger = logger
        self._llm_caller = LLMCaller[_LLMOutput](model_response_type=_LLMOutput)

    @staticmethod
    def _get_llm(collected_data_json: str, temperature_config: Optional[dict] = None) -> GeminiGenerativeLLM:
        if temperature_config is None:
            temperature_config = {}

        return GeminiGenerativeLLM(
            system_instructions=_SYSTEM_INSTRUCTIONS.format(
                collected_data=collected_data_json,
                language_style=get_language_style()
            ),
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "max_output_tokens": 1000
                } | temperature_config | with_response_schema(_LLMOutput)
            ))

    async def execute(self,
                      *,
                      collected_data: list[CollectedData],
                      exploring_type: Optional[WorkType],
                      unexplored_types: list[WorkType],
                      explored_types: list[WorkType],
                      conversation_context: ConversationContext,
                      user_input: AgentInput) -> tuple[TransitionDecision, Optional[TransitionReasoning], list[LLMStats]]:
        
        # we make a rule based decision since we can check by code if there are incomplete experiences
        incomplete_experiences = _find_incomplete_experiences(collected_data)
        if incomplete_experiences:
            self._logger.debug("Incomplete experiences found - returning CONTINUE")
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
        
        prompt = _PROMPT_TEMPLATE.format(
            user_input=user_input.message,
            conversation_history=conversation_history,
            exploring_type=exploring_type_str,
            unexplored_types=unexplored_types_str,
            explored_types=explored_types_str
        )
        
        _llm_stats = []
        
        async def _callback(attempt: int, max_retries: int) -> tuple[TransitionDecision, float, BaseException | None]:
            temperature_config = get_config_variation(start_temperature=0.25, end_temperature=0.5,
                                                      start_top_p=0.8, end_top_p=1,
                                                      attempt=attempt, max_retries=max_retries)
            
            llm = self._get_llm(collected_data_json=json_data, temperature_config=temperature_config)
            self._logger.debug("Calling transition decision LLM with temperature: %s, top_p: %s",
                               temperature_config["temperature"],
                               temperature_config["top_p"])
            
            data, llm_stats, penalty, error = await self._internal_execute(llm=llm, prompt=prompt)
            
            _llm_stats.extend(llm_stats)
            
            return data, penalty, error
        
        result, _result_penalty, _error = await Retry[TransitionDecision].call_with_penalty(
            callback=_callback, logger=self._logger)
        
        reasoning = None
        if result and _error is None:
            reasoning = TransitionReasoning(
                reasoning="LLM-based decision",
                confidence="medium"
            )
        
        return result, reasoning, _llm_stats

    async def _internal_execute(self,
                                *,
                                llm: GeminiGenerativeLLM,
                                prompt: str) -> tuple[TransitionDecision, list[LLMStats], float, BaseException | None]:
        
        no_response_penalty_level = 3
        response_data, llm_stats = await self._llm_caller.call_llm(
            llm=llm,
            llm_input=sanitize_input(prompt, _TAGS_TO_FILTER),
            logger=self._logger
        )
        
        if not response_data:
            _error = ValueError("LLM did not return any output")
            self._logger.error(_error, stack_info=True)
            return TransitionDecision.CONTINUE, llm_stats, get_penalty(no_response_penalty_level), _error

        decision = response_data.transition_decision
        self._logger.debug("Transition decision: %s", decision)
        
        return decision, llm_stats, 0, None


_SYSTEM_INSTRUCTIONS = """
<System Instructions>
#Role
    You are an expert who decides when to transition between phases in a work experience collection conversation.
    
{language_style}
    
#Transition Decision Rules

Use CONTINUE when:
- There are incomplete experiences that need more information
- The user is still providing information about experiences
- You need to ask more questions to complete the current work type exploration

Use END_WORKTYPE when:
- The user has explicitly stated they have no more experiences of the current type
  Examples: "no", "none", "I don't have any", "that's all", "nope", "not really", "no more"
- OR the user has provided experiences for the current type and confirmed they're done
- AND all experiences for the current type are complete (not incomplete)
- AND there are still unexplored work types remaining

Use END_CONVERSATION when ALL of the following are true:
- All work types have been explored (unexplored_types is empty)
- The recap question has been explicitly asked in the conversation history
- The user has confirmed they have nothing to add or change
- There are no incomplete experiences

#Important Constraints
- NEVER use END_WORKTYPE or END_CONVERSATION if there are incomplete experiences - always use CONTINUE
- NEVER use END_CONVERSATION if there are unexplored work types - use END_WORKTYPE instead
- If all types are explored BUT the recap question has NOT been asked yet, you MUST use CONTINUE
    
#Collected Experience Data
    {collected_data}
    
    The values null and "" can be interpreted as follows:
    - null: Information was not provided and not explicitly asked for yet
    - "": User was asked but chose not to provide this information
    
    An experience is incomplete if it has a title but is missing important fields (start_date, end_date, company, or location).
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
- Currently exploring work type: {exploring_type}
- Unexplored work types remaining: {unexplored_types}
- Already explored work types: {explored_types}
</Current State>

#Task
    Based on the conversation history, user's last input, and current state, decide which transition decision to make.
    
    Follow this decision process in order:
    
    1. Check for incomplete experiences
       - If there are incomplete experiences → Return CONTINUE
    
    2. Check if there are unexplored work types remaining
       - If yes, determine if current type is done:
         * Look at the conversation history to understand what question the user is responding to
         * Check if user's last input is a negative response to a work type question
         * If user said "no" (or similar) to having experiences of the current type → Return END_WORKTYPE
         * If user provided experiences and confirmed they're done → Return END_WORKTYPE
         * If user is still providing information → Return CONTINUE
         * Otherwise → Return CONTINUE
    
    3. Check if all work types are explored
       - If yes, check if recap was asked:
         * Look through conversation history for recap question (summarizing all experiences and asking if user wants to add/change)
         * If recap was NOT asked yet → Return CONTINUE
         * If recap WAS asked:
           - Check if user confirmed (no changes wanted) → Return END_CONVERSATION
           - Check if user wants changes → Return CONTINUE
    
    Return your decision as one of: CONTINUE, END_WORKTYPE, or END_CONVERSATION
    
    #Output Format
    Your response must be a valid JSON object with only the following field:
    - transition_decision: One of "CONTINUE", "END_WORKTYPE", or "END_CONVERSATION"
    
    Do not include any reasoning, explanation, or other fields. Only return the transition_decision.
"""
