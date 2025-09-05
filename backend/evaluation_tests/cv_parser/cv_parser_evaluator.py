import logging
from textwrap import dedent

from pydantic import BaseModel

from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template import sanitize_input
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, ZERO_TEMPERATURE_GENERATION_CONFIG


class CVParserEvaluationOutput(BaseModel):
    reasoning: str
    score: int
    meets_requirements: bool
    evaluator_name: str = "CV Parser Evaluator"

    class Config:
        extra = "forbid"


class CVParserEvaluator:
    def __init__(self):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._llm_caller: LLMCaller[CVParserEvaluationOutput] = LLMCaller[CVParserEvaluationOutput](
            model_response_type=CVParserEvaluationOutput
        )
        self._llm = GeminiGenerativeLLM(
            system_instructions=self.get_system_instructions(),
            config=LLMConfig(
                generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | {
                    "max_output_tokens": 1024
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
            Respond ONLY with a compact JSON object matching this schema (reasoning first):
            {
              "reasoning": "<one short paragraph>",
              "score": <integer 0-100>,
              "meets_requirements": <true|false>,
              "evaluator_name": "CV Parser Evaluator"
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
        ).format(
            markdown=sanitize_input(markdown_cv, ["System Instructions", "User's Last Input", "Conversation History", "CV Markdown"]),
            bullets=sanitize_input(bullets, ["System Instructions", "User's Last Input", "Conversation History", "CV Markdown"]) 
        )

    async def evaluate(self, *, markdown_cv: str, items: list[str]) -> CVParserEvaluationOutput:
        prompt = self.get_prompt(markdown_cv=markdown_cv, items=items)
        model_response, _ = await self._llm_caller.call_llm(
            llm=self._llm,
            llm_input=prompt,
            logger=self._logger,
        )
        if not model_response:
            self._logger.warning("Evaluator did not return JSON; returning default failure result")
            return CVParserEvaluationOutput(reasoning="No response", score=0, meets_requirements=False)
        return model_response


