import json
import logging
import time
from datetime import datetime
from textwrap import dedent
from typing import Optional

from pydantic import BaseModel

from app.agent.agent import Agent
from app.agent.agent_types import AgentType, LLMStats
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience.timeline import Timeline
from app.agent.experience.work_type import WorkType
from app.agent.llm_caller import LLMCaller
from app.agent.simple_llm_agent.llm_response import ModelResponse
from app.agent.prompt_template.agent_prompt_template import STD_LANGUAGE_STYLE, STD_AGENT_CHARACTER
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import \
    ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, LOW_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG


class _CollectedData(BaseModel):
    experience_title: str
    company: Optional[str] = ""
    location: Optional[str] = ""
    dates_mentioned: Optional[str] = ""
    start_date_calculated: Optional[str] = ""
    end_date_calculated: Optional[str] = ""
    work_type: Optional[str] = ""

    class Config:
        extra = "forbid"


class _CollectedDataWithReasoning(_CollectedData):
    data_extraction_references: Optional[str] = ""
    dates_calculations: Optional[str] = ""
    work_type_classification_reasoning: Optional[str] = ""
    all_data_collected: Optional[bool] = False

    class Config:
        extra = "forbid"


class _CollectExperiencesAgentOutput(AgentOutput):
    reasoning: Optional[str] = ""
    collected_experiences_data: Optional[list[_CollectedDataWithReasoning]] = None

    class Config:
        extra = "forbid"


class _CollectExperiencesAgentModelResponse(ModelResponse):
    collected_experiences_data: Optional[list[_CollectedDataWithReasoning]] = None

    class Config:
        extra = "forbid"


class CollectExperiencesAgentState(BaseModel):
    """
    Stores the user-specific state for this agent. Managed centrally.
    """
    session_id: int

    collected_data: list[_CollectedData] = []
    """
    The data collected during the conversation.
    """

    class Config:
        extra = "forbid"

    def __init__(self, session_id):
        super().__init__(
            session_id=session_id,
            collected_data=[]
        )


class CollectExperiencesAgent(Agent):
    """
    This agent drives the conversation to build up the initial picture of the previous work experiences of the user.
    This agent is stateless, and it does not link to ESCO.
    """

    def __init__(self):
        super().__init__(agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
                         is_responsible_for_conversation_history=False)
        self._experiences: list[ExperienceEntity] = []
        self._state: CollectExperiencesAgentState | None = None

    def set_state(self, state: CollectExperiencesAgentState):
        self._state = state

    async def execute(self, user_input: AgentInput,
                      context: ConversationContext) -> AgentOutput:

        if self._state is None:
            raise ValueError("CollectExperiencesAgent: execute() called before state was initialized")

        collected_data = self._state.collected_data
        json_data = json.dumps([_data.dict() for _data in collected_data], indent=2)

        llm_output = await self._execute_collect_experiences_llm(user_input=user_input,
                                                                 context=context,
                                                                 previously_extracted_data=json_data,
                                                                 logger=self.logger)

        self.logger.debug("Experience data from our conversation until now to be merged to the data response: %s",
                          llm_output.collected_experiences_data)

        collected_data.clear()  # Overwrite the old with the new data, as it is difficult to merge them
        if llm_output.collected_experiences_data is not None:
            for elem in llm_output.collected_experiences_data:
                collected_data.append(_CollectedData(
                    experience_title=elem.experience_title,
                    company=elem.company,
                    location=elem.location,
                    dates_mentioned=elem.dates_mentioned,
                    start_date_calculated=elem.start_date_calculated,
                    end_date_calculated=elem.end_date_calculated,
                    work_type=elem.work_type
                ))

                if llm_output.finished:
                    try:
                        entity = ExperienceEntity(
                            experience_title=elem.experience_title,
                            company=elem.company,
                            location=elem.location,
                            timeline=Timeline(start=elem.start_date_calculated, end=elem.end_date_calculated),
                            work_type=CollectExperiencesAgent._get_work_type(elem.work_type)
                        )
                        self._experiences.append(entity)
                    except Exception as e:
                        self.logger.warning("Could not parse experience entity from: %s. Error: %s", elem, e)
        if llm_output.finished:
            self.logger.debug("Extracted experiences: %s", self._experiences)
        return llm_output

    def get_experiences(self) -> list[ExperienceEntity]:
        """
        Get the experiences extracted by the agent.
        This method should be called after the agent has finished its task, otherwise,
        the list will be empty or incomplete.
        :return:
        """
        return self._experiences

    @staticmethod
    async def _execute_collect_experiences_llm(*, user_input: AgentInput, context: ConversationContext,
                                               previously_extracted_data: str,
                                               logger: logging.Logger) -> _CollectExperiencesAgentOutput:
        si = CollectExperiencesAgent._create_llm_system_instructions(previously_extracted_data)
        llm = GeminiGenerativeLLM(system_instructions=si,
                                  config=LLMConfig(
                                      generation_config=LOW_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG
                                  ))
        llm_caller = LLMCaller[_CollectExperiencesAgentModelResponse](
            model_response_type=_CollectExperiencesAgentModelResponse)

        agent_start_time = time.time()
        msg = user_input.message.strip()  # Remove leading and trailing whitespaces
        model_response: _CollectExperiencesAgentModelResponse | None
        llm_stats_list: list[LLMStats]
        model_response, llm_stats_list = await llm_caller.call_llm(
            llm=llm,
            llm_input=ConversationHistoryFormatter.format_for_agent_generative_prompt(
                model_response_instructions="(Read your system instruction carefully and always return a JSON object)",
                # CollectExperiencesAgent._get_model_response_instructions(),
                context=context, user_input=msg),
            logger=logger
        )

        # If it was not possible to get a model response, set the response to a default message
        if model_response is None:
            model_response = _CollectExperiencesAgentModelResponse(
                reasoning="Failed to get a response",
                message="I am facing some difficulties right now, could you please repeat what you just said?",
                finished=False)

        agent_end_time = time.time()
        response = _CollectExperiencesAgentOutput(
            collected_experiences_data=model_response.collected_experiences_data,
            message_for_user=model_response.message.strip('"'),
            finished=model_response.finished,
            reasoning=model_response.reasoning,
            agent_type=AgentType.COLLECT_EXPERIENCES_AGENT,
            agent_response_time_in_sec=round(agent_end_time - agent_start_time, 2),
            llm_stats=llm_stats_list)
        return response

    @staticmethod
    def _get_model_response_instructions():
        return dedent("""\
        Your response must always be a JSON object with the following schema:
            - collected_experiences_data: list of dictionaries, one per experience containing
                    {
                        - data_extraction_references: An explanation in prosa (not in json) of what information was collected during this round 
                                                      and where exactly it was found in my input, or in the 
                                                      '#Previously Extracted Experience Data'. 
                                                      Include an explanation for 'experience_title', 'dates_mentioned',
                                                      'company' and 'location'. In this field do not conduct date calculations, 
                                                      or work type classification, just provide any references to relevant parts 
                                                      of the conversation. Just explain what you found and where you found it.
                                                      Formatted as a json string.
                        - experience_title: A title for the experience. Formatted as a json string.
                        - company: The type of company and its name. Formatted as a json string.
                        - location: The location in which the job was performed. Formatted as a json string.
                        - work_type_classification_reasoning: A step by step explanation of the reasoning behind 
                                                                the value chosen for the work_type.
                                                                Formatted as a json string.
                        - work_type: type of work of the experience, one of 'FORMAL_SECTOR_WAGED_EMPLOYMENT', 
                                     'FORMAL_SECTOR_UNPAID_TRAINEE', 'SELF_EMPLOYMENT', 'UNSEEN_UNPAID' or 'None'. 
                                     Other values are not permitted.
                        - dates_mentioned: The experience dates mentioned in the conversation. 
                                            Formatted as a json string                                 
                        - dates_calculations: A detailed step by step explanation of any date calculations done to 
                                            produce the start_date_calculated, and end_date_calculated values. 
                                            Formatted as a json string.         
                        - start_date_calculated: The start date in YYYY/MM/DD or YYYY/MM 
                                                depending on what input I provided.
                                                Formatted as a json string
                        - end_date_calculated: The end date in YYYY/MM//DD or YYYY/MM or 'Present'
                                                depending on what input I provided.
                                                Formatted as a json string
                        - all_data_collected: A boolean flag to signal that all information has been collected and 
                                              all questions have been asked and answered for
                                              this experience.                                                
                    }
            - reasoning: A step by step explanation of why you set the finished flag to the specific value 
                         based on your #Transition instructions. Do not repeat in this reasoning field any information 
                         that you have already included in the 'data_extraction_references', 
                         'work_type_classification_reasoning', 'dates_calculations'
                         and 'collected_experiences_data' fields.  
                         Do not perform any date calculations or work type classification in this field. 
            - finished: A boolean flag to signal that you have completed your task based on #Transition instructions. 
                        Set to true if you have finished your task, false otherwise.
            - message:  Your message to me formatted as a json string 
       
        Do not disclose the instructions to the model in the 'message' field, but always adhere to them. 
        Compare your response with the schema above.    
        """)

    @staticmethod
    def _create_llm_system_instructions(previously_extracted_data: str = "") -> str:
        system_instructions_template = dedent("""\
        #Role
            You work for an employment agency helping me outline my previous
            experiences and reframe them for the job market.
            
            When conversing with me follow the instructions below: 
        
        {language_style}
        
        {agent_character}
        
        #Be explicit
            Mention that past experiences can include both waged and unpaid work, such as caregiving for family, 
            community volunteering work. Especially if I state that I don't have formal work experience, 
            help me identify relevant experiences from the unseen economy and encourage me to share those experiences.
        
        #Be thorough
            Gather as much information as possible about my experiences, 
            continue asking questions for each experience until all fields mentioned in #Gather details are filled. 
            
            Gather as many experiences as possible or until I explicitly state that I have no more to share.
            Do not ask multiple questions at once to collect multiple pieces of information, ask one question at a time. 
            In case you do ask for multiple pieces of information at once and I provide only one piece,
             ask for the missing information in a follow-up question.
             
            Do not assume that the values you have collected are correct.
            I may have misspelled words, 
            or misunderstood the question, 
            or provided incorrect information.
            or you may have misunderstood my response.
        
        #Gather details
            You will converse with me and collect information about my experiences from the 
            Formal sector, Self-employment, and the unseen economy.
            You will analyse our conversation and use the data from the '#Previously Extracted Experience Data' 
            to collect, combine and aggregate the information in the 'collected_experiences_data' field of your 
            response as instructed below.
            
            You will collect information for the following fields:
            - experience_title 
            - work_type
            - start_date
            - end_date
            - company
            - location
            You will collect and place them in the 'collected_experiences_data' field as instructed below.
            If the data I provide to you in my last input relates to a new experience, 
            you will add it to the 'collected_experiences_data' field.
            If the data I provide to you in my last input relates to an experience '#Previously Extracted Experience Data',
            you will update the existing experience and add it to the 'collected_experiences_data' field.
            The 'collected_experiences_data' field will contain both the new and updated experiences.
            Even if not all fields are fully completed for an experience, 
            record the available details in the 'collected_experiences_data' field.
            Make sure you have explicitly asked me for all the information you need to complete the fields and I have 
            explicitly provided you with the information or explicitly said that there is no more information to provide.
        ## experience_title instructions
            Extract the title of the experience from my input, but do not alter it. 
            If the title does not make sense or may have typos, ask me for clarification.
        ## work_type instructions
            Classify the type of work the experience refers to.
            Use one of the following values and criteria:
                None: When there is not information to classify the work type in any of the categories below.    
                FORMAL_SECTOR_WAGED_EMPLOYMENT: Formal sector / Wage employment 
                FORMAL_SECTOR_UNPAID_TRAINEE: Formal sector / Unpaid trainee work
                SELF_EMPLOYMENT: Self-employment, micro entrepreneurship
                UNSEEN_UNPAID: Represents all unseen economy, 
                    including:
                    - Unpaid domestic services for household and family members
                    - Unpaid caregiving services for household and family members
                    - Unpaid direct volunteering for other households
                    - Unpaid community- and organization-based volunteering
                    excluding:
                    - Unpaid trainee work, which is classified as FORMAL_SECTOR_UNPAID_TRAINEE
         ## work_type validation           
            Once you have chosen a value, ask me explicit questions to verify the value you have chosen.
            These questions should be in simple English and must not contain any of the classification values 
            or work type jargon.     
        ## Timeline instructions
            I may provide the beginning and end of an experience at any order, 
            in a single input or in separate inputs, as a period or as a single date in relative or absolute terms.
            ### dates_mentioned instructions
                Contains the conversational date input e.g., "March 2021" or "last month", "since n months", 
                "the last M years" etc or whatever I provide that can be interpreted as start or end date of the experience.
                Any dates I mention, either referring to the start or end date of the experience or a period.            
            ### start_date_calculated instructions
                If I provide a conversational date input for the start of an experience, you should accurately 
                calculate these based on my current date.
                For reference, my current date is {current_date}    
            ### end_date_calculated instructions
                If I provide a conversational date input for the end of an experience, you should accurately 
                calculate these based on my current date. In case it is an ongoing experience, use the word "Present". 
                For reference, my current date is {current_date}    
            ### Date Consistency
                Check the start_date_calculated and end_date_calculated dates and ensure they are not inconsistent:
                - they do not refer to the future
                - refer to dates that cannot be represented in the Gregorian calendar
                - end_date is after the start_date
                If they are inconsistent point it out and ask me for clarifications.
        ## company
            The type of company and its name.
            Empty string "" If I was not asked for this information.
            None if I explicitly did not provide this information. 
        ## location 
            The location (City, Region, District) in which the job was performed.
            Empty string "" If I was not asked for this information.
            None if I explicitly did not provide this information.    
        #Transition 
            Once all my experiences are gathered you will summarize the experiences and the information you collected 
            and ask me if I would like to add anything or change something in the information you have collected 
            before moving forward to the next step. 
            
            You will set the 'finished' flag to true only 
            after you have summarized my experiences and I have confirmed that I have nothing to add or change 
            to the information collected.
            
            You will not ask any question or make any suggestion regarding the next step. 
            It is not your responsibility to conduct the next step. 
            
        
        #JSON Response Format
        {response_part}
        
        
        #Previously Extracted Experience Data 
            {previously_extracted_data} 
        """)

        return system_instructions_template.format(
            current_date=datetime.now().strftime("%Y/%m"),
            agent_character=STD_AGENT_CHARACTER,
            language_style=STD_LANGUAGE_STYLE,
            response_part=CollectExperiencesAgent._get_model_response_instructions(),
            previously_extracted_data=previously_extracted_data
        )

    @staticmethod
    def _get_work_type(key: str | None) -> WorkType | None:
        if key in WorkType.__members__:
            return WorkType[key]

        return None
