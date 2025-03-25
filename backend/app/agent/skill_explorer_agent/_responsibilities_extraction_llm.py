import logging

from textwrap import dedent
from typing import Optional

from pydantic import Field

from app.agent.agent_types import LLMStats
from app.agent.experience.experience_entity import ResponsibilitiesData
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template import sanitize_input
from app.conversation_memory.conversation_memory_types import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, ZERO_TEMPERATURE_GENERATION_CONFIG

_TAGS_TO_FILTER = ["system instructions", "user's last input", "conversation history"]


class ResponsibilitiesExtractionResponse(ResponsibilitiesData):
    extracted_entities: list[str] = Field(default_factory=list)
    """
    The extracted entities from the user's input.
    This acts as a "reasoning" field and should be predicted before the classes.
    """

    irrelevant_entities: Optional[list[str]] = Field(default_factory=list)
    """
    The irrelevant entities from the user's input.
    """


class _ResponsibilitiesExtractionLLM:
    def __init__(self, logger: logging.Logger):
        self._llm_caller = LLMCaller[ResponsibilitiesExtractionResponse](model_response_type=ResponsibilitiesExtractionResponse)
        self.llm = GeminiGenerativeLLM(
            system_instructions=_ResponsibilitiesExtractionLLM._create_extraction_system_instructions(),
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "max_output_tokens": 3000  # Limit the output to 3000 tokens to avoid the "reasoning recursion issues"
                }
            ))
        self.logger = logger

    async def execute(self, *, last_user_input: str, context: ConversationContext) \
            -> tuple[ResponsibilitiesData, list[LLMStats]]:
        """
        Named entity extraction and classification logic for the skill explorer agent.
        Extracts named entities from the user's input and classifies them into responsibilities, non-responsibilities and other people's responsibilities.
        It does not consider the user's input as a conversation history, rather it treats it as a single input.
        The user input should be "contextualized" by the conversation context before calling.
        """

        llm_output, llm_stats = await self._llm_caller.call_llm(llm=self.llm,
                                                                llm_input=_ResponsibilitiesExtractionLLM._extraction_prompt_template(
                                                                    context=context, last_user_input=last_user_input),
                                                                logger=self.logger)
        if not llm_output:
            # This may happen if the LLM fails to return a JSON object
            # Instead of completely failing, we log a warning and return the input title
            self.logger.warning("The LLM did not return any output and the responsibilities will be empty")
            return ResponsibilitiesData(responsibilities=[], non_responsibilities=[], other_peoples_responsibilities=[]), llm_stats

        self.logger.debug("LLM output: %s", llm_output.model_dump())
        return ResponsibilitiesData(
            responsibilities=llm_output.responsibilities,
            non_responsibilities=llm_output.non_responsibilities,
            other_peoples_responsibilities=llm_output.other_peoples_responsibilities
        ), llm_stats

    @staticmethod
    def _create_extraction_system_instructions() -> str:
        system_instructions_template = dedent("""\
        <System Instructions>
        # Role
            You are an expert who extracts name entities for the user's experience and classifies them.
        
        # Name Entity Extraction instructions         
             Extract the following Named Entities:
                 - responsibilities: What is part of a job or role.
                 - skills, competencies: What a person is capable of doing.
                 - duties, tasks: What a person is expected to do.
                 - actions: What actions a person takes.
                 - behaviour: How someone behaves.
                 - activities: What a person does.
                 - knowledge: What a person knows.
            
            A Named Entity Consists of  the following parts:
                - subject
                - verb
                - object
                - modifiers
            
            A single sentence can contain multiple entities. Entities can be explicit or implicit.
            Review carefully <User's Last Input> to ensure you extract all entities including the once that are implicit.
            
            Examples of Named Entities:
                "He develops software"
                extracted_entities: ["He develops software"]
            
                "He tests the software that i build"
                extracted_entities: ["He tests the software", "i build the software"]
            
            
            You will collect and place the entities into the 'extracted_entities' list of output.
        
        # Classification instructions
            Classify the named entities into one of the following four classes:
                - other_peoples_responsibilities: What other people are responsible for.
                - non_responsibilities: What the user is not responsible for.
                - responsibilities: What the user is responsible for.
                - irrelevant_entities: When the named entity is irrelevant to the user's experience or it refers to something that is not part of the user's experience.
            
            There are two criteria that either one can be met for a named entity to be in non_responsibilities:
                1. The named entity must be something that the user is not responsible for,
                 does not possess, does not do, does not perform, does not take, does not exhibit, does not engage in, or does not know.
                 OR
                2. None of the subjects or subject pronouns of the named entity are referring to the user.
            
            There are two criteria and both must be met for a named entity to be in responsibilities:
                1. The named entity must be something that the user is directly responsible for,
                 possesses, does, performs, takes, exhibits, engages in, or knows.
                 AND
                2. At least one of the subjects or the subject pronouns of the named entity must be referring to the user.
            
            The user is referred to in first person in <User's Last Input>.
            
            
            Examples of Classification:
                "He tests the software that I build, but I do not sell, that he designs when the weather is nice"
                    responsibilities: ["i build the software"]
                    other_peoples_responsibilities: ["He tests the software", "He designs the software"]
                    non_responsibilities: ["I do not sell the software"]
                    irrelevant_entities: ["The weather is nice"]
                "He and they and I develop software that they designed and we test, but I do not deploy"
                    responsibilities: ["I develop software", "I test the software"]
                    other_peoples_responsibilities: ["He develops software", "They develop software", "They design the software", "He tests the software"]
                    non_responsibilities: ["I do not deploy the software"]            
                    
        # JSON Output instructions
            Your response must always be a JSON object with the following schema:
            - extracted_entities: list of JSON strings, can be empty
            - other_peoples_responsibilities: list of JSON strings, can be empty
            - non_responsibilities: list of JSON strings, can be empty
            - responsibilities: list of JSON strings, can be empty
            - irrelevant_entities: list of JSON strings, can be empty
            
            Your response must always be a JSON object with the schema above
        </System Instructions>
        """)

        return system_instructions_template

    @staticmethod
    def _extraction_prompt_template(context: ConversationContext, last_user_input: str) -> str:
        return dedent("""\
                <User's Last Input>
                {last_user_input}
                </User's Last Input>
                """).format(last_user_input=sanitize_input(last_user_input.strip(), _TAGS_TO_FILTER))
