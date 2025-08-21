from __future__ import annotations

import logging
from textwrap import dedent
from typing import Optional

from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig


class CVExperienceExtractor:
    def __init__(self, logger: Optional[logging.Logger] = None):
        self._logger = logger or logging.getLogger(self.__class__.__name__)

    @staticmethod
    def _prompt(markdown_cv: str) -> str:
        return dedent(
            """
            <CV Markdown>
            {markdown}
            </CV Markdown>
            """
        ).format(markdown=markdown_cv)

    @staticmethod
    def _lines_system_instructions() -> str:
        return dedent(
            """
            <System Instructions>
            You are an expert CV parser.
            Task: From the provided <CV Markdown> content, output ONLY a list of work/livelihood experience statements, one per line.

            Output format:
            - Each line must be a single sentence.
            - Do not number items. Do not prefix with '-' or '*'. Do not include any prose, JSON, or code fences.
            - If unsure about a field, omit that clause.
            - Do not add headings or any other text before or after the list.
            - Distinguish experiences from responsibilities/tasks:
              • Output only job/livelihood experiences (e.g., roles like "Worked as ...", "Co-founded ...", "Owned ...", "Volunteered ...").
              • An experience typically includes a role/title and usually a company/organization or receiver of work, and a timeframe (e.g., from X to Y, since X, Present). Location is optional.
              • Do NOT output standalone responsibilities/tasks (e.g., "Configured monitoring tools...", "Automated tasks...", "Coordinated incident response...") unless they are clearly part of a separate role that includes a role/title and timeframe in the same sentence.
            - Ignore standalone project lists unless they clearly describe a separate job/livelihood experience.
            
            Examples (format to emulate):
            Worked as a project manager at the University of Oxford, from 2018 to 2020. It was a paid job and you worked remotely.
            Co-founded Acme Inc. in 2022, a gen-ai startup based in DC, USA. You owned this business and your role was CEO.
            Volunteered as an instructor at Community Center in Berlin, from 2015 to 2017.
            </System Instructions>
            """
        )

    async def extract_experiences(self, markdown_cv: str) -> list[str]:
        llm = GeminiGenerativeLLM(
            system_instructions=self._lines_system_instructions(),
            config=LLMConfig(language_model_name="gemini-2.0-flash-001",
                             generation_config={"temperature": 0.2, "max_output_tokens": 2048})
        )
        prompt = self._prompt(markdown_cv)
        llm_response = await llm.generate_content(llm_input=prompt)
        text = llm_response.text or ""
        lines = [line.strip() for line in text.splitlines()]
        items: list[str] = []
        for line in lines:
            if not line:
                continue
            # Strip any bullet/number artifacts in case the model still emits them
            if line.startswith("- ") or line.startswith("* "):
                line = line[2:].strip()
            elif line[0].isdigit() and (len(line) > 1 and (line[1:3] == ". " or line[1] == '.')):
                line = line.split('.', 1)[1].strip()
            items.append(line)
        if not items and text:
            items = [text.strip()]
        return items


