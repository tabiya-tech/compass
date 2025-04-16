import json
import logging

from datetime import datetime
from enum import Enum
from textwrap import dedent
from typing import Optional

from pydantic import BaseModel

from app.agent.agent_types import AgentInput, LLMStats
from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.experience.work_type import WORK_TYPE_DEFINITIONS_FOR_PROMPT
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template import sanitize_input
from app.agent.prompt_template.agent_prompt_template import STD_LANGUAGE_STYLE, STD_AGENT_CHARACTER
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, ZERO_TEMPERATURE_GENERATION_CONFIG

# The tags are part of the prompt template and should not be used as input data
_TAGS_TO_FILTER = ["system instructions", "previously extracted experience data", "user's last input", "conversation history"]


class _DataOperation(Enum):
    """
    The operation to be performed on the experience data.
    """
    ADD = "ADD"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    NONE = "NONE"

    @staticmethod
    def from_string_key(key: str | None) -> Optional['_DataOperation']:
        if key in _DataOperation.__members__:
            return _DataOperation[key]
        return None


class _CollectedDataWithReasoning(CollectedData):
    data_extraction_references: Optional[str | dict] = ""
    dates_mentioned: Optional[str] = ""
    dates_calculations: Optional[str] = ""
    work_type_classification_reasoning: Optional[str] = ""
    data_operation: Optional[str] = ""

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"


class _CollectedExperience(BaseModel):
    experience_references: Optional[str] = ""
    experience_index: int = -1
    ignored_experiences: Optional[str] = None
    collected_experience_data: Optional[_CollectedDataWithReasoning] = None

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"


class _DataExtractionLLM:
    def __init__(self, logger: logging.Logger):
        self._llm_caller = LLMCaller[_CollectedExperience](model_response_type=_CollectedExperience)
        self.logger = logger

    async def execute(self, *, user_input: AgentInput, context: ConversationContext,
                      collected_experience_data_so_far: list[CollectedData]) -> tuple[int, list[LLMStats]]:
        """
        Given the last user input, a conversation history and the experience data collected so far.
        Extracts the experience data from the user input and conversation history and
        updates the collected experience data.

        :param user_input:  The last user input
        :param context: The conversation context with the conversation history
        :param collected_experience_data_so_far: The collected experience data so far
        :return: The extracted experience data and the LLM stats
        """
        # collected_experience_data_so_far.sort(key=lambda x: x.index)  # sort the collected experience data by index
        # remove the property defined_at_turn_number
        _data = []
        for _d in collected_experience_data_so_far:
            d = _d.model_dump()
            del d["defined_at_turn_number"]
            _data.append(d)

        json_data = json.dumps(_data, indent=2)
        llm = GeminiGenerativeLLM(
            system_instructions=_DataExtractionLLM._create_extraction_system_instructions(json_data),
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "max_output_tokens": 3000  # Limit the output to 3000 tokens to avoid the "reasoning recursion issues"
                }
            ))

        response_data, llm_stats = await self._llm_caller.call_llm(llm=llm,
                                                                   llm_input=_DataExtractionLLM._prompt_template(
                                                                       collected_experience_data_so_far=collected_experience_data_so_far,
                                                                       context=context,
                                                                       user_message=user_input.message),
                                                                   logger=self.logger)

        if not response_data:
            # This may happen if the LLM fails to return a JSON object
            # Instead of completely failing, we log a warning and return None
            self.logger.warning("The LLM did not return any output and the extracted experience data will be None")
            return -1, llm_stats

        if not response_data.collected_experience_data:
            self.logger.debug("No experience data was extracted.")
            return -1, llm_stats

        _data = response_data.collected_experience_data
        _data.data_operation = _DataOperation.from_string_key(_data.data_operation)
        experience_index: int
        experience_index = -1
        if _data.data_operation is None:
            self.logger.error("Invalid data operation:%s", _data.data_operation)
            return experience_index, llm_stats

        if _data.data_operation == _DataOperation.ADD:
            # add the new experience to the collected experience data
            self.logger.info("Adding new experience with index:%s", len(collected_experience_data_so_far))
            # The latest user input will be added after the last turn in the conversation history
            next_turn_index = context.history.turns[-1].index + 1
            new_item = CollectedData(
                index=len(collected_experience_data_so_far),
                defined_at_turn_number=next_turn_index,
                experience_title=_data.experience_title,
                paid_work=_data.paid_work,
                work_type=_data.work_type,
                start_date=_data.start_date,
                end_date=_data.end_date,
                company=_data.company,
                location=_data.location
            )
            if CollectedData.all_fields_empty(new_item):
                self.logger.error("Experience data is empty: %s", new_item)
                experience_index = -1
            else:
                # Sometimes the LLM may add duplicates, so we remove them
                found_duplicate_index = find_duplicate(new_item, collected_experience_data_so_far)

                if found_duplicate_index >= 0:
                    self.logger.warning("Duplicate experience data detected and will not be added: %s", new_item)
                    experience_index = found_duplicate_index
                else:
                    collected_experience_data_so_far.append(new_item)
                    experience_index = len(collected_experience_data_so_far) - 1

        if _data.data_operation == _DataOperation.UPDATE:
            # update the experience in the collected experience data
            if 0 <= _data.index < len(collected_experience_data_so_far):
                to_update = collected_experience_data_so_far[_data.index]
                self.logger.info("Updating experience with index:%s", _data.index)
                # once a value is set, it should not be set to None again
                if _data.experience_title is not None:
                    to_update.experience_title = _data.experience_title
                if _data.paid_work is not None:
                    to_update.paid_work = _data.paid_work
                if _data.paid_work is not None:
                    to_update.work_type = _data.work_type
                if _data.paid_work is not None:
                    to_update.start_date = _data.start_date
                if _data.paid_work is not None:
                    to_update.end_date = _data.end_date
                if _data.paid_work is not None:
                    to_update.company = _data.company
                if _data.paid_work is not None:
                    to_update.location = _data.location
                experience_index = _data.index
            else:
                self.logger.error("Invalid index:%s for updating experience", _data.index)

        if _data.data_operation == _DataOperation.DELETE:
            # delete the experience from the collected experience data
            if 0 <= _data.index < len(collected_experience_data_so_far):
                self.logger.info("Deleting experience with index:%s", _data.index)
                del collected_experience_data_so_far[_data.index]
            else:
                self.logger.error("Invalid index:%s for deleting experience", _data.index)

        for i, _data in enumerate(collected_experience_data_so_far):
            # Sometimes the LLM may add an empty experience, so we skip it
            if CollectedData.all_fields_empty(_data):
                self.logger.error("Experience data is empty: %s", _data)
                # todo: del collected_experience_data_so_far[i]
            # Sometimes the LLM may add a duplicate experience, so we remove it
            elif find_duplicate(_data, collected_experience_data_so_far[:i] + collected_experience_data_so_far[i + 1:]) >= 0:
                # todo: del collected_experience_data_so_far[i]
                self.logger.error("Duplicate experience data detected: %s", _data)

        return experience_index, llm_stats

    @staticmethod
    def _prompt_template(collected_experience_data_so_far: list[CollectedData], context: ConversationContext, user_message: str) -> str:

        return dedent("""\
            <Conversation History>
            {conversation_history}
            </Conversation History>
            
            <User's Last Input>
            user: {user_message}
            </User's Last Input>
            """).format(conversation_history=format_history_for_prompt(collected_experience_data_so_far, context),
                        user_message=sanitize_input(user_message.strip(), _TAGS_TO_FILTER))

    @staticmethod
    def _create_extraction_system_instructions(previously_extracted_data: str = "") -> str:
        system_instructions_template = dedent("""\
                <System Instructions>
                #Role
                    You are an expert who extracts information regarding the work experience of the user from the user's last input.
                
                #New Experience handling
                    Set the 'data_operation' to 'ADD' to add a new experience
                    - The new experience should get the next index in the '<Previously Extracted Experience Data>' list. 
                    - You can only capture one new experience at a time.   
                    - You can only capture a new experience only if it is mentioned in the '<User's Last Input>' 
                      and it is not included in the '<Previously Extracted Experience Data>'.
                    - If '<User's Last Input>' mentions more than one new experiences, you will only add the first experience 
                      to the 'collected_experience_data' field and ignore the rest of the experiences mentioned in the '<User's Last Input>'. 
                    - Experiences that are in the '<Conversation History>' but not in the '<User's Last Input>' 
                      must be ignored and not added to the 'collected_experience_data' field.  
                    - You can only capture experiences that the user has and not experiences they don't have, or they plan to have, 
                    or they would like to have. Review the '<User's Last Input>' and use the '<Conversation History>' to understand 
                      if the '<User's Last Input>' refers to an experience that the user has or not, or if it refers to something else. 
                      If not then ignore it and do not add it to the 'collected_experience_data' field. 
                    - If user refers to an experience in the '<User's Last Input>', review the '<Conversation History>' to find information
                      about that experience before adding it to the 'collected_experience_data' field. 
                    - Ignore information from the '<Conversation History>' if it does not directly relate to the '<User's Last Input>'.
                #Update Experience handling 
                    Set the 'data_operation' to 'UPDATE' to update an experience that is present in the '<Previously Extracted Experience Data>'.
                    - Your can only update one experience at a time. 
                    - If the data provided to you in the '<User's Last Input>' relates to an experience that is present in the
                      '<Previously Extracted Experience Data>', you will update the existing experience and copy it to the 
                      'collected_experience_data' field of your output.    
                    - You can only update an experience that is present in the '<Previously Extracted Experience Data>'  
                #Delete Experience handling 
                    Set the 'data_operation' to 'DELETE' to delete an experience that is present in the '<Previously Extracted Experience Data>'.
                    - Your can only delete one experience at a time.
                    - To delete an experience the user must state in the '<User's Last Input>' that they what do not have, or want to remove or delete 
                    the experience that is present in '<Previously Extracted Experience Data>'. In that case you will copy the experience to the 'collected_experience_data' field of your output 
                      with the 'data_operation' field set to 'DELETE'.    
                    - You can only delete an experience that is present in the '<Previously Extracted Experience Data>'.
                #Missing/Incomplete Experience data handling    
                    - Record the available details in the 'collected_experience_data' field, even if some of the fields are 
                      not fully completed for an experience.     
                #Irrelevant data handling 
                    - If the data provided to you in the '<User's Last Input>' does not relate to an experience that the user has
                      you will not add it to the 'collected_experience_data' field of your output.
                #Extract data instructions
                    Make sure you are extracting information about experiences that should be added to the 'collected_experience_data' 
                    and not information that should be ignored.
                    For each experience, you will collect information for the following fields:
                    - experience_title 
                    - work_type
                    - start_date
                    - end_date
                    - company
                    - location
                    You will collect and place them to the output as instructed below:
                    ##'experience_title' instructions
                        Extract the title of the experience from the '<User's Last Input>', but do not alter it.
                        If the title is not provided, suggest a title based on the context.
                        For unpaid work, use the kind of work done (e.g. "Helping Neighbors", "Volunteering" etc).
                        Make sure that the user is actually referring to an experience they have have. 
                        String value containing the title of the experience.
                        `null` It was not provided by the user and the user was not explicitly asked for this information yet.
                        Empty string if the user was asked and explicitly chose to not provide this information.    
                    ##'paid_work' instructions
                        Determine if the experience was for money or not.
                        Boolean value indicating whether the work was paid or not.
                        `null` It was not provided by the user and the user was not explicitly asked for this information yet.
                        Empty string if the user was asked and explicitly chose to not provide this information. 
                    ##'work_type' instructions
                        Classify the type of work the experience refers to.
                        Use the '<User's Last Input>' related it to the'<Conversation History>' to determine the type of work.
                        Choose one of the following values and apply the criteria:
                            {work_type_definitions}   
                    ##Timeline instructions
                        The user may provide the beginning and end of an experience at any order, 
                        in a single input or in separate inputs, as a period or as a single date in relative or absolute terms.
                        ###'dates_mentioned' instructions
                            Contains the conversational date input e.g., "March 2021" or "last month", "since n months", 
                            "the last M years" etc or whatever I provide that can be interpreted as start or end date of the experience. 
                            Any dates I mention, either referring to the start or end date of the experience or a period.            
                        ###'start_date' instructions
                            If I provide a conversational date input for the start of an experience, you should accurately 
                            calculate these based on my current date.
                            String value containing the start date.
                            `null` It was not provided by the user and the user was not explicitly asked for this information yet.
                            Empty string if the user was asked and explicitly chose to not provide this information. 
                            For reference, my current date is {current_date}        
                        ###'end_date' instructions
                            If I provide a conversational date input for the end of an experience, you should accurately 
                            calculate these based on my current date. In case it is an ongoing experience, use the word "Present". 
                            String value containing the end date.
                            `null` It was not provided by the user and the user was not explicitly asked for this information yet.
                            Empty string if the user was asked and explicitly chose to not provide this information. 
                            For reference, my current date is {current_date}    
                    ##'company' instructions
                        What the company does or name of the company depending on the context.
                        For unpaid work, use the receiver of the work (e.g. "Family", "Community", "Self" etc).
                        String value containing the type or name of the company.
                        `null` It was not provided by the user and the user was not explicitly asked for this information yet.
                        Empty string if the user was asked and explicitly chose to not provide this information. 
                        Do not insist on the user providing this information if they do not provide it. 
                    ##'location' instructions 
                        The location (e.g City, Region, District) where the job was performed or the company is located any
                        one of them. In case of remote work or work from home use (Remote, Home Office etc) as the location.
                        String value containing the location.
                        `null` It was not provided by the user and the user was not explicitly asked for this information yet.
                        Empty string if the user was asked and explicitly chose to not provide this information.   
                        Do not insist on the user providing this information if they do not provide it.
                #JSON Output instructions
                    Your response must always be a JSON object with the following schema:
                    - ignored_experiences: An explanation in prose of the experiences referenced by the user that will not be added to the 
                                           'collected_experience_data' and why. These are experiences that were ignored.
                                           Follow the instructions in '#New Experience handling', '#Update Experience handling' and '#Delete Experience handling'.
                                            to determine which experience you will be ignoring.
                                           An empty string "" if no experiences will be ignored. 
                                           e.g. Experience was not referred to in the '<User's Last Input>'.
                                           Formatted as a json string      
                    - experience_references: Provide a brief explanation (up to 100 words) about which experience you will update or delete or add. 
                                This field should not contain any ignored experiences. This field should not contain any ignored experiences.
                                Follow the instructions in '#New Experience handling', '#Update Experience handling' and '#Delete Experience handling' 
                                to determine which experience you will be working with.
                                Include the index of the experience from the <Previously Extracted Experience Data>.
                                Formatted as a json string 
                    - experience_index: The index of the <Previously Extracted Experience Data> list if the 
                                experience is updated or deleted, or the next index in the list if it is a new experience. 
                                Use -1 if no experience is referenced.
                                Follow the instructions in '#New Experience handling', '#Update Experience handling' and '#Delete Experience handling' 
                                to determine which experience you will be working with.
                                Formatted as an integer.
                    - collected_experience_data: a single dictionary with the information about the experience referenced by the user.
                            `null` if no experience is referenced or it should be ignored. Otherwise, the dictionary should contain the following fields:
                            {{
                                - data_extraction_references: a dictionary with short (up to 100 words) explanations in prose (not json) about 
                                    what information you intend to collect based on the '<User's Last Input>' and the '<Conversation History>'.
                                    Remember that only one new experience can be collected at a time.
                                    Constrain the explanation to the data relevant for the fields 'experience_title', 
                                    'dates_mentioned', 'company' and 'location' and 'paid_work'. 
                                    Make sure the user is actually referring to an experience they have.
                                    Do not conduct date calculations, or work type classification. 
                                    Explain where you found the information e.g in '<User's Last Input>'.
                                    Formatted as a json string.
                                    Example: ... the user responded in the '<...' to the model's question in '<...' ...
                                    {{
                                    - experience_title_references: 
                                    - dates_mentioned_references:
                                    - company_references:
                                    - location_references:
                                    - paid_work_references:
                                    }}
                                - data_operation: Give a short explanation of what kind operation should be performed to the experience:
                                    'ADD', 'UPDATE', 'DELETE'.
                                - index: For an experience that exists in the <Previously Extracted Experience Data>, the index of that experience. 
                                         For a new experience, the next index in the <Previously Extracted Experience Data> list.
                                         Formatted as a json integer.
                                - experience_title: A title for the experience. Formatted as a json string.
                                - company: The type of company and its name. Formatted as a json string.
                                - location: The location in which the job was performed. Formatted as a json string.
                                - paid_work: A boolean value indicating whether the work was paid or not. 
                                             Formatted as a json boolean.
                                - work_type_classification_reasoning: Give a short explanation of how the information collected 
                                            until now is evaluated based on the instructions of 'work_type' 
                                            to classify the type of work of the experience.
                                            The explanation must be in the form:
                                                "Classified as <VALUE> because <REASONING>".
                                                "Not classified as <VALUE> because <REASONING>".
                                                Formatted as a json string.    
                                - work_type: type of work of the experience, 'FORMAL_SECTOR_WAGED_EMPLOYMENT', 
                                             'FORMAL_SECTOR_UNPAID_TRAINEE_WORK', 'SELF_EMPLOYMENT', 'UNSEEN_UNPAID' or 'None'. 
                                             Other values are not permitted.
                                - dates_mentioned: The experience dates mentioned in the conversation. 
                                                   Empty string "" If you could not find any.
                                                   Formatted as a json string.                                    
                                - dates_calculations: A detailed explanation of any date calculations done to 
                                                    produce the start_date, and end_date values. 
                                                    Empty string "" If you did not perform any calculations.
                                                    Formatted as a json string.         
                                - start_date: The start date in YYYY/MM/DD or YYYY/MM or YYYY 
                                                    depending on what input was provided.
                                                    Empty string "" If you did not calculate any.
                                                    Formatted as a json string
                                - end_date: The end date in YYYY/MM//DD or YYYY/MM or YYYY or 'Present'
                                                    depending on what input was provided.
                                                    Empty string "" If you did not calculate any.
                                                    Formatted as a json string
                            }}                            
                 
                Your response must always be a JSON object with the schema above.
                </System Instructions>
                <Previously Extracted Experience Data> 
                    {previously_extracted_data} 
                </Previously Extracted Experience Data>   
                """)

        return replace_placeholders_with_indent(system_instructions_template,
                                                current_date=datetime.now().strftime("%Y/%m"),
                                                agent_character=STD_AGENT_CHARACTER,
                                                language_style=STD_LANGUAGE_STYLE,
                                                previously_extracted_data=previously_extracted_data,
                                                work_type_definitions=WORK_TYPE_DEFINITIONS_FOR_PROMPT
                                                )


def find_duplicate(item: CollectedData, items: list[CollectedData]) -> int:
    """
    Check if the item is a duplicating any of the items in the list.
    """
    for i, _item in enumerate(items):
        if CollectedData.compare_relaxed(item, _item):
            return i
    return -1


def format_history_for_prompt(collected_experience_data_so_far: list[CollectedData],
                              context: ConversationContext) -> str | None:
    _output: str = ""
    if context.summary != "":
        _output += f"{ConversationHistoryFormatter.USER}: '{ConversationHistoryFormatter.SUMMARY_TITLE}\n{context.summary}'"

    for turn in context.history.turns:
        # if there is a collected experience data that was defined at that turn,
        # then add a reference to help the model associate the experience data with that turn.
        # This help the model to connect the dots between the user's last input --> conversation history --> experience data
        # And follow the associations that it inferred in previous turns.
        _experience_ref = ""
        for _data in collected_experience_data_so_far:
            if _data.defined_at_turn_number == turn.index:
                _experience_ref = f" (see <Previously Extracted Experience Data> index={_data.index})"
                break

        _output += (f"{ConversationHistoryFormatter.USER}: '{sanitize_input(turn.input.message, _TAGS_TO_FILTER)}{_experience_ref}'\n"
                    f"{ConversationHistoryFormatter.MODEL}: '{sanitize_input(turn.output.message_for_user, _TAGS_TO_FILTER)}'\n")
    return _output
