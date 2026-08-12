import logging
import time
from typing import Generic, TypeVar, Type, Tuple

from google.cloud.aiplatform_v1 import GenerationConfig
from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMInput, llm_input_to_traceable
from common_libs.observability.tracing import record_score, traced_observation, update_observation
from common_libs.text_formatters.extract_json import extract_json, ExtractJSONError

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
        # One observation per logical call, with the per-attempt generations nested underneath it.
        # This is where the retry/JSON-repair behaviour becomes visible: today it only surfaces as
        # WARNING logs, so "how often do we hit the repetition trap, and on which prompts" is a
        # log-grep rather than a dashboard.
        with traced_observation(
                name=f"llm_caller.{self._model_response_type.__name__}",
                as_type="chain",
                input=llm_input_to_traceable(llm_input),
                metadata={"expected_response_type": self._model_response_type.__name__},
        ) as call_observation:
            model_response, llm_stats_list = await self._call_llm_with_retries(
                llm=llm, llm_input=llm_input, logger=logger,
            )

            failed_attempts = [stats for stats in llm_stats_list if stats.error]
            update_observation(
                call_observation,
                output=model_response,
                metadata={
                    "expected_response_type": self._model_response_type.__name__,
                    "attempts": len(llm_stats_list),
                    "failed_attempts": len(failed_attempts),
                },
                level="WARNING" if failed_attempts else None,
                status_message=failed_attempts[-1].error if failed_attempts else None,
            )
            if failed_attempts:
                # Only scored on failure: scores are billable units, and a score per successful call
                # would roughly double the volume for no signal.
                record_score(
                    name="llm_call_failed_attempts",
                    value=len(failed_attempts),
                    comment=failed_attempts[-1].error,
                )

            return model_response, llm_stats_list

    async def _call_llm_with_retries(self, *,
                                     llm: GeminiGenerativeLLM,
                                     llm_input: LLMInput | str,
                                     logger: logging.Logger,
                                     ) -> Tuple[RESPONSE_T | None, list[LLMStats]]:
        """
        Run the retry/JSON-repair loop. See `call_llm`, which wraps this with observability.
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
            response_text = llm_response.text
            try:
                model_response = extract_json(response_text, self._model_response_type)
                success = True
            except ExtractJSONError as e:
                log_message = f"Attempt {attempt_count} failed to extract JSON caused by: {e}"
                llm_stats.error = log_message
                logger.warning("Raw LLM response text (first 500 chars): %s", response_text[:500] if response_text else "None")
                logger.warning("Raw LLM response text length: %d characters", len(response_text) if response_text else 0)
                logger.warning("Response token count: %d, Max output tokens: %d", llm_stats.response_token_count, generation_config.max_output_tokens)
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
                        record_score(
                            name="llm_repetition_trap",
                            value=1,
                            comment=f"attempt {attempt_count}: frequency_penalty raised to {generation_config.frequency_penalty}, "
                                    f"temperature raised to {generation_config.temperature}",
                        )
            finally:
                llm_stats_list.append(llm_stats)

        # Reset the frequency_penalty to the original value
        generation_config.frequency_penalty = original_frequency_penalty
        # Reset the temperature to the original value
        generation_config.temperature = original_temperature

        logger.debug("Model input: %s", llm_input)
        logger.debug("Model output: %s", model_response)
        return model_response, llm_stats_list
