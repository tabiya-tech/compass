from __future__ import annotations

import logging
from textwrap import dedent
from typing import Optional

from pydantic import BaseModel

from app.agent.llm_caller import LLMCaller
from app.agent.experience.work_type import WorkType
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG


class CVExperience(BaseModel):
    experience_title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    paid_work: Optional[bool] = None
    work_type: Optional[str] = None

    class Config:
        extra = "forbid"


class CVExperienceExtractionResponse(BaseModel):
    experiences: list[CVExperience]

    class Config:
        extra = "forbid"


class CVExperienceExtractor:
    def __init__(self, logger: Optional[logging.Logger] = None):
        self._logger = logger or logging.getLogger(self.__class__.__name__)
        self._llm_caller: LLMCaller[CVExperienceExtractionResponse] = LLMCaller(
            model_response_type=CVExperienceExtractionResponse
        )

    @staticmethod
    def _system_instructions() -> str:
        allowed_work_types = ", ".join([wt.name for wt in WorkType])
        return dedent(
            """
            <System Instructions>
            You are an expert CV parser.
            Task: Extract a list of work or livelihood experiences from the provided Markdown CV content.

            Rules:
            - Extract only real experiences the person actually has; ignore interests or plans.
            - Return a JSON object with a single key 'experiences' that is a list of objects, each with fields:
              - experience_title (string or null)
              - company (string or null)
              - location (string or null)
              - start_date (string or null; format YYYY/MM/DD, YYYY/MM or YYYY if precise dates not known)
              - end_date (string or 'Present' or null; same format rules)
              - paid_work (boolean or null)
              - work_type (one of: {allowed_work_types}, or null)

            Notes:
            - Use the CV content only; do not invent facts.
            - When dates are ranges like '2018-2020', map to start_date='2018' and end_date='2020'.
            - If an experience looks like volunteering/caregiving, set paid_work=false.
            - If you cannot determine a field, set it to null, not an empty string.
            - Respond with JSON only.
            </System Instructions>
            """
        ).format(allowed_work_types=allowed_work_types)

    @staticmethod
    def _prompt(markdown_cv: str) -> str:
        return dedent(
            """
            <CV Markdown>
            {markdown}
            </CV Markdown>
            """
        ).format(markdown=markdown_cv)

    async def extract(self, markdown_cv: str) -> list[CVExperience]:
        llm = GeminiGenerativeLLM(
            system_instructions=self._system_instructions(),
            config=LLMConfig(generation_config=JSON_GENERATION_CONFIG | {"temperature": 0.0})
        )
        response, _stats = await self._llm_caller.call_llm(
            llm=llm,
            llm_input=self._prompt(markdown_cv),
            logger=self._logger,
        )
        if not response:
            return []

        experiences = response.experiences or []
        # Normalize work_type to match our enums; drop invalid values
        for exp in experiences:
            if exp.work_type is not None:
                wt = WorkType.from_string_key(exp.work_type)
                exp.work_type = wt.name if wt is not None else None
        return experiences

    @staticmethod
    def _format_bullet(exp: CVExperience) -> str:
        parts: list[str] = []
        # Role and company
        if exp.experience_title:
            if exp.company:
                parts.append(f"Worked as a {exp.experience_title} at {exp.company}")
            else:
                parts.append(f"Worked as a {exp.experience_title}")
        elif exp.company:
            parts.append(f"Worked at {exp.company}")

        # Location
        if exp.location:
            parts[-1] = parts[-1] + f" in {exp.location}" if parts else f"In {exp.location}"

        # Dates
        date_clause = None
        if exp.start_date and exp.end_date:
            date_clause = f"from {exp.start_date} to {exp.end_date}"
        elif exp.start_date and not exp.end_date:
            date_clause = f"since {exp.start_date}"
        elif not exp.start_date and exp.end_date:
            date_clause = f"until {exp.end_date}"
        if date_clause:
            parts.append(date_clause)

        # Paid or unpaid
        if isinstance(exp.paid_work, bool):
            parts.append("It was a paid job" if exp.paid_work else "It was an unpaid job")

        sentence = ", ".join(parts).strip()
        if not sentence.endswith("."):
            sentence = sentence + "."
        return f"- {sentence}"

    async def extract_bulleted(self, markdown_cv: str) -> list[str]:
        experiences = await self.extract(markdown_cv)
        bullets: list[str] = []
        for exp in experiences:
            bullets.append(self._format_bullet(exp))
        return bullets

    @staticmethod
    def _bulleted_system_instructions() -> str:
        return dedent(
            """
            <System Instructions>
            You are an expert CV parser.
            Task: From the provided Markdown CV content, output ONLY a bullet list of experiences, one experience per line.

            Output format:
            - Each line MUST start with "- ".
            - Do NOT number items. Do NOT include any prose or JSON or code fences.
            - Prefer sentences like: "Worked as a <role> at <company> in <location>, from <start> to <end>. It was a paid job." or similar.
            - If unsure about a field, omit that clause.
            - Do NOT add headings or any other text before or after the list.
            </System Instructions>
            """
        )

    async def extract_bulleted_direct(self, markdown_cv: str) -> list[str]:
        llm = GeminiGenerativeLLM(
            system_instructions=self._bulleted_system_instructions(),
            config=LLMConfig(generation_config={"temperature": 0.2, "max_output_tokens": 2048})
        )
        prompt = self._prompt(markdown_cv)
        llm_response = await llm.generate_content(llm_input=prompt)
        text = llm_response.text or ""
        # Normalize: split by lines, keep lines that look like bullets
        lines = [line.strip() for line in text.splitlines()]
        items: list[str] = []
        for line in lines:
            if not line:
                continue
            # remove possible leading markdown artifacts
            if line.startswith("- "):
                items.append(line[2:].strip())
            elif line.startswith("* "):
                items.append(line[2:].strip())
            elif line[0].isdigit() and (line[1:3] == ". " or line[1] == '.' ):
                # numbered item like "1. text" -> convert to bullet
                content = line.split('.', 1)[1].strip()
                items.append(content)
            else:
                items.append(line)
        # If model returned a paragraph, fallback to single item
        if not items and text:
            items = [text.strip()]
        return items


