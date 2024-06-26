import logging
import time
from textwrap import dedent

from app.agent.agent_types import LLMStats
from app.agent.experience.experience_entity import ExperienceEntity
from app.countries import Country, get_country_glossary
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LOW_TEMPERATURE_GENERATION_CONFIG, LLMConfig, JSON_GENERATION_CONFIG


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
        glossary_str = glossary_template.format(glossary=glossary)

    return dedent("""\
        You are an expert who needs to classify jobs from {country_of_interest} to a European framework. 
        The jobs are described in the context of {country_of_interest} and use specific terminology from {country_of_interest}, 
        You should return a job description that does not include terminology from {country_of_interest}, 
        but rather European standards.

        #Input Structure
        The input structure is composed of: 
        'Job Description': The job title in the context of {country_of_interest},
        'Employer Name' : The name of the employer,
        'Employment Type': The type of employment that has one of the following values 'None', 
                'FORMAL_SECTOR_WAGED_EMPLOYMENT', 'FORMAL_SECTOR_UNPAID_TRAINEE', 'SELF_EMPLOYMENT' or 'UNSEEN_UNPAID'.
                The values have the following meanings:   
                    None: When there is not information to classify the work type in any of the categories below.    
                    FORMAL_SECTOR_WAGED_EMPLOYMENT: Formal sector / Wage employment 
                    FORMAL_SECTOR_UNPAID_TRAINEE: Formal sector / Unpaid trainee work
                    SELF_EMPLOYMENT: Self-employment, micro entrepreneurship
                    UNSEEN_UNPAID: Represents all unseen economy, 
                        including:
                        - Unpaid domestic services for household and family members
                        - Unpaid caregiving services for household and family members
                        - Unpaid direct volunteering for other households
                        - Unpaid community- and organization-based volunteering
                        excluding:
                        - Unpaid trainee work, which is classified as FORMAL_SECTOR_UNPAID_TRAINEE  
        
        You should use the above information only to infer the context and you shouldn't return it as output. 
        
        {glossary}
        
        #Output Structure
        The output must exclusively the contextualized job title as plain string. 
        Do not add any markup, or other special characters.
        Don't output anything else. 
        Do not include the employer information.
        """).format(country_of_interest=country_of_interest.value, glossary=glossary_str)


def get_request_prompt_for_contextual_title(experience_entity: ExperienceEntity):
    return dedent(""" \
        #Input
        'Job Description': {experience_title}
        'Employer Name': {company}
        'Employment Type': {work_type}
        #Output
        'Contextualized Job Title':
        """).format(
        experience_title=experience_entity.experience_title,
        company=experience_entity.company if experience_entity.company else "Undefined",
        work_type=experience_entity.work_type)


class _ContextualizationLLM:
    """
    TODO: Add description
    """

    def __init__(self, country_of_interest: Country, logger: logging.Logger):
        if not country_of_interest:
            raise ValueError("Country of interest needs to be set.")

        self._llm = GeminiGenerativeLLM(
            system_instructions=get_system_prompt_for_contextual_title(country_of_interest),
            config=LLMConfig(generation_config=LOW_TEMPERATURE_GENERATION_CONFIG)
        )
        self._logger = logger

    async def execute(
            self,
            experience: ExperienceEntity,

    ) -> tuple[str, LLMStats]:
        """
        TODO: Add description
        """
        if not experience:
            raise ValueError("Experience Entity needs to be set")
        llm_start_time = time.time()
        contextual_request_prompt = get_request_prompt_for_contextual_title(experience)
        llm_response = await self._llm.generate_content(contextual_request_prompt)
        llm_end_time = time.time()
        llm_stats = LLMStats(prompt_token_count=llm_response.prompt_token_count,
                             response_token_count=llm_response.response_token_count,
                             response_time_in_sec=round(llm_end_time - llm_start_time, 2))
        contextualized_title = llm_response.text
        if not contextualized_title:
            self._logger.warning("Failed to generate a contextualized title. Using the original title instead.")
            contextualized_title = experience.experience_title
        contextualized_title = contextualized_title.strip()
        return contextualized_title, llm_stats
