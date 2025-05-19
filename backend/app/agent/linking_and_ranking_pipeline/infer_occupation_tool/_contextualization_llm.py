import json
import logging
from textwrap import dedent
from typing import Optional

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.experience.work_type import WorkType
from app.agent.llm_caller import LLMCaller
from app.agent.penalty import get_penalty_for_multiple_errors
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.countries import Country, get_country_glossary
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, get_config_variation, JSON_GENERATION_CONFIG
from common_libs.retry import Retry


class ContextualizationLLMResponse(BaseModel):
    contextual_titles: list[str]
    llm_stats: list[LLMStats]


class _ContextualizationLLMOutput(BaseModel):
    reasoning: Optional[str]
    contextual_titles: list[str]


def _get_system_instructions(country_of_interest: Country, number_of_titles: int):
    glossary_template = dedent("""\
    # Glossary
        In addition to the above, you can use the following glossary to help you infer the context:
            {glossary}   
    """)
    glossary = get_country_glossary(country_of_interest)
    glossary_str = ""
    if glossary:
        glossary_str = replace_placeholders_with_indent(glossary_template, glossary=glossary)

    system_instructions_template = dedent("""\
        <System Instructions>
        You are an expert in mapping job titles from {country_of_interest} to European standards. 
        You are given a job title described within the context of {country_of_interest} and it includes specific terminology from that country. 
        Additionally, you are given the employer name, employment type and the responsibilities associated with the job title. 
        Your task is to return {number_of_titles} variations of a job title that reflects the employment type and the given responsibilities, aligns with European standards,
        and does not use any terminology specific to {country_of_interest}. The titles should be formulated in such a way that they reflect the input components 
        and these components can be inferred from them.
        
        #Input Structure
            The input structure is composed of: 
            'Job Title': The job title in the context of {country_of_interest}.
            'Employer Name' : The name of the employer.
            'Employment Type': The type of employment.
            'Responsibilities': A list of responsibilities/activities/skills/behaviour that we know about the job.
            'Number of titles': The number of job title to return.
            You should use the above information only to infer the context and you shouldn't return it as output. 
        {glossary}
        #JSON Output instructions
            Your response must always be a JSON object with the following schema:
            {
                "reasoning": Why you chose to return the specific title and how it aligns with the input,
                "contextual_titles": The titles as a list of json strings
            }
        </System Instructions>
        """)
    return replace_placeholders_with_indent(system_instructions_template,
                                            country_of_interest=country_of_interest.value,
                                            work_type_names=", ".join([work_type.name for work_type in WorkType]),
                                            glossary=glossary_str,
                                            number_of_titles=f"{number_of_titles}")


def _get_prompt(*,
                experience_title: str,
                company: Optional[str] = None,
                work_type: WorkType,
                responsibilities: list[str],
                number_of_titles: int
                ):
    return dedent(""" \
        <Input>
            'Job Title': {experience_title}
            'Employer Name': {company}
            'Employment Type': {work_type}
            'Responsibilities': {responsibilities}
            'Number of titles': {number_of_titles}
        </Input>    
        """).format(
        experience_title=experience_title,
        company=company if company else "Unknown",
        work_type=WorkType.work_type_long(work_type) if work_type else "Unknown",
        responsibilities=json.dumps(responsibilities),
        number_of_titles=f"{number_of_titles}"
    )


class _ContextualizationLLM:
    def __init__(self, *,
                 country_of_interest: Country,
                 logger: logging.Logger):
        if not country_of_interest:
            raise ValueError("Country of interest needs to be set.")

        self._country_of_interest = country_of_interest
        self._llm_caller: LLMCaller[_ContextualizationLLMOutput] = LLMCaller[_ContextualizationLLMOutput](
            model_response_type=_ContextualizationLLMOutput)
        self._logger = logger

    async def execute(
            self, *,
            experience_title: str,
            company: Optional[str] = None,
            work_type: WorkType,
            responsibilities: list[str],
            number_of_titles: int = 5
    ) -> ContextualizationLLMResponse:
        """
        Returns a list of job titles aligned with the input attributes,
        and avoids using terminology specific to the country of interest.

        Handles penalty based retries

        :returns: ContextualizationLLMResponse -> list of contextual titles
        """

        async def _callback(attempt: int, max_retries: int) -> tuple[
            ContextualizationLLMResponse, float, BaseException | None]:
            # Call the LLM to contextualize the job titles

            # Add some temperature and `top_p` variation to prompt the LLM to return different results on each retry.
            # Exponentially increase the temperature and `top_p` to avoid the LLM to return the same result every time.

            temperature_config = get_config_variation(start_temperature=0.0, end_temperature=1,
                                                      start_top_p=0.8, end_top_p=1,
                                                      attempt=attempt, max_retries=max_retries)

            llm = self._get_llm(number_of_titles=number_of_titles, temperature_config=temperature_config)
            self._logger.debug("Calling LLM with temperature: %s, top_p: %s",
                               temperature_config["temperature"],
                               temperature_config["top_p"])

            return await  self._internal_execute(
                llm=llm,
                experience_title=experience_title,
                company=company,
                work_type=work_type,
                responsibilities=responsibilities,
                number_of_titles=number_of_titles
            )

        result, _result_penalty, _error = await Retry[ContextualizationLLMResponse].call_with_penalty(
            callback=_callback, logger=self._logger)
        return result

    def _get_llm(self, number_of_titles: int, temperature_config: dict) -> GeminiGenerativeLLM:
        return GeminiGenerativeLLM(
            system_instructions=_get_system_instructions(self._country_of_interest, number_of_titles),
            config=LLMConfig(generation_config=temperature_config | JSON_GENERATION_CONFIG)
        )

    async def _internal_execute(
            self, *,
            llm: GeminiGenerativeLLM,
            experience_title: str,
            company: Optional[str] = None,
            work_type: WorkType,
            responsibilities: list[str],
            number_of_titles: int = 5
    ) -> tuple[ContextualizationLLMResponse, float, BaseException | None]:
        prompt = _get_prompt(
            experience_title=experience_title,
            company=company,
            work_type=work_type,
            responsibilities=responsibilities,
            number_of_titles=number_of_titles
        )

        llm_response, llm_stats = await self._llm_caller.call_llm(
            llm=llm,
            llm_input=prompt,
            logger=self._logger
        )

        if not llm_response:
            # This may happen if the LLM fails to return a JSON object
            # Instead of completely failing, we log a warning and return the input title.
            self._logger.warning(
                "The LLM did not return any output and the contextual titles will be the same as the input title")
            contextual_titles = []
        else:
            # strip the contextual titles from leading and trailing whitespaces and
            contextual_titles = [
                title.strip(' \'"')
                for title in llm_response.contextual_titles
                if title.strip(' \'"')
            ]
            if self._logger.isEnabledFor(logging.INFO):
                self._logger.info("ContextualizationLLM inferred contextual titles: '%s' reasoning: '%s' "
                                  "for the input: experience_title: '%s', company: '%s', work_type: '%s', responsibilities: %s",
                                  json.dumps(contextual_titles), llm_response.reasoning, experience_title, company,
                                  work_type, json.dumps(responsibilities))

        # Calculate the penalty of the responses:-

        # Penalty levels, the higher the level, the more severe the penalty.
        _result_contextual_titles_mismatch_penalty_level = 0

        _result_penalty = 0.0
        _raised_error = None

        if len(contextual_titles) != number_of_titles:
            # If the number of contextual titles is not  equal to the requested number of titles,
            # so the error is the diff between the two absolute values. Weather the diff is positive or negative.
            # If the diff is greater than the number of titles, get_penalty_for_multiple_errors will return the max
            # penalty for the level.
            actual_errors_counted = abs(len(contextual_titles) - number_of_titles)

            _result_penalty = get_penalty_for_multiple_errors(level=_result_contextual_titles_mismatch_penalty_level,
                                                              actual_errors_counted=actual_errors_counted,
                                                              max_number_of_errors_expected=number_of_titles)

            _raised_error = ValueError(
                f"The LLM returned {len(contextual_titles)} contextual titles instead of the requested {number_of_titles}")

        if self._logger.isEnabledFor(logging.WARNING):
            self._logger.warning(
                "The LLM returned %d contextual titles instead of the requested %d. The returned titles are: %s",
                len(contextual_titles), number_of_titles, json.dumps(contextual_titles))

        return ContextualizationLLMResponse(
            contextual_titles=contextual_titles,
            llm_stats=llm_stats
        ), _result_penalty, _raised_error
