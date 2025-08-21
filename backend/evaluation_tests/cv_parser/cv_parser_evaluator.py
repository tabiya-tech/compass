import json
import logging
from textwrap import dedent

from pydantic import BaseModel

from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig


class CVParserEvaluationOutput(BaseModel):
    evaluator_name: str = "CV Parser Evaluator"
    score: int
    reasoning: str
    meets_requirements: bool

    class Config:
        extra = "forbid"


class CVParserEvaluator:
    def __init__(self):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._llm = GeminiGenerativeLLM(
            system_instructions=self.get_system_instructions(),
            config=LLMConfig(
                language_model_name="gemini-2.0-flash-001",
                generation_config={
                    "temperature": 0.2,
                    "max_output_tokens": 1024,
                    "response_mime_type": "application/json",
                }
            )
        )

    @staticmethod
    def get_system_instructions() -> str:
        return dedent(
            """
            <System Instructions>
            You are an expert evaluator.
            Task: Assess the extracted CV experience lines against the CV markdown.
            Consider coverage (did we capture the main roles), precision (avoid hallucinations), and formatting.
            Respond ONLY with a compact JSON object:
            {
              "evaluator_name": "CV Parser Evaluator",
              "score": <integer 0-100>,
              "reasoning": "<one short paragraph>",
              "meets_requirements": <true|false>
            }
            </System Instructions>
            """
        )

    @staticmethod
    def get_prompt(*, markdown_cv: str, items: list[str]) -> str:
        bullets = "\n".join([f"- {s}" for s in items])
        return dedent(
            """
            <Input>
            <CV Markdown>
            {markdown}
            </CV Markdown>

            <Extracted List>
            {bullets}
            </Extracted List>
            </Input>
            """
        ).format(markdown=markdown_cv, bullets=bullets)

    async def evaluate(self, *, markdown_cv: str, items: list[str]) -> CVParserEvaluationOutput:
        prompt = self.get_prompt(markdown_cv=markdown_cv, items=items)
        resp = await self._llm.generate_content(llm_input=prompt)
        text = (resp.text or "").strip()
        try:
            data = json.loads(text)
        except Exception:
            # try to strip code fences and extract JSON substring
            cleaned = text
            if cleaned.startswith("```"):
                # remove leading fence line (best-effort, no exceptions swallowed)
                first_nl = cleaned.find("\n")
                if first_nl != -1:
                    cleaned = cleaned[first_nl + 1 :]
                if cleaned.endswith("```"):
                    cleaned = cleaned[: -3]
                cleaned = cleaned.strip()
            # heuristic: slice between first '{' and last '}'
            if '{' in cleaned and '}' in cleaned:
                try:
                    start = cleaned.find('{')
                    end = cleaned.rfind('}') + 1
                    candidate = cleaned[start:end]
                    data = json.loads(candidate)
                except Exception:
                    self._logger.warning("Evaluator did not return JSON; wrapping raw text")
                    return CVParserEvaluationOutput(score=0, reasoning=text[:500], meets_requirements=False)
            else:
                self._logger.warning("Evaluator did not return JSON; wrapping raw text")
                return CVParserEvaluationOutput(score=0, reasoning=text[:500], meets_requirements=False)

        # Map to model; enforce defaults
        return CVParserEvaluationOutput(
            evaluator_name=str(data.get("evaluator_name", "CV Parser Evaluator")),
            score=int(data.get("score", 0)),
            reasoning=str(data.get("reasoning", ""))[:1000],
            meets_requirements=bool(data.get("meets_requirements", False)),
        )


