import logging
from datetime import datetime
from textwrap import dedent
from typing import Optional

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.collect_experiences_agent.data_extraction_llm._common import clean_string_field
from app.agent.experience.work_type import WORK_TYPE_DEFINITIONS_FOR_PROMPT
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template import sanitize_input
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, ZERO_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG

_TAGS_TO_FILTER = [
    "system instructions",
    "user's last input",
    "conversation history",
]


class ExtractedData(BaseModel):
    paid_work: Optional[bool | str]
    work_type: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]


class ExtractedDataWithReferences(BaseModel):
    data_extraction_references: Optional[dict]
    dates_mentioned: Optional[str]
    dates_calculations: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]

    paid_work: Optional[bool | str]
    work_type: Optional[str]
    work_type_classification_reasoning: Optional[str]


class _LLMOutput(BaseModel):
    associations: Optional[str]
    experience_details: Optional[ExtractedDataWithReferences]

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"


class TemporalAndWorkTypeClassifierTool:

    def __init__(self, logger: logging.Logger):
        self._logger = logger
        self._llm_caller = LLMCaller[_LLMOutput](model_response_type=_LLMOutput)

        _systems_instructions = _SYSTEM_INSTRUCTIONS.format(work_type_definitions=WORK_TYPE_DEFINITIONS_FOR_PROMPT,
                                                            current_date=datetime.now().strftime("%Y/%m"))

        self._llm = GeminiGenerativeLLM(
            system_instructions=_systems_instructions,
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "max_output_tokens": 3000
                    # Limit the output to 3000 tokens to avoid the "reasoning recursion issues"
                }
            ))

    async def execute(self,
                      *,
                      experience_title: Optional[str],
                      conversation_history: list[tuple[str, str]],
                      users_last_input: str) -> tuple[ExtractedData | None, list[LLMStats]]:
        prompt = _PROMPT_TEMPLATE.format(
            users_last_input=users_last_input,
            conversation_history=format_conversation_history(conversation_history),
            experience_title=experience_title
        )

        response_data, llm_stats = await self._llm_caller.call_llm(
            llm=self._llm,
            llm_input=sanitize_input(prompt, _TAGS_TO_FILTER),
            logger=self._logger)

        if not response_data:
            self._logger.error("The LLM did not return any output.")
            return None, llm_stats

        experience_details = response_data.experience_details

        # Debug information
        self._logger.info(dedent(f"""
            Associations: {response_data.associations}
            Experience Details: {experience_details.model_dump_json(indent=3)}
        """))

        # Constructed the extracted data without references.
        extracted_data = ExtractedData(
            paid_work=clean_string_field(experience_details.paid_work),
            work_type=clean_string_field(experience_details.work_type),
            start_date=clean_string_field(experience_details.start_date),
            end_date=clean_string_field(experience_details.end_date),
        )

        return extracted_data, llm_stats


def format_conversation_history(conversation_history: list[tuple[str, str]]) -> str:
    formatted_lines = []

    for user_msg, compass_msg in conversation_history:
        formatted_lines.append(f"User: {user_msg}")
        if compass_msg:  # Only add Compass response if it exists
            formatted_lines.append(f"Compass: {compass_msg}")
        formatted_lines.append("")  # Add a blank line between exchanges

    return "\n".join(formatted_lines).rstrip()


_SYSTEM_INSTRUCTIONS = """
<System Instructions>
#Role
    You are an expert who extracts dates and classifies experiences in work types based on user's last statement and conversation history.
    Do not suggest any field, only extract the information!
        
#Extract data instructions
    Make sure you are extracting information about experiences that should be added to the 'experience_details' field' 
    and not information that should be ignored.
    You will collect information for the following fields:-
    
    - paid_work
    - work_type
    - start_date    
    - end_date    
    
    You will collect and place them to the output as instructed below:
    ##'paid_work' instructions
        Determine if the experience was for money or not.
        Boolean value indicating whether the work was paid or not.
        If it seems like a formal work experience the it should be marked as paid.
        `null` It was not provided by the user and the user was not explicitly asked for this information yet.
        Empty string if the user was asked and explicitly chose to not provide this information. 
        `null` if the information was not provided by the user and the user was not explicitly asked for this information yet.
        Use empty string if the user was asked and explicitly chose to not provide this information, or the user don't want us to store the information any more.
    
    ##'work_type' instructions
        Classify the type of work of the work experience.
        Use the '<User's Last Input>' and relate it to the'<Conversation History>' to determine the type of work.
        Base also on the {{ experience_title }} and try to infer the work type from it.
        Choose one of the following values:
            {work_type_definitions}   
        `null` if the information was not provided by the user and the user was not explicitly asked for this information yet.
        Use empty string if the user was asked and explicitly chose to not provide this information, or the user don't want us to store the information any more.
        
    ##Timeline instructions
        The user may provide the beginning and end of an experience at any order, 
        in a single input or in separate inputs, as a period or as a single date in relative or absolute terms.
        The user may mention only one date, you may consider it as the start and the end of the experience.
        ###'dates_mentioned' instructions
            Contains the conversational date input e.g., "March 2021" or "last month", "since n months", 
            "the last M years" etc or whatever I provide that can be interpreted as start or end date of the experience. 
            Any dates I mention, either referring to the start or end date of the experience or a period.    
            null if the information was not provided by the user and the user was not explicitly asked for this information yet.
            Use empty string if the user was asked and explicitly chose to not provide this information, or the user don't want us to store the information any more.
                
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
            null It was not provided by the user and the user was not explicitly asked for this information yet.
            Empty string if the user was asked and explicitly chose to not provide this information. 
            For reference, my current date is {current_date}    
            
#JSON Output instructions
    - associations: Generate a linear chain of associations in the form of ...-> ...->... that start from the User's Last Input 
        and follow the relevant entries they refer to in the Conversation History until they terminate to the Previously Extracted Experience Data, if relevant. 
        ///Skip unrelated or tangential turns to preserve a coherent causal chain of associations.
        ///You are filtering for semantic lineage rather than strictly temporal proximity.
        Once you reach the Previously Extracted Experience Data, you will not follow the associations anymore.
        e.g. "user('...') -> model('...') -> ... -> user('...') -> model('...') -> Previously Extracted Experience Data(...)"
        Each step in the sequence should be a summarized version of the actual user or model turn.
    
    - experience_details: an Object of experience details you extracted from the user's statement and conversation history. 
        {{
            - data_extraction_references: a dictionary with short (up to 100 words) explanations in prose (not json) about 
                what information you intend to collect based on the '<User's Last Input>' and the '<Conversation History>'.
                Constrain the explanation to the data relevant for the fields 'paid_work', 'work_type', 'start_date' and 'end_date' 
                Explain where you found the information e.g in '<User's Last Input>'.
                Formatted as a json string.
                Example: ... the user responded in the '<...' to the model's question in '<...' ...
                {{
                    - dates_mentioned_references: 
                    - work_type_references:
                    - paid_work_references:
                }}
            - paid_work: A boolean value indicating whether the work was paid or not. 
                     Formatted as a json boolean.
            - work_type_classification_reasoning: A detailed, step-by-step explanation of how the information collected 
                        until now, is evaluated based on the instructions of 'work_type', to classify the type of work of the experience.
                        Formatted as a JSON string.
            - work_type: type of work of the experience, 'FORMAL_SECTOR_WAGED_EMPLOYMENT', 
                         'FORMAL_SECTOR_UNPAID_TRAINEE_WORK', 'SELF_EMPLOYMENT', 'UNSEEN_UNPAID' or 'None'. 
                         Other values are not permitted.
            - dates_mentioned: The experience dates mentioned in the conversation. 
                               Empty string "" If you could not find any.
                               Formatted as a json string.                                    
            - dates_calculations: A detailed, step-by-step explanation of any date calculations done to 
                                produce the start_date, and end_date values. 
                                Empty string "" If you did not perform any calculations.
                                Formatted as a json string.         
            - start_date: The start date in YYYY/MM/DD or YYYY/MM or YYYY 
                                depending on what input was provided.
                                Empty string "" If not provided
                                Formatted as a json string
            - end_date: The end date in YYYY/MM//DD or YYYY/MM or YYYY or 'Present'
                                depending on what input was provided.
                                Empty string "" If not provided.
                                Formatted as a json string
        }}                            
</System Instructions>
"""

_PROMPT_TEMPLATE = """
<Conversation History>
{conversation_history}
</Conversation History>

<User's Last Input>
user: {users_last_input}
</User's Last Input>

<Experience Details>
experience_title: {experience_title}
</Experience Details>
"""
