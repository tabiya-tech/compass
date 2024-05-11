import logging
from abc import ABC, abstractmethod

from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.prompt_reponse_template import ModelResponse
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_manager import ConversationContext
from common_libs.llm.gemini import GeminiGenerativeLLM, LLMConfig, GeminiStatelessChatLLM, \
    ZERO_TEMPERATURE_GENERATION_CONFIG
from common_libs.text_formatters.extract_json import extract_json, ExtractJSONError

# Number of retries to get a JSON object from the model
_MAX_RETRIES = 3


class Agent(ABC):
    """
    An abstract class for an agent.
    """

    @abstractmethod
    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        """
        Execute the agent's task given the user input and the conversation history
        :param user_input: The user input
        :param context: The conversation context
        :return: The agent output
        """
        raise NotImplementedError()


class SimpleLLMAgent(Agent):
    """
    This is a simple agent that uses the GeminiGenerativeLLM to respond to the user input in a conversation.
    """

    def __init__(self, *, agent_type: AgentType, system_instructions: str,
                 config: LLMConfig = LLMConfig(generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG)):
        self._agent_type = agent_type
        self._system_instructions = system_instructions
        # We should pass the system instructions to the LLM
        # Passing the system instructions as a user part manually in the content,
        # does not seem to work well with the model as it does follow the instructions correctly.
        self._llm = GeminiGenerativeLLM(system_instructions=system_instructions, config=config)
        self._logger = logging.getLogger(self.__class__.__name__)

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        if user_input.message == "":
            # If the user input is empty, set it to "(silence)"
            # This is to avoid the agent failing to respond to an empty input
            user_input.message = "(silence)"
        msg = user_input.message.strip()  # Remove leading and trailing whitespaces
        success = False
        retry_count = 0
        model_response: ModelResponse | None = None
        while not success and retry_count < _MAX_RETRIES:
            retry_count += 1
            llm_response = await self._llm.generate_content_async(
                contents=ConversationHistoryFormatter.format_for_agent_generative_prompt(context, msg)
            )
            try:
                model_response = extract_json(llm_response, ModelResponse)
                success = True
            except ExtractJSONError:
                log_message = "Failed to extract JSON from conversation content '%s'"
                if retry_count == 0:
                    # If the agent failed to respond with a JSON object after the last retry,
                    # log the error
                    self._logger.error(log_message, llm_response)
                else:
                    self._logger.warning(log_message, llm_response)
                # If the agent failed to respond with a JSON object, set the response to the model output
                # and hope that the conversation can continue
                model_response = ModelResponse(message=str(llm_response), finished=False)

        if model_response is None:
            # If the model response is None, set the response to the model output
            # and hope that the conversation can continue
            model_response = ModelResponse(message=str("Model response is None"), finished=False)

        self._logger.debug("Model input: %s", user_input.message)
        self._logger.debug("Model output: %s", model_response)
        response = AgentOutput(message_for_user=model_response.message,
                               finished=model_response.finished,
                               agent_type=self._agent_type)
        return response


class _SimpleStatelessChatLLMAgent(Agent):
    """
    This is a simple agent that uses the GeminiStatelessChatLLM to respond to the user input in a conversation.
    It seems that it performs equally well as the SimpleLLMAgent, but has some internal overhead as it
    uses an internal chat session to manage the conversation history in a similar way as thew ConversationMemoryManager.
    The code is kept here for reference, but it is not used in the current implementation.
    TODO: Remove this class in the future.   
    """

    def __init__(self, *, agent_type: AgentType, system_instructions: str, config: LLMConfig = LLMConfig()):
        self._agent_type = agent_type
        self._llm = GeminiStatelessChatLLM(system_instructions=system_instructions, config=config)
        self._logger = logging.getLogger(self.__class__.__name__)

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        if user_input.message == "":
            # If the user input is empty, set it to "(silence)"
            # This is to avoid the agent failing to respond to an empty input
            user_input.message = "(silence)"
        success = False
        retry_count = 3
        while not success and retry_count > 0:
            msg = user_input.message
            if retry_count < 3:
                # If the agent failed to respond with a JSON object,
                # remind that the response should be a JSON object
                # This is helpful, when the model "forgets" it's instructions because the
                # conversation is too long.
                msg += "\n, also remember your instructions and that you should respond with a JSON object."
            retry_count -= 1
            llm_response = await self._llm.send_message_async(
                history=ConversationHistoryFormatter.format_history_for_agent_generative_prompt(context),
                message=msg)
            try:
                last: ModelResponse = extract_json(llm_response, ModelResponse)
                success = True
            except ExtractJSONError:
                self._logger.warning("Error extracting JSON from conversation content '%s'", llm_response,
                                     exc_info=False)  # no need to log the stack trace
                last = ModelResponse(message=str(llm_response), finished=False)

        self._logger.debug("Model output: %s", last)
        response = AgentOutput(message_for_user=last.message,
                               finished=last.finished,
                               agent_type=self._agent_type)
        return response
