import logging
from textwrap import dedent
from typing import Optional

from pydantic import BaseModel, Field

from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template import sanitize_input
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, ZERO_TEMPERATURE_GENERATION_CONFIG, get_config_variation
from common_libs.retry import Retry
from app.agent.penalty import get_penalty


_TAGS_TO_FILTER = [
    "CV Markdown",
    "System Instructions",
    "User's Last Input",
    "Conversation History",
]


class CVExtractionResponse(BaseModel):
    experiences: list[str] = Field(default_factory=list)


class CVExperienceExtractor:
    def __init__(self, logger: Optional[logging.Logger] = None):
        self._logger = logger or logging.getLogger(self.__class__.__name__)
        self._llm_caller: LLMCaller[CVExtractionResponse] = LLMCaller[CVExtractionResponse](
            model_response_type=CVExtractionResponse
        )
        # Since all errors (hard error, no response, empty list) result in an empty reponse
        # we treat them all as retryable with the same penalty
        self._penalty_level = 1

    @staticmethod
    def _prompt(markdown_cv: str) -> str:
        clean_md = sanitize_input(markdown_cv, _TAGS_TO_FILTER)
        return dedent(
            """
            <CV Markdown>
            {markdown}
            </CV Markdown>
            """
        ).format(markdown=clean_md)

    @staticmethod
    def _json_system_instructions() -> str:
        return dedent(
            """
            <System Instructions>
            You are an expert CV parser.
            Task: From the provided <CV Markdown> content, output ONLY job/livelihood experiences as a JSON object with the schema below.

            JSON Output Schema (must strictly follow):
            {
              "experiences": ["string", ...]
            }

            Rules for experiences:
            - Each item must be a single sentence describing a work/livelihood experience.
            - Each experience must be captured. Even if two experiences look similar, as long as they are 
              unique in role/title, location, company, or timeframe
            - Skip any expeeriences that are completely duplicated
            - Do not number items and do not add bullets or prefixes.
            - An experience typically includes a role/title and usually a company/organization or receiver of work, a timeframe (e.g., from X to Y, since X, Present) and a location.
            - Do NOT include standalone responsibilities/tasks unless they belong to a separate role in the same sentence.
            - Do NOT include personal data: no person names of the CV owner, no email addresses, no phone numbers,
              no street addresses, no personal websites or profile links (LinkedIn, GitHub, etc.). Company/organization names
              and city/country locations are allowed.
            
            Examples (format to emulate; style guidance, not strict):
            Worked as a project manager at the University of Oxford, from 2018 to 2020. It was a paid job and you worked remotely.
            Co-founded Acme Inc. in 2022, a gen-ai startup based in DC, USA. You owned this business and your role was CEO.
            Volunteered as an instructor at Community Center in Berlin, from 2015 to 2017.
            - No prose outside the JSON. Respond with JSON only.
            </System Instructions>
            """
        )

    async def extract_experiences(self, markdown_cv: str) -> list[str]:
        self._logger.info("Extracting experiences from markdown {md_length_chars=%s}", len(markdown_cv or ""))
        prompt = self._prompt((markdown_cv or "").strip())
        self._logger.debug("Prompt preview: %s", prompt[:200].replace("\n", " "))

        async def _callback(attempt: int, max_retries: int) -> tuple[list[str], float, BaseException | None]:
            # Vary temperature/top_p slightly across retries to escape bad local minima
            temperature_cfg = get_config_variation(start_temperature=0.0, end_temperature=0.3,
                                                   start_top_p=0.9, end_top_p=1.0,
                                                   attempt=attempt, max_retries=max_retries)
            llm = GeminiGenerativeLLM(
                system_instructions=self._json_system_instructions(),
                config=LLMConfig(
                    generation_config=temperature_cfg | JSON_GENERATION_CONFIG | {
                        "max_output_tokens": 2048
                    }
                )
            )
            try:
                model_response, _ = await self._llm_caller.call_llm(
                    llm=llm,
                    llm_input=prompt,
                    logger=self._logger,
                )
            except Exception as e:
                return [], get_penalty(self._penalty_level), e

            if not model_response:
                return [], get_penalty(self._penalty_level), ValueError("LLM returned no model response")

            items = model_response.experiences or []
            if not items:
                return [], get_penalty(self._penalty_level), ValueError("LLM returned empty experiences list")

            # Success
            return items, 0.0, None

        items, _penalty, _error = await Retry[list[str]].call_with_penalty(callback=_callback, logger=self._logger)
        if items:
            self._logger.info("Experiences extracted {items=%s}", len(items))
            self._logger.debug("Extraction preview: %s", "; ".join(items[:3]))
        else:
            self._logger.error("LLM extraction failed to produce items after retries")
        return items


