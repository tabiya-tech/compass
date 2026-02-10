import logging
from textwrap import dedent
from typing import Optional

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.collect_experiences_agent.data_extraction_llm import clean_string_field
from app.agent.llm_caller import LLMCaller
from app.agent.penalty import get_penalty
from app.agent.prompt_template import sanitize_input
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_types import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, ZERO_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG, \
    get_config_variation
from common_libs.llm.schema_builder import with_response_schema
from common_libs.retry import Retry

_TAGS_TO_FILTER = [
    "system instructions",
    "user's last input",
    "conversation history",
]


class ExtractedData(BaseModel):
    """
    Extract data per an experience from the EntityExtractionTool.
    """

    # References and Reasoning.
    data_extraction_references: Optional[dict] = None

    # Experience Details
    experience_title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None


# Empty/Default extracted data.
_EMPTY_EXTRACTED_DATA = ExtractedData()


class _LLMOutput(BaseModel):
    """
    LLM Model Output.
    """

    associations: Optional[str]
    experience_details: ExtractedData


class EntityExtractionTool:
    """
    EntityExtractionTool (Sub-Agent)
    Responsibilities:
    - Given the user's statement about the experience, extract the experience details.
        — Company Name
        — Location
        — Experience Title (Job title)

    — Detect if the user doesn't want to share the details and mark then as empty string.
    — Base on the conversation history to know the information that is being asked and return that.
    """

    def __init__(self, logger: logging.Logger):
        self._logger = logger
        self._llm_caller = LLMCaller[_LLMOutput](model_response_type=_LLMOutput)

    @staticmethod
    def _get_llm(temperature_config: Optional[dict] = None) -> GeminiGenerativeLLM:
        # if no temperature configu provided, use the default one.
        if temperature_config is None:
            temperature_config = {}

        return GeminiGenerativeLLM(
            system_instructions=_SYSTEM_INSTRUCTIONS,
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "max_output_tokens": 3000
                    # Limit the output to 3000 tokens to avoid the "reasoning recursion issues"
                } | temperature_config | with_response_schema(_LLMOutput)
            ))

    async def execute(self,
                      *,
                      conversation_context: ConversationContext,
                      users_last_input: str) -> tuple[ExtractedData | None, list[LLMStats]]:
        prompt = _PROMPT_TEMPLATE.format(
            users_last_input=users_last_input,
            conversation_history=ConversationHistoryFormatter.format_history_for_agent_generative_prompt(
                conversation_context)
        )

        _llm_stats = []

        async def _callback(attempt: int, max_retries: int) -> tuple[ExtractedData, float, BaseException | None]:
            temperature_config = get_config_variation(start_temperature=0.5, end_temperature=1,
                                                      start_top_p=0.8, end_top_p=1,
                                                      attempt=attempt, max_retries=max_retries)

            llm = EntityExtractionTool._get_llm(temperature_config=temperature_config)
            self._logger.debug("Calling LLM with temperature: %s, top_p: %s",
                               temperature_config["temperature"],
                               temperature_config["top_p"])

            # Internally execute the tool.
            data, llm_stats, penality, error = await self._internal_execute(llm=llm, prompt=prompt)

            # Since there might be many retries, combine all the LLms
            _llm_stats.extend(llm_stats)

            return data, penality, error

        result, _result_penalty, _error = await Retry[str].call_with_penalty(callback=_callback, logger=self._logger)

        return result, _llm_stats

    async def _internal_execute(self,
                                *,
                                llm: GeminiGenerativeLLM,
                                prompt: str) -> tuple[ExtractedData, list[LLMStats], float, BaseException | None]:

        # Penalities, the higher the level, the more severe the penalty.
        no_response_penalty_level = 0

        response_data, _llm_stats = await self._llm_caller.call_llm(
            llm=llm,
            llm_input=sanitize_input(prompt, _TAGS_TO_FILTER),
            logger=self._logger)

        if not response_data:
            _error = ValueError("LLM did not return any output")
            self._logger.error(_error, stack_info=True)
            return _EMPTY_EXTRACTED_DATA, _llm_stats, get_penalty(no_response_penalty_level), _error

        experience_details = response_data.experience_details

        # Debug information
        self._logger.debug(dedent(f"""
            Associations: {response_data.associations}
            Experience Details: {experience_details.model_dump_json(indent=3)}
        """))

        # Constructed the extracted data without references.
        extracted_data = ExtractedData(
            experience_title=clean_string_field(experience_details.experience_title),
            company=clean_string_field(experience_details.company),
            location=clean_string_field(experience_details.location)
        )

        # Successful extraction, return 0 penalty.
        return extracted_data, _llm_stats, 0, None


_SYSTEM_INSTRUCTIONS = """
<System Instructions>
#Role
    You are an expert who extracts basic information regarding the job seeker's work experience Based on the questions asked and the answers provided.
    Do not over-suggest any information, only extract the ones provided explicitly by the user.
        
#Extract data instructions
    Make sure you are extracting information about experiences that should be added to the 'experience_details' field.
    And not information that should be ignored. (Especially irrelevant information)
    
    You will collect information for the following fields:-
    - experience_title
    - company
    - location
    
    You will collect and place them to the output as instructed below:
    ##'experience_title' instructions
        Extract the title of the experience from the '<User's Last Input>', but do not alter it.
        For unpaid work, use the kind of work done (e.g. "Helping Neighbors", "Volunteering" etc).
        Make sure that the user is actually referring to an experience they have have.
        When summarizing a user-stated action (e.g., "I sell tomatoes"), convert it directly into a gerund-phrase experience title (e.g., "Selling Tomatoes"). 
        Return a string value containing the title of the experience.
        Use `null`: If the user has not mentioned their `experience title` and has not yet been asked to provide it.
        Use "": If the user explicitly declines to provide their `experience title` when explicitly asked, or requests that previously stored `experience title` data be deleted.
        
    ##'company' instructions
        What the company does or name of the company depending on the context.
        Use specific company names (eg: Acme inc) not generic ones (eg: 'company', 'online, 'organization', 'freelance' or 'self') in the output.
        For unpaid work, use the receiver of the work (e.g. "My Family", "My Community", etc) but not the generic name.
        Return a string value containing the type, or name of the company, or the receiver of the work.
        Use `null`: If the user has not mentioned their `company name` and has not yet been asked to provide it.
        Use "": If the user explicitly declines to provide their `company name` when explicitly asked, or requests that previously stored `company name` data be deleted.
        
     ##'location' instructions 
        The location (e.g City, Region, District) where the job was performed or the company is located any one of them. 
        In case of paid remote work or work from home use (Remote, <City>, Home Office, <City> etc) as the location.
        For unpaid work, use the receiver's location.
        Return a string value containing the location.
        Use `null`: If the user has not mentioned their location and has not yet been asked to provide it.
        Use "": If the user explicitly declines to provide their location when explicitly asked, or requests that previously stored location data be deleted.

#JSON Output instructions
    - associations: Generate a linear chain of associations in the form of ...-> ...->... that start from the User's Last Input 
        and follow the relevant entries they refer to in the Conversation History until they terminate to the Previously Extracted Experience Data, if relevant. 
        ///Skip unrelated or tangential turns to preserve a coherent causal chain of associations.
        ///You are filtering for semantic lineage rather than strictly temporal proximity.
        Once you reach the Previously Extracted Experience Data, you will not follow the associations anymore.
        e.g. "user(<answer>) -> model(<question>) -> ... -> user(<answer>) -> model(<question>) -> Previously Extracted Experience Data(...)"
        Each step in the sequence should be a summarized version of the actual user or model turn.
        You are not expected to reach a maximum of 10 steps in this linear chain to avoid circular references.
    - experience_details: an Object of experience details you extracted from the user's statement and conversation history.
        {{
            - data_extraction_references: a dictionary with short (up to 100 words) explanations in prose (not json) about 
                what information you intend to collect based on the '<User's Last Input>' and the '<Conversation History>'.
                Constrain the explanation to the data relevant for the fields 'experience_title', 'company' and 'location' 
                Explain where you found the information e.g in '<User's Last Input>'.
                More of like the reason why you shared the respective values or empty values.
                Formatted as a json string.
                Example: ... the user responded in the '<...' to the model's question in '<...' ...
                {{
                    - experience_title_references: 
                    - company_references:
                    - location_references:
                }}
            - experience_title: A title for the experience. Formatted as a json string. Refer to the "##'experience_title' instructions" section.
            - company: The name of the company or type. Formatted as a json string. Refer to the "##'company' instructions" section.
            - location: The location in which the job was performed. Formatted as a json string. Refer to the "##'location' instructions" section.
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
"""
