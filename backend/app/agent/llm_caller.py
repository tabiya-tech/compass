import logging
import time
from typing import Generic, TypeVar, Type, Tuple

from app.agent.agent_types import AgentInput, AgentType, LLMStats, AgentOutput
from app.agent.llm_response import ModelResponse

from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_manager import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMInput
from common_libs.text_formatters.extract_json import extract_json, ExtractJSONError

# Number of retries to get a JSON object from the model
_MAX_ATTEMPTS = 3

P = TypeVar('P')


class LLMCaller(Generic[P]):
    """
    A class that calls the LLM to generate a response to the user input in a conversation.
    It has the ability to retry multiple times if the LLM fails to respond with a JSON object.
    Additionally, it logs errors it captures the statistics of the LLM calls.
    """

    @staticmethod
    async def call_llm(*,
                       llm: GeminiGenerativeLLM,
                       llm_input: LLMInput | str,
                       logger: logging.Logger,
                       model_response_type: Type[P]
                       ) -> Tuple[P | None, list[LLMStats]]:
        """
        Call the LLM to generate a response of a specific type.
        The method retries multiple times if the LLM fails to respond with a JSON object that is of the expected type.
        :param llm: The LLM to call
        :param llm_input: The input to the LLM
        :param logger: The logger to log messages
        :param model_response_type: The type of the model response. If the LLM fails to respond with a JSON object,
                                    it wll be set to None
        :return: The model response and the statistics of the LLM calls
        """
        llm_stats_list: list[LLMStats] = []
        success = False
        attempt_count = 0
        model_response: P | None = None
        while not success and attempt_count < _MAX_ATTEMPTS:
            attempt_count += 1
            llm_start_time = time.time()
            llm_response = await llm.generate_content(
                llm_input=llm_input
            )
            llm_end_time = time.time()
            llm_stats = LLMStats(prompt_token_count=llm_response.prompt_token_count,
                                 response_token_count=llm_response.response_token_count,
                                 response_time_in_sec=round(llm_end_time - llm_start_time, 2))
            response_text = llm_response.text
            try:
                model_response = extract_json(response_text, model_response_type)
                success = True
            except ExtractJSONError:
                log_message = (f"Attempt {attempt_count} failed to extract JSON "
                               f"from conversation content: '{response_text}")
                llm_stats.error = log_message
                if attempt_count == _MAX_ATTEMPTS:
                    # The agent failed to respond with a JSON object after the last attempt,
                    logger.error(log_message)
                    # And set the response to the model output and hope that the caller can handle it
                else:
                    logger.warning(log_message)
            # Any other exception should be caught and logged
            except Exception as e:  # pylint: disable=broad-except
                logger.error("An error occurred while requesting a response from the model: %s",
                             e, exc_info=True)
                llm_stats.error = str(e)
            finally:
                llm_stats_list.append(llm_stats)

        logger.debug("Model input: %s", llm_input)
        logger.debug("Model output: %s", model_response)
        return model_response, llm_stats_list

    @staticmethod
    async def call_llm_agent(*,
                             llm: GeminiGenerativeLLM,
                             agent_type: AgentType,
                             model_response_instructions: str,
                             user_input: AgentInput,
                             context: ConversationContext,
                             logger: logging.Logger
                             ) -> AgentOutput[P]:
        """
        Call the LLM to generate a response for an agent.
        It uses the conversation context , model response instructions and the user input to format the input to the LLM.
        It expects that the model_response_instructions have been formulated in a way that the model
        can generate a response that matches the ModelResponse[P] type.
        It returns an AgentOutput[P]  that contains the data from the response of the agent.
        The method logs the response time of the agent.
        :param model_response_instructions: The instructions for the model to generate a response
        :param llm:  The LLM to call
        :param agent_type:  The type of the agent
        :param user_input:  The user input
        :param context:  The conversation context
        :param logger:  The logger
        :return:  The agent output
        """
        agent_start_time = time.time()
        if user_input.message == "":
            # If the user input is empty, set it to "(silence)"
            # This is to avoid the agent failing to respond to an empty input
            user_input.message = "(silence)"
        msg = user_input.message.strip()  # Remove leading and trailing whitespaces
        model_response: P | None
        llm_stats_list: list[LLMStats]
        model_response, llm_stats_list = await LLMCaller.call_llm(
            llm=llm,
            llm_input=ConversationHistoryFormatter.format_for_agent_generative_prompt(
                model_response_instructions=model_response_instructions,
                context=context, user_input=msg),
            logger=logger,
            model_response_type=ModelResponse[P]
        )

        # If it was not possible to get a model response, set the response to a default message
        if model_response is None:
            model_response = ModelResponse[P](
                reasoning="Failed to get a response",
                message="I am facing some difficulties right now, could you please repeat what you said?",
                data=None,
                finished=False)

        agent_end_time = time.time()
        response = AgentOutput[P](
            message_for_user=model_response.message,
            finished=model_response.finished,
            reasoning=model_response.reasoning,
            data=model_response.data,
            agent_type=agent_type,
            agent_response_time_in_sec=round(agent_end_time - agent_start_time, 2),
            llm_stats=llm_stats_list)
        return response
