import logging
from textwrap import dedent
from typing import Optional

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.collect_experiences_agent.data_extraction_llm._common import clean_string_field
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
    experience_title: Optional[str]
    company: Optional[str]
    location: Optional[str]


class ExtractedDataWithReferences(ExtractedData):
    data_extraction_references: Optional[dict] = None


class _LLMOutput(BaseModel):
    associations: Optional[str]
    experience_details: Optional[ExtractedDataWithReferences]

    class Config:
        """
        Disallow extra fields in the model
        """
        extra = "forbid"


class EntityExtractionTool:

    def __init__(self, logger: logging.Logger):
        self._logger = logger
        self._llm_caller = LLMCaller[_LLMOutput](model_response_type=_LLMOutput)
        self._llm = GeminiGenerativeLLM(
            system_instructions=_SYSTEM_INSTRUCTIONS,
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "max_output_tokens": 3000
                    # Limit the output to 3000 tokens to avoid the "reasoning recursion issues"
                }
            ))

    async def execute(self,
                      *,
                      conversation_history: list[tuple[str, str]],
                      users_last_input: str) -> tuple[ExtractedData | None, list[LLMStats]]:
        prompt = _PROMPT_TEMPLATE.format(
            users_last_input=users_last_input,
            conversation_history=format_conversation_history(conversation_history)
        )

        response_data, llm_stats = await self._llm_caller.call_llm(llm=self._llm,
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
            experience_title=clean_string_field(experience_details.experience_title),
            company=clean_string_field(experience_details.company),
            location=clean_string_field(experience_details.location)
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
    You are an expert who extracts information regarding the work experience of the user from user's statement and conversation history.
    Do not suggest any field, only extract the information!
        
#Extract data instructions
    Make sure you are extracting information about experiences that should be added to the 'experience_details' field' 
    and not information that should be ignored.
    
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
        String value containing the title of the experience.
        `null` if the information was not provided by the user and the user was not explicitly asked for this information yet.
        Use empty string if the user was asked and explicitly chose to not provide this information, or the user don't want us to store the information any more.
        
    ##'company' instructions
        What the company does or name of the company depending on the context.
        Use specific company names (eg: Acme inc) not generic ones (eg: 'company', 'online, 'organization', 'freelance' or 'self') in the output.
        For unpaid work, use the receiver of the work (e.g. "My Family", "Community", etc) but not the generic name.
        String value containing the type, or name of the company, or the receiver of the work.
        Do not insist on the user providing this information or generating ones if they do not provide it. 
        `null` if the information was not provided by the user and the user was not explicitly asked for this information yet.
        Use empty string if the user was asked and explicitly chose to not provide this information, or the user don't want us to store the information any more.
        
     ##'location' instructions 
        The location (e.g City, Region, District) where the job was performed or the company is located any one of them. 
        In case of paid remote work or work from home use (Remote, Home Office etc) as the location.
        For unpaid work, use the receiver's location.
        String value containing the location.
        Do not insist on the user providing this information or generating ones if they do not provide it.
        `null` if the information was not provided by the user and the user was not explicitly asked for this information yet.
        Use empty string if the user was asked and explicitly chose to not provide this information, or the user don't want us to store the information any more.

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
                Constrain the explanation to the data relevant for the fields 'experience_title', 'company' and 'location' 
                Explain where you found the information e.g in '<User's Last Input>'.
                Formatted as a json string.
                Example: ... the user responded in the '<...' to the model's question in '<...' ...
                {{
                    - experience_title_references: 
                    - company_references:
                    - location_references:
                }}
            - experience_title: A title for the experience. Formatted as a json string.
            - company: The name of the company or type. Formatted as a json string.
            - location: The location in which the job was performed. Formatted as a json string.
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
