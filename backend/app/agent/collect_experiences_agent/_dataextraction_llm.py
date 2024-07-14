import logging

from datetime import datetime
from textwrap import dedent
from typing import Optional

from pydantic import BaseModel

from app.agent.agent_types import AgentInput, LLMStats
from app.agent.collect_experiences_agent._types import CollectedData
from app.agent.experience.work_type import WORK_TYPE_DEFINITIONS_FOR_PROMPT
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template.agent_prompt_template import STD_LANGUAGE_STYLE, STD_AGENT_CHARACTER
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, ZERO_TEMPERATURE_GENERATION_CONFIG


class _CollectedDataWithReasoning(CollectedData):
    data_extraction_references: Optional[str] = ""
    dates_mentioned: Optional[str] = ""
    dates_calculations: Optional[str] = ""
    work_type_classification_reasoning: Optional[str] = ""
    all_data_collected: Optional[bool] = False

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"


class _CollectedExperiences(BaseModel):
    reasoning: Optional[str] = ""
    job_seeker_class: Optional[str] = ""
    collected_experiences_data: Optional[list[_CollectedDataWithReasoning]] = None

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"


class _DataExtractionLLM:
    def __init__(self, logger: logging.Logger):
        self._llm_caller = LLMCaller[_CollectedExperiences](model_response_type=_CollectedExperiences)
        self.logger = logger

    async def execute(self, *, user_input: AgentInput, context: ConversationContext,
                      collected_experience_data: str = "") -> tuple[_CollectedExperiences, list[LLMStats]]:
        """
        Given the last user input, a conversation history and the experience data collected so far.
        Extracts the experience data from the user input and conversation history and
        updates the collected experience data.

        :param user_input:  The last user input
        :param context: The conversation context with the conversation history
        :param collected_experience_data: The collected experience data so far
        :return: The extracted experience data and the LLM stats
        """
        llm = GeminiGenerativeLLM(
            system_instructions=_DataExtractionLLM._create_extraction_system_instructions(collected_experience_data),
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG
            ))
        msg = user_input.message.strip()  # Remove leading and trailing whitespaces

        call_response = await self._llm_caller.call_llm(llm=llm,
                                                        llm_input=ConversationHistoryFormatter.format_to_string(
                                                            context=context, user_message=msg),
                                                        logger=self.logger)
        return call_response

    @staticmethod
    def _create_extraction_system_instructions(previously_extracted_data: str = "") -> str:
        system_instructions_template = dedent("""\
            #Role
                You are an expert who extracts information from a conversation between a 'user' and a 'model'. 

            # Input
                You will be given the following
                - The last input from the user in '#Last User Input'
                - The conversation history in '#Conversation History' that can help you put the last input in context
                - The data collected so far in the '#Previously Extracted Experience Data' field
            #Extract data instructions
                You will analyse a conversation from '#Last User Input' and '#Conversation History'
                and use the data from the '#Previously Extracted Experience Data' 
                to extract information for the following fields:
                - job_seeker_class
                For each experience, you will collect information for the following fields:
                - experience_title 
                - work_type
                - start_date
                - end_date
                - company
                - location
               
            You will collect and place them to the output as instructed below:
                ##New Experience handling
                - If the data in the conversation's '#Last User Input' relates to a new experience, 
                  you will add the new experience to the 'collected_experiences_data' field.
                ##Update Experience handling 
                - If the data provided to you in the '#Last User Input' relates to an experience that is present in the
                  '#Previously Extracted Experience Data', you will update the existing experience and add it to the 
                  'collected_experiences_data' field of your output.
                ##Irrelevant data handling 
                - If the data provided to you in the '#Last User Input' does not relate to an experience at all
                    you will not add it to the 'collected_experiences_data' field of your output.
                ##Merging data and duplicates handling        
                - The 'collected_experiences_data' field of your output will contain both the new and the updated experiences.
                - Ensure that each experience is represented only once in the 'collected_experiences_data' field.
                - If you find an experience that is present twice in the  #Previously Extracted Experience Data
                  then you should merge the two experiences into one.
                ##Missing/Incomplete Experience data handling    
                - Record the available details in the 'collected_experiences_data' field, even if some of the fields are 
                  not fully completed for an experience. 
                      
                ##'job_seeker_class' instructions
                    You will analyse a conversation from '#Last User Input' and '#Conversation History'  
                    and use the data from the '#Previously Extracted Experience Data' to classify the job seeker into one 
                    of the following classes:
                    - HAS_WORK_EXPERIENCE: If the job seeker has work experience
                    - HAS_NO_WORK_EXPERIENCE: If the job seeker has no work experience   
                    - None: If it is not clear if the job seeker has work experience or not      
                ##'experience_title' instructions
                    Extract the title of the experience from the conversation, but do not alter it.
                    Empty string "" If you have not found this information yet.
                    `null` if the user explicitly did not provide this information.    
                ##'work_type' instructions
                    Classify the type of work the experience refers to.
                    Use one of the following values and criteria:
                        {work_type_definitions}   
                ##Timeline instructions
                    The user may provide the beginning and end of an experience at any order, 
                    in a single input or in separate inputs, as a period or as a single date in relative or absolute terms.
                    ###'dates_mentioned' instructions
                        Contains the conversational date input e.g., "March 2021" or "last month", "since n months", 
                        "the last M years" etc or whatever I provide that can be interpreted as start or end date of the experience. 
                        Any dates I mention, either referring to the start or end date of the experience or a period.            
                    ###'start_date_calculated' instructions
                        If I provide a conversational date input for the start of an experience, you should accurately 
                        calculate these based on my current date.
                        Empty string "" If you have not found this information yet.
                        `null` if the user explicitly did not provide this information.
                        For reference, my current date is {current_date}        
                    ###'end_date_calculated' instructions
                        If I provide a conversational date input for the end of an experience, you should accurately 
                        calculate these based on my current date. In case it is an ongoing experience, use the word "Present". 
                        Empty string "" If you have not found this information yet.
                        `null` if the user explicitly did not provide this information.
                        For reference, my current date is {current_date}    
                ##'company' instructions
                    The type of company and its name.
                    Empty string "" If you have not found this information yet.
                    `null` if the user explicitly did not provide this information.
                    Do not insist on the user providing this information if they do not provide it. 
                ##'location' instructions 
                    The location (City, Region, District) in which the job was performed.
                    Empty string "" If you have not found this information yet.
                    `null` if the user explicitly did not provide this information.    
                    Do not insist on the user providing this information if they do not provide it.
            #JSON Output instructions
                Your response must always be a JSON object with the following schema:
                - job_seeker_class: The class of the job seeker. One of 'WORK_EXPERIENCE', 'NO_WORK_EXPERIENCE' or 'None'.
                                    Formatted as a json string. 
                - collected_experiences_data: [ list of dictionaries, one per experience containing
                        {{
                            - index: The index of the experience in the list. Formatted as a json integer.
                            - data_extraction_references: An explanation in prosa (not in json) of what information 
                                                was collected during this round 
                                                and where exactly it was found in the input, or in the 
                                                '#Previously Extracted Experience Data'. 
                                                Include in the explanation the fields 'experience_title', 
                                                'dates_mentioned', 'company' and 'location'. 
                                                In this field do not conduct date calculations, or work type classification, 
                                                just provide any references to relevant parts of the conversation. 
                                                Just explain what you found and where you found it.
                                                Formatted as a json string.
                            - experience_title: A title for the experience. Formatted as a json string.
                            - company: The type of company and its name. Formatted as a json string.
                            - location: The location in which the job was performed. Formatted as a json string.
                            - work_type_classification_reasoning: A explanation of the reasoning behind 
                                                                    the value chosen for the work_type.
                                                                    Formatted as a json string.
                            - work_type: type of work of the experience, Has_Work_Experience 'FORMAL_SECTOR_WAGED_EMPLOYMENT', 
                                         'FORMAL_SECTOR_UNPAID_TRAINEE', 'SELF_EMPLOYMENT', 'UNSEEN_UNPAID' or 'None'. 
                                         Other values are not permitted.
                            - dates_mentioned: The experience dates mentioned in the conversation. 
                                                Formatted as a json string                                 
                            - dates_calculations: A detailed explanation of any date calculations done to 
                                                produce the start_date_calculated, and end_date_calculated values. 
                                                Formatted as a json string.         
                            - start_date_calculated: The start date in YYYY/MM/DD or YYYY/MM 
                                                    depending on what input was provided.
                                                    Formatted as a json string
                            - end_date_calculated: The end date in YYYY/MM//DD or YYYY/MM or 'Present'
                                                    depending on what input was provided.
                                                    Formatted as a json string
                            - all_data_collected: A boolean flag to signal that all information has been collected
                        }}
                        ]     
                
            #Previously Extracted Experience Data 
                {previously_extracted_data} 
                
            Your response must always be a JSON object with the schema above.
            """)

        return system_instructions_template.format(
            current_date=datetime.now().strftime("%Y/%m"),
            agent_character=STD_AGENT_CHARACTER,
            language_style=STD_LANGUAGE_STYLE,
            previously_extracted_data=previously_extracted_data,
            work_type_definitions=WORK_TYPE_DEFINITIONS_FOR_PROMPT
        )
