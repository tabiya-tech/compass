import logging
import time
from typing import Generic, TypeVar, Type, Tuple

from google.cloud.aiplatform_v1 import GenerationConfig
from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMInput
from common_libs.text_formatters.extract_json import extract_json, ExtractJSONError

# Number of retries to get a JSON object from the model
_MAX_ATTEMPTS = 3

RESPONSE_T = TypeVar('RESPONSE_T', bound=BaseModel)


class LLMCaller(Generic[RESPONSE_T]):
    """
    A class that calls the LLM to generate a response to an input.
    It can retry multiple times if the LLM fails to respond with a JSON object that
    complies with the model_response_type.
    Additionally, it logs errors it captures the statistics of the LLM calls.
    """

    def __init__(self, model_response_type: Type[RESPONSE_T]):
        self._model_response_type: Type[RESPONSE_T] = model_response_type

    async def call_llm(self, *,
                       llm: GeminiGenerativeLLM,
                       llm_input: LLMInput | str,
                       logger: logging.Logger
                       ) -> Tuple[RESPONSE_T | None, list[LLMStats]]:
        """
        Call the LLM to generate a response of a specific type.
        The method retries multiple times if the LLM fails to respond with a JSON object that is of the expected type.
        :param llm: The LLM to call
        :param llm_input: The input to the LLM
        :param logger: The logger to log messages
        :return: The model response and the statistics of the LLM calls
        """
        llm_stats_list: list[LLMStats] = []
        success = False
        attempt_count = 0
        model_response: RESPONSE_T | None = None
        # This is a hack as we do not have access to the model config any more
        generation_config: GenerationConfig = llm._model._generation_config._raw_generation_config
        original_frequency_penalty = generation_config.frequency_penalty
        original_temperature = generation_config.temperature  # usually for json we use 0.0
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
                model_response = extract_json(response_text, self._model_response_type)
                success = True
            except ExtractJSONError as e:
                log_message = f"Attempt {attempt_count} failed to extract JSON caused by: {e}"
                llm_stats.error = log_message
                if attempt_count == _MAX_ATTEMPTS:
                    # The agent failed to respond with a JSON object after the last attempt,
                    logger.error(log_message)
                    # And set the response to the model output and hope that the caller can handle it
                else:
                    logger.warning(log_message)
                    if llm_stats.response_token_count == generation_config.max_output_tokens:
                        # Most-likely we run into a "repetition trap". This happens often with prompts that have Chain Of Thought reasoning tasks.
                        # We will increase the frequency_penalty and the temperature and return the model to avoid repetition.
                        # However, higher frequency_penalty might cause the model to penalize punctuation and JSON format characters,
                        # and in combination with the higher the temperature will most likely result in an invalid JSON.
                        # Therefore, there is no guarantee that the result is a valid JSON.
                        # However, we must perform this process to get unstuck from the repetition trap as experiments have
                        # shown that just rerunning the model will not solve the problem on its own, but changing the parameters will.
                        generation_config.frequency_penalty += 0.1
                        if generation_config.frequency_penalty > 1.0:
                            generation_config.frequency_penalty = 1.0
                        generation_config.temperature += 0.1
                        if generation_config.temperature > 1.0:
                            generation_config.temperature = 1.0

                        logger.warning("The model reached the maximum number of tokens %s.\n"
                                       "To escape the repetition trap, we increased the frequency_penalty to %s\n"
                                       "To escape the repetition trap, we increased the temperature to %s",
                                       generation_config.max_output_tokens,
                                       generation_config.frequency_penalty,
                                       generation_config.temperature)

            # Any other exception should be caught and logged
            except Exception as e:  # pylint: disable=broad-except
                logger.error("An error occurred while requesting a response from the model: %s",
                             e, exc_info=True)
                llm_stats.error = str(e)
            finally:
                llm_stats_list.append(llm_stats)

        # Reset the frequency_penalty to the original value
        generation_config.frequency_penalty = original_frequency_penalty
        # Reset the temperature to the original value
        generation_config.temperature = original_temperature

        logger.debug("Model input: %s", llm_input)
        logger.debug("Model output: %s", model_response)
        return model_response, llm_stats_list
