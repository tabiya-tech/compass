import logging
import time
from typing import Generic, TypeVar, Type, Tuple

from google.cloud.aiplatform_v1 import GenerationConfig
from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMInput
from common_libs.text_formatters.extract_json import extract_json, ExtractJSONError
from app.context_vars import llm_call_duration_ms_ctx_var

# retries to call the LLM, if it fails to respond or with a valid JSON object.
_MAX_ATTEMPTS = 3

# Maximum values for generation parameters
_MAX_FREQUENCY_PENALTY = 1.0
_MAX_TEMPERATURE = 1.0

# Increment step for adjusting generation parameters
_PENALTY_INCREMENT = 0.1


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
        Call the LLM to generate a specific response.
        The method retries multiple times if the LLM fails to respond with a JSON object that is of the expected type.
        It never raises an exception, but it logs errors and captures the statistics of the LLM calls.
        If all attempts fail, it returns None and the statistics of the LLM calls.

        :param llm: The LLM to call
        :param llm_input: The input to the LLM
        :param logger: The logger to log messages.

        :return: The model response and the statistics of the LLM calls.
        """

        llm_stats_list: list[LLMStats] = []
        success = False
        attempt_count = 0
        model_response: RESPONSE_T | None = None

        # This is a hack as we do not have access to the model config any more.
        generation_config: GenerationConfig = llm._model._generation_config._raw_generation_config
        original_frequency_penalty = generation_config.frequency_penalty
        original_temperature = generation_config.temperature  # usually for json we use 0.0

        while not success and attempt_count < _MAX_ATTEMPTS:
            attempt_count += 1
            llm_start_time = time.time()

            if attempt_count > 1:
                logger.info(f"Retrying to call LLM. attempt: {attempt_count}")

            try:
                # Call the LLM to generate content.
                llm_response = await llm.generate_content(
                    llm_input=llm_input
                )
            except Exception as e:
                # If for some reason, the LLM fails to call, we log the error and continue to the next attempt.
                # Examples of such errors are ResponseValidationError, or NetworkError.

                log_message = f"Attempt {attempt_count} failed to call the LLM caused by: {e}"
                llm_stats = LLMStats(
                    error=log_message,
                    prompt_token_count=0,
                    response_token_count=0,  # No response token
                    response_time_in_sec=round(time.time() - llm_start_time, 2)
                )
                logger.exception(e)
                llm_stats_list.append(llm_stats)
                continue  # Continue to the next attempt if the LLM call failed.

            llm_end_time = time.time()
            llm_stats = LLMStats(prompt_token_count=llm_response.prompt_token_count,
                                 response_token_count=llm_response.response_token_count,
                                 response_time_in_sec=round(llm_end_time - llm_start_time, 2))
            
            # Set LLM duration in context for observability logging
            duration_ms = round((llm_end_time - llm_start_time) * 1000, 2)
            llm_call_duration_ms_ctx_var.set(duration_ms)
            logger.info("LLM call completed")
            
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
                        generation_config.frequency_penalty += _PENALTY_INCREMENT
                        if generation_config.frequency_penalty > _MAX_FREQUENCY_PENALTY:
                            generation_config.frequency_penalty = _MAX_FREQUENCY_PENALTY

                        generation_config.temperature += _PENALTY_INCREMENT
                        if generation_config.temperature > _MAX_TEMPERATURE:
                            generation_config.temperature = _MAX_TEMPERATURE

                        logger.warning("The model reached the maximum number of tokens %s.\n"
                                       "To escape the repetition trap, we increased the frequency_penalty to %s\n"
                                       "To escape the repetition trap, we increased the temperature to %s",
                                       generation_config.max_output_tokens,
                                       generation_config.frequency_penalty,
                                       generation_config.temperature)
            finally:
                llm_stats_list.append(llm_stats)

        # Reset the frequency_penalty to the original value
        generation_config.frequency_penalty = original_frequency_penalty
        # Reset the temperature to the original value
        generation_config.temperature = original_temperature
        
        # Note: We intentionally do NOT reset llm_call_duration_ms_ctx_var here.
        # The duration should remain set so that observability logs in calling code
        # can capture the actual LLM call duration. It will be overwritten by the
        # next LLM call or remain at its default value of -1 if no call is made.

        logger.debug("Model input: %s", llm_input)
        logger.debug("Model output: %s", model_response)
        return model_response, llm_stats_list
