import json
import logging
from typing import Optional

from textwrap import dedent

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.experience.work_type import WorkType, WORK_TYPE_DEFINITIONS_FOR_PROMPT
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.countries import Country, get_country_glossary
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, ZERO_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG


class ContextualizationLLMResponse(BaseModel):
    contextual_title: str
    llm_stats: list[LLMStats]


class _ContextualizationLLMOutput(BaseModel):
    reasoning: Optional[str]
    contextual_title: str


def get_system_prompt_for_contextual_title(country_of_interest: Country):
    """Writes a prompt to find the contextual title from the attributes
    of an ExperienceEntity
    """

    glossary_template = dedent("""\
    # Glossary
        In addition to the above, you can use the following glossary to help you infer the context:
            {glossary}   
    """)
    glossary = get_country_glossary(country_of_interest)
    glossary_str = ""
    if glossary:
        glossary_str = replace_placeholders_with_indent(glossary_template, glossary=glossary)

    system_prompt_template = dedent("""\
        <System Instructions>
        You are an expert in mapping job titles from {country_of_interest} to European standards. 
        You are given a job title described within the context of {country_of_interest} and  it includes specific terminology from that country. 
        Additionally, you are given the employer name, employment type and the responsibilities associated with the job title. 
        Your task is to return a job title that reflects the employment type and the given responsibilities, aligns with European standards,
        and does not use any terminology specific to {country_of_interest}. The title should be formulated in such a way that the input components 
        are reflected in the title and can be inferred from it. 
        
        #Input Structure
            The input structure is composed of: 
            'Job Title': The job title in the context of {country_of_interest},
            'Employer Name' : The name of the employer,
            'Employment Type': The type of employment that has one of the following values 'None', 
                    {work_type_names}.
                    {work_type_definitions}  
            'Responsibilities': A list of responsibilities/activities/skills/behaviour that we know about the job.
            You should use the above information only to infer the context and you shouldn't return it as output. 
        {glossary}
        #JSON Output instructions
            Your response must always be a JSON object with the following schema:
            {
                "reasoning": Why you chose to return the specific title and how it aligns with the input
                "contextual_title": The returned job title as a json string
            }
        </System Instructions>
        """)
    return replace_placeholders_with_indent(system_prompt_template,
                                            country_of_interest=country_of_interest.value,
                                            work_type_names=", ".join([work_type.name for work_type in WorkType]),
                                            work_type_definitions=WORK_TYPE_DEFINITIONS_FOR_PROMPT,
                                            glossary=glossary_str)


def get_request_prompt_for_contextual_title(*,
                                            experience_title: str,
                                            company: Optional[str] = None,
                                            work_type: WorkType,
                                            responsibilities: list[str]
                                            ):
    return dedent(""" \
        <Input>
            'Job Title': {experience_title}
            'Employer Name': {company}
            'Employment Type': {work_type}
            'Responsibilities': {responsibilities}
        </Input>    
        """).format(
        experience_title=experience_title,
        company=company if company else "Unknown",
        work_type=work_type.name if work_type else "Unknown",
        responsibilities=json.dumps(responsibilities)
    )


class _ContextualizationLLM:
    def __init__(self, country_of_interest: Country, logger: logging.Logger):
        if not country_of_interest:
            raise ValueError("Country of interest needs to be set.")

        self._llm = GeminiGenerativeLLM(
            system_instructions=get_system_prompt_for_contextual_title(country_of_interest),
            config=LLMConfig(generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG)
        )
        self._llm_caller: LLMCaller[_ContextualizationLLMOutput] = LLMCaller[_ContextualizationLLMOutput](
            model_response_type=_ContextualizationLLMOutput)
        self._logger = logger

    async def execute(
            self, *,
            experience_title: str,
            company: Optional[str] = None,
            work_type: WorkType,
            responsibilities: list[str]
    ) -> ContextualizationLLMResponse:
        """
        Returns the country specific contextual title of a job based on the input attributes.
        Besides the job title, the company, work type and responsibilities the contextualization uses
        the implicit knowledge of the LLM about the country of interest and the European framework and also uses a glossary.
        """

        contextual_request_prompt = get_request_prompt_for_contextual_title(
            experience_title=experience_title,
            company=company,
            work_type=work_type,
            responsibilities=responsibilities
        )
        llm_response, llm_stats = await self._llm_caller.call_llm(
            llm=self._llm,
            llm_input=contextual_request_prompt,
            logger=self._logger
        )
        # strip the contextual title from leading and trailing whitespaces
        contextual_title = llm_response.contextual_title
        if not contextual_title:
            self._logger.warning("Failed to generate a contextual title. Using the original title instead.")
            contextual_title = experience_title

        contextual_title = contextual_title.strip()


        if self._logger.isEnabledFor(logging.INFO):
            self._logger.info("ContextualizationLLM inferred contextual title: '%s' reasoning: '%s' "
                              "for the input: experience_title: '%s', company: '%s', work_type: '%s', responsibilities: %s",
                              llm_response.contextual_title, llm_response.reasoning, experience_title, company, work_type, json.dumps(responsibilities))
        return ContextualizationLLMResponse(
            contextual_title=contextual_title,
            llm_stats=llm_stats
        )
