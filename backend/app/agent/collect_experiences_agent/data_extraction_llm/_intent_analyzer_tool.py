import json
import logging
from textwrap import dedent
from typing import Optional

from pydantic import BaseModel

from app.agent.agent_types import AgentInput, LLMStats
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template import sanitize_input
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, ZERO_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG, \
    get_config_variation
from common_libs.retry import Retry
from . import DataOperation
from .._types import CollectedData
from ...penalty import get_penalty, get_penalty_for_multiple_errors
from app.agent.prompt_template.agent_prompt_template import STD_LANGUAGE_STYLE

_TAGS_TO_FILTER = [
    "system instructions",
    "user's last input",
    "conversation history",
    "previously extracted experience data"
]

# Operations that require an index to be provided.
# Like they can't happen if the index is not provided.
_OPERATIONS_REQUIRING_INDEX = [DataOperation.UPDATE.value.lower(), DataOperation.DELETE.value.lower()]


class Operation(BaseModel):
    index: Optional[int] = None

    associations: Optional[str] = ""

    data_operation_reasoning: Optional[str] = ""
    data_operation: str

    potential_new_experience_title: Optional[str] = ""
    users_statement: str

    def is_empty(self):
        return not self.users_statement or not self.data_operation


class _LLMOutput(BaseModel):
    ignored_experiences: Optional[str] = None
    users_statements: Optional[str | list[str]] = None
    collected_operations: list[Operation]

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"


class IntentAnalyzerTool:

    def __init__(self, logger: logging.Logger):
        self._logger = logger
        self._llm_caller = LLMCaller[_LLMOutput](model_response_type=_LLMOutput)

    @staticmethod
    def _get_llm(previously_extracted_data: str, temperature_config: Optional[dict] = None) -> GeminiGenerativeLLM:
        # if no temperature configu provided, use the default one.
        if temperature_config is None:
            temperature_config = {}

        return GeminiGenerativeLLM(
            system_instructions=_SYSTEM_INSTRUCTIONS.format(previously_extracted_data=previously_extracted_data,
                                                            language_style=STD_LANGUAGE_STYLE),
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "max_output_tokens": 3000
                    # Limit the output to 3000 tokens to avoid the "reasoning recursion issues"
                } | temperature_config
            ))

    async def execute(self,
                      *,
                      collected_experience_data_so_far: list[CollectedData],
                      conversation_context: ConversationContext,
                      users_last_input: AgentInput) -> tuple[list[Operation], list[LLMStats]]:
        conversation_history = format_history_for_prompt(collected_experience_data_so_far, conversation_context)

        prompt = _PROMPT_TEMPLATE.format(
            users_last_input=users_last_input.message,
            conversation_history=conversation_history)

        cleaned_experience_dicts_for_prompt: list[dict] = []
        for collected_item in collected_experience_data_so_far:
            collected_item_dict = collected_item.model_dump(exclude={"defined_at_turn_number"})
            cleaned_experience_dicts_for_prompt.append(collected_item_dict)

        # Construct the available indexes to operate onto (For better validation of LLM results).
        available_indexes = [collected_item.index for collected_item in collected_experience_data_so_far]

        # Convert the cleaned experience dict to a JSON string with an indent of 2 spaces for LLM
        json_data = json.dumps(cleaned_experience_dicts_for_prompt, indent=2)

        _llm_stats = []

        async def _callback(attempt: int, max_retries: int) -> tuple[list[Operation], float, BaseException | None]:
            temperature_config = get_config_variation(start_temperature=0.5, end_temperature=1,
                                                      start_top_p=0.8, end_top_p=1,
                                                      attempt=attempt, max_retries=max_retries)

            llm = self._get_llm(previously_extracted_data=json_data, temperature_config=temperature_config)
            self._logger.debug("Calling LLM with temperature: %s, top_p: %s",
                               temperature_config["temperature"],
                               temperature_config["top_p"])

            # Internally execute the tool.
            data, llm_stats, penality, error = await self._internal_execute(llm=llm,
                                                                            prompt=prompt,
                                                                            available_indexes=available_indexes)

            # Since there might be many retries, combine all the LLms
            _llm_stats.extend(llm_stats)

            return data, penality, error

        result, _result_penalty, _error = await Retry[list[Operation]].call_with_penalty(callback=_callback, logger=self._logger)

        return result, _llm_stats

    async def _internal_execute(self,
                                *,
                                llm: GeminiGenerativeLLM,
                                prompt: str,
                                available_indexes: list[int]
                                ) -> tuple[list[Operation], list[LLMStats], float, BaseException | None]:
        response_data, llm_stats = await self._llm_caller.call_llm(llm=llm,
                                                                   llm_input=sanitize_input(prompt, _TAGS_TO_FILTER),
                                                                   logger=self._logger)
        invalid_index_references_penality_level = 1
        empty_operations_penalty_level = 2
        no_response_penalty_level = 3

        if not response_data:
            _error = ValueError("LLM did not return any output")
            self._logger.error(_error, stack_info=True)
            return [], llm_stats, get_penalty(no_response_penalty_level), _error

        # Debug information
        self._logger.debug(f"Ignored experiences: {response_data.ignored_experiences}")
        self._logger.debug(f"User statements: {response_data.users_statements}")

        _collected_operations = response_data.collected_operations

        for operation in _collected_operations:
            self._logger.debug(dedent(f"""
                Operation: {operation.data_operation}
                Index: {operation.index}
                Associations: {operation.associations}
                User's statement: {operation.users_statement}
            """))

        # if there was provided an invalid index reference on the operation, handle the retries,
        # This is the case where LLM suggested we delete an invalid index, or update an invalid index.

        # Also handle if the llm returned empty operations.
        invalid_index_references = 0
        _empty_operations = 0
        for _operation in _collected_operations:
            if _operation.index not in available_indexes and _operation.data_operation.lower() in _OPERATIONS_REQUIRING_INDEX:
                invalid_index_references += 1

            if _operation.is_empty():
                _empty_operations += 1

        if _empty_operations > 0:
            self._logger.warning(f"LLM returned {_empty_operations} empty operations")
            return (_collected_operations, llm_stats,
                    get_penalty_for_multiple_errors(empty_operations_penalty_level,
                                                    _empty_operations,
                                                    len(_collected_operations)), None)

        if invalid_index_references > 0:
            self._logger.warning(f"LLM returned {invalid_index_references} invalid index references")
            return (_collected_operations, llm_stats,
                    get_penalty_for_multiple_errors(invalid_index_references_penality_level,
                                                    invalid_index_references,
                                                    len(_collected_operations)), None)

        return _collected_operations, llm_stats, 0, None


def format_history_for_prompt(collected_experience_data_so_far: list[CollectedData],
                              context: ConversationContext) -> str | None:
    _output: str = ""
    if context.summary != "":
        _output += f"{ConversationHistoryFormatter.USER}: '{ConversationHistoryFormatter.SUMMARY_TITLE}\n{context.summary}'"

    for turn in context.history.turns:
        # If experience data was collected at this turn,
        # add a reference to help the model associate the data with this specific turn.
        # This helps the model connect the dots between the user's last input --> the conversation history --> and the relevant experience data,
        # allowing it to follow associations inferred in previous turns.
        _experience_ref = ""
        for _data in collected_experience_data_so_far:
            if _data.defined_at_turn_number == turn.index:
                _experience_ref = f" (see <Previously Extracted Experience Data> index={_data.index})"
                break

        _output += (
            f"{ConversationHistoryFormatter.USER}: '{sanitize_input(turn.input.message, _TAGS_TO_FILTER)}{_experience_ref}'\n"
            f"{ConversationHistoryFormatter.MODEL}: '{sanitize_input(turn.output.message_for_user, _TAGS_TO_FILTER)}'\n")
    return _output


_SYSTEM_INSTRUCTIONS = """
<System Instructions>
#Role
    You are an expert who extracts information regarding the work experiences of the user from the user's last input.
    
{language_style}
        
#New Experience handling
    Set the 'data_operation' to 'ADD' to add new experiences
    - You can capture multiple new experiences at the same time.   
    - You can only capture new experiences that are mentioned in the '<User's Last Input>' 
      and are not included in the '<Previously Extracted Experience Data>'.
    - If '<User's Last Input>' mentions multiple new experiences, you will add ALL of them 
      to the 'collected_operations' field as separate entries with data_operation set to 'ADD'. 
    - Experiences that are in the '<Conversation History>' but not in the '<User's Last Input>' 
      must be ignored and not added to the 'collected_operations' field.
    - You can only capture experiences that the user has and not experiences they don't have, or they plan to have, 
      or they would like to have. Review the '<User's Last Input>' and use the '<Conversation History>' to understand 
      if the '<User's Last Input>' refers to an experience that the user has or not, or if it refers to something else. 
      If not then ignore it and do not add it to the 'collected_operations' field. 
    - If user refers to an experience in the '<User's Last Input>', review the '<Conversation History>' to find information
      about that experience before adding it to the 'collected_operations' field. 
    - Ignore information from the '<Conversation History>' if it does not directly relate to the '<User's Last Input>'.
    - If it is ADD, the index should be `null`
#Update Experience handling 
    Set the 'data_operation' to 'UPDATE' to update experiences that are present in the '<Previously Extracted Experience Data>'.
    - You can update multiple experiences at the same time. 
    - If the data provided to you in the '<User's Last Input>' relates to experiences that are present in the
      '<Previously Extracted Experience Data>', you will update the existing experiences and copy them to the 
      'collected_operations' field of your output.    
    - You can only update experiences that are present in the '<Previously Extracted Experience Data>'
    - If '<User's Last Input>' answers a clarification about existing experience (refer to '<Conversation History>'), update experience with new updates instead of creating a new one.
    - If it is UPDATE, link the index from the '<Previously Extracted Experience Data>' to the 'index' field of your output.
#Delete Experience handling 
    Set the 'data_operation' to 'DELETE' to delete experiences that are present in the '<Previously Extracted Experience Data>'.
    - You can delete multiple experiences at the same time.
    - To delete an experience the user must state in the '<User's Last Input>' that they want to remove or delete the experience that is present in '<Previously Extracted Experience Data>'. 
        In that case you will copy the experience to the 'collected_operations' field of your output with the 'data_operation' field set to 'DELETE'.    
    - You can only delete experiences that are present in the '<Previously Extracted Experience Data>'.
    - If it is DELETE, link the index from the '<Previously Extracted Experience Data>' to the 'index' field of your output.
    - If the experience the user wants to delete is not present in the '<Previously Extracted Experience Data>', ignore it and do not add it to the 'collected_operations' field.
#Missing/Incomplete Experience data handling    
    - Record the available details in the 'collected_operations' field, even if some of the fields are 
      not fully completed for an experience.     
#Irrelevant data handling 
    - If the data provided to you in the '<User's Last Input>' does not relate to an experience that the user has
      you will not add it to the 'collected_operations' field of your output.

#Experience User statement handling
    - This is the unique user statement derived from  '<User's Last Input>' about the experience.
    - If the user described multiple (N) experiences either in one or multiple sentences, it means N elements in the 'collected_operations' 
        for each experience pick a statement or phrase related to the experience and that should be the experience user statement.
    - If the user did not describe any experience, do not add any row in the 'collected_operations' field.

#JSON Output instructions
    - ignored_experiences: A detailed, step-by-step explanation in prose of the experiences referenced by the user that will not be added to the 
       'collected_operations' and why. These are experiences that will be ignored.
       Follow the instructions in '#New Experience handling', '#Update Experience handling' and '#Delete Experience handling' to determine which experience you will be ignoring.
       An empty string "" if no experiences will be ignored. 
       e.g. Experience was not referred in the '<User's Last Input>'.
       Formatted as a json string.      
    - users_statements: A detailed, decomposed list of sentences describing each distinct experiences mentioned in the user’s last statement.
        If the user mentioned multiple experiences (m), return m user statements — each as a unique entry describing one experience.
        The output should be a JSON-formatted string. eg: 'I worked at A and B since C' should be decomposed to ['I worked at A since C', 'I worked at B since C']
        A statement can contain more than one sentence if the user was describing the same one experience. eg: ['I worked at C. I started in 2020'] 
        
    - collected_operations: an array of dictionaries with the information about the experiences referenced by the user.
        For each phrase or statement saying an activity (experience) in User's last input it is an item in the collected_operations;
        Empty array `[]` if no experiences are referenced or they should be ignored. Otherwise, each dictionary in the array should contain the following fields:
            {{
                - associations: Generate a linear chain of associations in the form of ...-> ...->... that start from the User's Last Input 
                    and follow the relevant entries they refer to in the Conversation History until they terminate to the Previously Extracted Experience Data, if relevant. 
                    ///Skip unrelated or tangential turns to preserve a coherent causal chain of associations.
                    ///You are filtering for semantic lineage rather than strictly temporal proximity.
                    Once you reach the Previously Extracted Experience Data, you will not follow the associations anymore.
                    e.g. "user('...') -> model('...') -> ... -> user('...') -> model('...') -> Previously Extracted Experience Data(...)"
                    Each step in the sequence should be a summarized version of the actual user or model turn.
                - potential_new_experience_title: The potential experience title from the details described by the user in the 'User's Last Input'
                    This is like the title to be put on a CV when describing the experience title. 
                    If the experience already exists in <Previously Extracted Experience Data>, and the user is not updating it, return the existing title.
                    If you can't figure it out return an empty string.
                - data_operation_reasoning: A detailed, step-by-step explanation in prose of what data operation should be performed.
                    Consider the conversation context carefully - if the user is answering a question about existing work, 
                    this should be an UPDATE. If they are describing completely new work, this should be an ADD. 
                - data_operation: The operation that should be performed to the experience data, choose one of the following values:
                    'ADD', 'UPDATE', 'DELETE', 'NOOP'. The value 'NOOP' means that no operation should be performed.
                - index: The unique identifier of the experience. If the experience already exists in <Previously Extracted Experience Data>, return the existing index, otherwise `null` 
                - users_statement: The user's statement about the experience in the '<User's Last Input>'.
                    Refer to the #Experience User statement handling section for more details.
                    Try to fill in the references in the statement where possible based on the user's last input and conversation history especially where the user used
                    demonstrative pronouns.
            }}                
</System Instructions>
<Previously Extracted Experience Data> 
    {previously_extracted_data} 
</Previously Extracted Experience Data>   
"""

_PROMPT_TEMPLATE = """
<Conversation History>
{conversation_history}
</Conversation History>

<User's Last Input>
user: {users_last_input}
</User's Last Input>
"""
