import logging
from textwrap import dedent

from pydantic import BaseModel

from app.agent.llm_caller import LLMCaller
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG


class CVParserEvaluationOutput(BaseModel):
    evaluator_name: str = "CV Parser Evaluator"
    score: int
    reasoning: str
    meets_requirements: bool
    coverage_recall: int | None = None
    precision: int | None = None
    formatting: int | None = None

    class Config:
        extra = "forbid"


class CVParserEvaluator:
    def __init__(self):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._llm_caller: LLMCaller[CVParserEvaluationOutput] = LLMCaller(
            model_response_type=CVParserEvaluationOutput
        )
        self._llm = GeminiGenerativeLLM(
            system_instructions=self.get_system_instructions(),
            config=LLMConfig(language_model_name="gemini-2.0-flash-001",
                             generation_config=JSON_GENERATION_CONFIG)
        )

    @staticmethod
    def get_system_instructions() -> str:
        return dedent(
            """
            <System Instructions>
            You are an expert evaluator assessing a list of extracted CV experiences against the original CV markdown text.

            Task
            - Evaluate the list on: coverage (recall of salient experiences), precision (avoid hallucinations), correctness (roles/dates/companies), and formatting (clean bullet-like sentences, no numbering, no leading hyphens).
            - Respond ONLY with JSON containing:
                - evaluator_name: "CV Parser Evaluator"
                - score: integer 0-100 overall quality
                - reasoning: free text explanation
                - meets_requirements: boolean
                - coverage_recall: integer 0-100
                - precision: integer 0-100
                - formatting: integer 0-100
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
            </Extracted List>ß
            </Input>
            """
        ).format(markdown=markdown_cv, bullets=bullets)

    async def evaluate(self, *, markdown_cv: str, items: list[str]) -> CVParserEvaluationOutput:
        prompt = self.get_prompt(markdown_cv=markdown_cv, items=items)
        llm_response, _stats = await self._llm_caller.call_llm(
            llm=self._llm,
            llm_input=prompt,
            logger=self._logger,
        )
        return llm_response


