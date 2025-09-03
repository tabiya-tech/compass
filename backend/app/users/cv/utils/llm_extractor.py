from __future__ import annotations

import logging
from textwrap import dedent
from typing import Optional

from pydantic import BaseModel, Field

from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template import sanitize_input
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, ZERO_TEMPERATURE_GENERATION_CONFIG


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
        self._llm = GeminiGenerativeLLM(
            system_instructions=self._json_system_instructions(),
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "max_output_tokens": 2048
                }
            )
        )

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
            - Do not number items and do not add bullets or prefixes.
            - Prefer sentences that include a role/title and usually an org/receiver and timeframe.
            - Do NOT include standalone responsibilities/tasks unless they belong to a separate role in the same sentence.
            - No prose outside the JSON. Respond with JSON only.
            </System Instructions>
            """
        )

    async def extract_experiences(self, markdown_cv: str) -> list[str]:
        self._logger.info("Extracting experiences from markdown {md_length_chars=%s}", len(markdown_cv or ""))
        try:
            prompt = self._prompt(markdown_cv.strip())
            self._logger.debug("Prompt preview: %s", prompt[:200].replace("\n", " "))
            model_response, _ = await self._llm_caller.call_llm(
                llm=self._llm,
                llm_input=prompt,
                logger=self._logger,
            )
        except Exception as e:  # Guard against unexpected errors; return empty list rather than raise
            self._logger.exception("LLM extraction failed: %s", e)
            model_response = None

        if not model_response:
            self._logger.error("LLM returned no data; experiences list is empty")
            return []

        # Return the parsed list
        items = model_response.experiences or []
        self._logger.info("Experiences extracted {items=%s}", len(items))
        if items:
            self._logger.debug("Extraction preview: %s", "; ".join(items[:3]))
        else:
            self._logger.error("LLM returned an empty 'experiences' array")
        return items


