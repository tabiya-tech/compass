import logging

from pydantic import BaseModel
from textwrap import dedent
from typing import Generic, TypeVar


from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.llm_caller import LLMCaller
from app.conversation_memory.conversation_memory_manager import \
    ConversationContext
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG

P = TypeVar('P')

class InferOccupationModelResponse(BaseModel, Generic[P]):
    """
    Model for the response of LLM for the InferOccupationAgent.
    """
    reasoning: str
    """Chain of Thought reasoning behind the response of the LLM"""
    needs_more_info: bool
    """A boolean flag to signal the need of more information from the user."""
    response: str
    """String request of more information to the user."""
    finished: bool
    """Flag indicating whether the LLM has finished its task"""
    correct_occupation: str
    """a string containing the correct occupation among the options if finished is set to True. Empty string otherwise."""

OCCUPATION_INFERENCE_SYSTEM_PROMPT = dedent("""You work for an employment agency helping users outline their previous experiences.

**Main Task**: You are tasked with understanding the proper definition of one of the user's occupations from the entire conversation history. 
**Available Data**: You are given a list of options between which you can choose. If none of the options apply, you can ask for more options in the appropriate field.
**Address the user**: In case the context does not provide enough information, you can ask additional questions to the user to differentiate between the options.
**Tone**: Maintain a concise and professional tone, while being polite and empathetic.

Your response must always be a JSON object with the following schema:

        - reasoning: A string explanation of the decisions taken regarding the following parameters.  
        - needs_more_info: A boolean flag to signal that you need more information from the user.
            Set to True if you need more information. Set to False if you are ready.
        - response: A string request of more information to the user in case needs_more_info is set to True. Empty string otherwise.
        - finished: A boolean flag to signal that the task is finished and a single correct occupation among the options has been found.
            Set True if the occupation has been found. False otherwise.
        - correct_occupation: a string containing the correct occupation among the options if finished is set to True. Empty string otherwise.""")


def get_prompt_for_occupation_inference(
        experience_entity: ExperienceEntity,
        conversation_context: ConversationContext,
        message: str,
):
    """Writes a prompt to infer the correct occupation for an ExperienceEntity"""
    esco_occupation_string = "\n".join(
        [entity.preferredLabel for entity in experience_entity.esco_occupations]
    )
    conversation_history_string = ConversationHistoryFormatter.format_to_string(conversation_context, message)
    return f"""## Occupation of interest: 
{experience_entity.experience_title}
## ESCO Occupation options: 
{esco_occupation_string}
## Conversation history:
{conversation_history_string}
"""


class InferLLMCaller(LLMCaller):
    """LLMCaller class to find the correct
    occupation among a few options.
    """
    def __init__(self):
        self._experience: ExperienceEntity | None = None
        
    def set_experience(self, experience: ExperienceEntity):
        """Sets the experience of the agent

        Args:
            experience (ExperienceEntity): experience to be
                inferred.
        """
        self._experience = experience

    async def execute(
            self,
            agent_input: AgentInput,
            conversation_context: ConversationContext,
            config: LLMConfig = LLMConfig(
                generation_config= JSON_GENERATION_CONFIG
            ),
    ) -> AgentOutput:
        """Returns the output of the inference once the experience entity
        is enriched with the contextualized title and the esco occupations.

        Returns:
            The model response and the statistics of the LLM calls.
            The response has the following keys:
            - reasoning: A string explanation of the decisions taken regarding the following parameters.  
            - needs_more_info: A boolean flag to signal that the model needs more information from the user.
            - response: A string request of more information to the user in case needs_more_info is set to True. Empty string otherwise.
            - finished: A boolean flag to signal that the task is finished and a single correct occupation among the options has been found.
            - correct_occupation: a string containing the correct occupation among the options if finished is set to True. Empty string otherwise.
        """
        message = agent_input.message
        if not self._experience.esco_occupations:
            raise ValueError("Experience should be linked to ESCO occupations before return_response is called.")
        llm = GeminiGenerativeLLM(
            system_instructions=OCCUPATION_INFERENCE_SYSTEM_PROMPT, config=config
        )
        inference_prompt = get_prompt_for_occupation_inference(
            self._experience, conversation_context, message
        )
        response, stats = await super().call_llm(
            llm=llm,
            llm_input=inference_prompt,
            logger=logging.Logger("llm_response"),
            model_response_type=InferOccupationModelResponse
        )
        return response, stats
