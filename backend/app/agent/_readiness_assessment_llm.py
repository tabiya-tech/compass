import logging

from textwrap import dedent

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template import sanitize_input
from app.conversation_memory.conversation_memory_types import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, ZERO_TEMPERATURE_GENERATION_CONFIG

_TAGS_TO_FILTER = ["system instructions", "user's last input", "conversation history"]

MIN_RESPONSIBILITIES_FOR_AUTO_LINKING = 5
"""Minimum number of responsibilities required to skip exploratory questioning."""


#TODO: this llm will eventually become the core of the intermediate agent that
# decides whether we have enough information to proceed to linking/ranking
class ReadinessAssessmentResponse(BaseModel):
    """
    Response model for assessing whether enough information has been collected to move on to linking/ranking phase.
    """
    reasoning: str
    """
    Chain of Thought reasoning behind the assessment.
    This acts as a "reasoning" field and should be predicted before the decision.
    """

    user_wants_to_continue: bool
    """
    True if the user wants to continue to the next step (linking/ranking), 
    False if they want to add more responsibilities.
    """

    message: str
    """
    A message to the user, or empty string if no message is needed.
    Used for clarification when the user's response is unclear.
    """

    class Config:
        extra = "forbid"


class _ReadinessAssessmentLLM:
    """
    LLM-based assessment for determining if enough information has been collected 
    to move on to the linking/ranking phase, and for parsing user responses about continuing.
    """

    def __init__(self, logger: logging.Logger):
        self._llm_caller = LLMCaller[ReadinessAssessmentResponse](model_response_type=ReadinessAssessmentResponse)
        self.llm = GeminiGenerativeLLM(
            system_instructions=_ReadinessAssessmentLLM._create_system_instructions(),
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "max_output_tokens": 2000
                }
            ))
        self.logger = logger
    
    @staticmethod
    def has_enough_responsibilities(responsibilities_count: int) -> bool:
        """
        Heuristic check to determine if enough responsibilities have been collected.
        
        Args:
            responsibilities_count: The number of responsibilities collected
            
        Returns:
            True if there are enough responsibilities (>= MIN_RESPONSIBILITIES_FOR_AUTO_LINKING), False otherwise
        """
        return responsibilities_count >= MIN_RESPONSIBILITIES_FOR_AUTO_LINKING

    async def execute(self,
                      *,
                      responsibilities: list[str],
                      responsibilities_count: int,
                      user_input: str,
                      context: ConversationContext) -> tuple[bool, str, list[LLMStats]]:
        """
        Assess whether enough information has been collected and parse user's response about continuing.
        
        Args:
            responsibilities: List of responsibilities collected so far
            responsibilities_count: Number of responsibilities
            user_input: The user's input text (their response to the prompt)
            context: The conversation context
            
        Returns:
            A tuple of (user_wants_to_continue, message, llm_stats)
        """
        llm_output, llm_stats = await self._llm_caller.call_llm(
            llm=self.llm,
            llm_input=_ReadinessAssessmentLLM._create_prompt_template(
                responsibilities=responsibilities,
                responsibilities_count=responsibilities_count,
                user_input=user_input,
                context=context
            ),
            logger=self.logger
        )

        if not llm_output:
            # This may happen if the LLM fails to return a JSON object
            # Instead of completely failing, we log a warning and default to staying in exploring
            self.logger.warning("The LLM did not return any output for readiness assessment")
            return False, "I didn't quite understand. Would you like to continue to the next step with the responsibilities we have, or would you like to add more? Please answer 'yes' to continue or 'no' to add more.", llm_stats

        self.logger.debug("Readiness assessment LLM output: %s", llm_output.model_dump())
        return llm_output.user_wants_to_continue, llm_output.message, llm_stats

    @staticmethod
    def _create_system_instructions() -> str:
        system_instructions_template = dedent("""\
        <System Instructions>
        # Role
            You are an expert at assessing whether enough information has been collected about a work experience 
            and understanding user intent from their responses to questions about continuing to the next step.
        
        # Task
            The user has been asked whether they want to continue to the next step (linking and ranking their skills) 
            or add more responsibilities to their experience description.
            
            Analyze the user's response and determine if they want to continue or add more responsibilities.
            If the response is unclear, provide a clarifying message in the "message" field.
        
        # Response Schema
            Your response must always be a JSON object with the following schema:
            - reasoning: A step-by-step explanation of how you interpreted the user's response and 
                         why you set user_wants_to_continue to the specific value. This should include
                         consideration of the number of responsibilities collected and the context.
                         This field is REQUIRED and must be a non-empty string.
            - user_wants_to_continue: A boolean - true if they want to continue, false if they want to add more.
                                      This field is REQUIRED.
            - message: A message to the user (empty string if no clarification is needed).
                       This field is REQUIRED and must be a string (can be an empty string).
            
            Your response must always be a JSON object with ALL THREE fields: reasoning, user_wants_to_continue, and message.
        </System Instructions>
        """)

        return system_instructions_template

    @staticmethod
    def _create_prompt_template(*,
                                responsibilities: list[str],
                                responsibilities_count: int,
                                user_input: str,
                                context: ConversationContext) -> str:
        """
        Create the prompt template for the readiness assessment.
        """
        responsibilities_text = ""
        if responsibilities:
            responsibilities_text = "\n".join(f"  {i + 1}. {resp}" for i, resp in enumerate(responsibilities))
        else:
            responsibilities_text = "  No responsibilities have been collected yet."

        prompt = dedent("""\
        <Responsibilities Collected>
        {responsibilities_text}
        
        Total responsibilities collected: {responsibilities_count}
        </Responsibilities Collected>
        
        <User's Last Input>
        {user_input}
        </User's Last Input>
        """).format(
            responsibilities_text=responsibilities_text,
            responsibilities_count=responsibilities_count,
            user_input=sanitize_input(user_input.strip(), _TAGS_TO_FILTER)
        )

        return prompt
