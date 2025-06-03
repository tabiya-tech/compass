import json
from textwrap import dedent
import logging
from typing import Optional

from pydantic import BaseModel

from app.agent.experience import WorkType
from app.agent.llm_caller import LLMCaller
from app.agent.penalty import get_penalty
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from app.countries import Country, get_country_glossary
from app.vector_search.esco_entities import SkillEntity
from common_libs.llm.models_utils import LLMConfig, get_config_variation, JSON_GENERATION_CONFIG
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.retry import Retry


class ExperienceSummarizerResponse(BaseModel):
    """
    The response from the ExperienceSummarizer.
    Contains the summarized experience and reasoning behind it.
    """
    reasoning: str
    """The reasoning behind the summary"""

    experience_summary: str
    """The summarized experience in a short paragraph"""

    class Config:
        extra = "forbid"


class ExperienceSummarizer:

    def __init__(self):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._llm_caller: LLMCaller[ExperienceSummarizerResponse] = LLMCaller[ExperienceSummarizerResponse](model_response_type=ExperienceSummarizerResponse)

    @staticmethod
    def get_system_instructions(*, country_of_user: Country) -> str:
        _country_instructions = ""
        if country_of_user is not None and country_of_user != Country.UNSPECIFIED:
            _glossary = get_country_glossary(country_of_user)

            _country_instructions = dedent("""\
            # Country of User
                The country of the user is {country_of_user_name}.
                Use this glossary to understand the terminology and context of the user's experience:
                    {glossary}
            """)
            _country_instructions = replace_placeholders_with_indent(
                _country_instructions,
                country_of_user_name=country_of_user.name,
                glossary=_glossary
            )

        _summarize_system_instructions = dedent("""\
        <System Instructions>
            You are a CV summarization expert summarizing the work/livelihood experience of a user.
            
            # Task
                Your task is to generate a concise summary of the users experience in a short paragraph that will be used for the CV
                of the user. Stay focused on the user's work experience and avoid mentioning personal details. 
                The summary should not be longer than 100 words.
            {country_instructions}
            # Input Structure
                The input structure is composed of: 
                    'Experience Title': The title of the experience
                    'Company/Receiver of work': The name of the company where the user worked or the receiver of the work in case of volunteering or caregiving.
                    'Work Type': The type of work the user did in this experience.
                    'Responsibilities': The list of responsibilities/activities/skills/behaviours of the user in this experience.
                    'Top skills': The list of top skills the user has used in this experience.
                    'Questions & Answers': A list of questions the user was asked about their experience and the user's answers to those questions.
            
            # JSON Output instructions
                You will respond with a JSON object that contains the following fields:
                    - reasoning: a detailed step-by-step explanation of the reasoning behind the summary you generated
                                 this is a free text field that should  explain your thought process.
                    - experience_summary: the summary of the user's experience in a raw formatted non markdown text as a JSON string.
                
                Your response must always be a JSON object with the schema above
        </System Instructions>
            """)
        return replace_placeholders_with_indent(
            _summarize_system_instructions,
            country_instructions=_country_instructions
        )

    @staticmethod
    def get_prompt(*,
                   experience_title: str,
                   company: Optional[str] = None,
                   work_type: WorkType,
                   responsibilities: list[str],
                   top_skills: list[SkillEntity],
                   questions_and_answers: list[tuple[str, str]], ) -> str:
        _skills = "N/A"
        if top_skills is not None and len(top_skills) > 0:
            _skills = [{f'skill title': skill.preferredLabel, f'skill description': skill.description} for skill in top_skills]
            _skills = json.dumps(_skills, indent=4, ensure_ascii=False)
        _prompt = dedent("""\
            <Input>
                Experience Title: '{experience_title}'
                Company/Receiver of work: '{company}'
                Work Type: '{work_type}'
                Responsibilities: '{responsibilities}'
                Top Skills: {skills} 
                Questions & Answers: {questions_and_answers}
            </Input>
            """)

        _questions_and_answers = []

        for question, answer in questions_and_answers:
            _qa_fragment = "Question: '{question}'\nAnswer: '{answer}'\n\n"
            _qa_fragment = replace_placeholders_with_indent(
                _qa_fragment,
                question=question,
                answer=answer
            )
            _questions_and_answers.append(_qa_fragment)

        _questions_and_answers = '\n'.join(_questions_and_answers)

        return replace_placeholders_with_indent(
            _prompt,
            experience_title=experience_title,
            company=company if company else "N/A",
            work_type=WorkType.work_type_short(work_type) if work_type else "N/A",
            responsibilities=', '.join(responsibilities) if responsibilities else "N/A",
            skills=_skills,
            questions_and_answers=_questions_and_answers
        )

    @staticmethod
    def get_llm(*, country_of_user: Country, temperature_config: dict) -> GeminiGenerativeLLM:
        return GeminiGenerativeLLM(
            system_instructions=ExperienceSummarizer.get_system_instructions(country_of_user=country_of_user),
            config=LLMConfig(generation_config=temperature_config | JSON_GENERATION_CONFIG)
        )

    async def execute(
            self, *,
            country_of_user: Country,
            experience_title: str,
            company: Optional[str] = None,
            work_type: WorkType,
            responsibilities: list[str],
            top_skills: list[SkillEntity],
            questions_and_answers: list[tuple[str, str]],
    ) -> str:
        """
        Returns a list of job titles aligned with the input attributes
        and avoids using terminology specific to the country of interest.

        Handles penalty-based retries

        :returns: ContextualizationLLMResponse -> list of contextual titles
        """

        prompt = ExperienceSummarizer.get_prompt(
            experience_title=experience_title,
            company=company,
            work_type=work_type,
            responsibilities=responsibilities,
            top_skills=top_skills,
            questions_and_answers=questions_and_answers
        )

        async def _callback(attempt: int, max_retries: int) -> tuple[str, float, BaseException | None]:
            # Call the LLM to contextualize the job titles

            # Add some temperature and `top_p` variation to prompt the LLM to return different results on each retry.
            # Exponentially increase the temperature and `top_p` to avoid the LLM to return the same result every time.

            temperature_config = get_config_variation(start_temperature=0.5, end_temperature=1,
                                                      start_top_p=0.8, end_top_p=1,
                                                      attempt=attempt, max_retries=max_retries)

            llm = ExperienceSummarizer.get_llm(country_of_user=country_of_user, temperature_config=temperature_config)
            self._logger.debug("Calling LLM with temperature: %s, top_p: %s",
                               temperature_config["temperature"],
                               temperature_config["top_p"])

            return await self._internal_execute(
                llm=llm,
                prompt=prompt,
            )

        result, _result_penalty, _error = await Retry[str].call_with_penalty(
            callback=_callback, logger=self._logger)
        return result

    async def _internal_execute(
            self, *,
            llm: GeminiGenerativeLLM,
            prompt: str,
    ) -> tuple[str, float, BaseException | None]:
        llm_response, llm_stats = await self._llm_caller.call_llm(
            llm=llm,
            llm_input=prompt,
            logger=self._logger
        )
        no_response_penalty_level = 0
        if not llm_response:
            # This may happen if the LLM fails to return a JSON object
            self._logger.warning(
                "The LLM did not return any output the summary is empty.")
            return "", get_penalty(no_response_penalty_level), ValueError(
                "The LLM did not return any output the summary is empty.")
        else:
            self._logger.debug("LLM response: %s", llm_response)
            return llm_response.experience_summary, 0, None
