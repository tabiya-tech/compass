import logging
from textwrap import dedent

from pydantic import BaseModel, Field

from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template import sanitize_input
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, ZERO_TEMPERATURE_GENERATION_CONFIG


class ResponsibilitiesPrecisionRecallOutput(BaseModel):
    precision: float = Field(ge=0.0, le=1.0)
    recall: float = Field(ge=0.0, le=1.0)
    justification: str
    evaluator_name: str = "Responsibilities Precision/Recall Evaluator"

    class Config:
        extra = "forbid"


class ResponsibilitiesEvaluator:
    def __init__(self):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._llm_caller: LLMCaller[ResponsibilitiesPrecisionRecallOutput] = LLMCaller[ResponsibilitiesPrecisionRecallOutput](
            model_response_type=ResponsibilitiesPrecisionRecallOutput
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
            You are an expert resume reviewer evaluating the quality of extracted responsibilities for a single experience.
            Respond ONLY with a compact JSON object matching this schema:
            {
              "precision": <float 0.0-1.0>,
              "recall": <float 0.0-1.0>,
              "justification": "<one short paragraph>",
              "evaluator_name": "Responsibilities Precision/Recall Evaluator"
            }
            </System Instructions>
            """
        )

    @staticmethod
    def get_prompt(*, markdown_cv: str, experience_title: str, company: str | None, responsibilities: list[str]) -> str:
        responsibilities_bullets = "\n".join([f"- {s}" for s in responsibilities]) or "(none)"
        return dedent(
            """
            <Input>
            <CV Markdown>
            {cv}
            </CV Markdown>

            <Experience>
            Title: {title}
            Company: {company}
            </Experience>

            <Extracted Responsibilities>
            {resp}
            </Extracted Responsibilities>

            Instructions:
            - precision: fraction of listed responsibilities directly supported by the CV text for this experience.
            - recall: fraction of the key responsibilities in the CV for this experience that appear above.
            Respond strictly in JSON.
            </Input>
            """
        ).format(
            cv=sanitize_input(markdown_cv, ["System Instructions", "User's Last Input", "Conversation History", "CV Markdown"]),
            title=sanitize_input(experience_title, ["System Instructions"]),
            company=sanitize_input(company or "Unknown", ["System Instructions"]),
            resp=sanitize_input(responsibilities_bullets, ["System Instructions", "CV Markdown"])
        )

    async def evaluate(self, *, markdown_cv: str, experience_title: str, company: str | None, responsibilities: list[str]) -> ResponsibilitiesPrecisionRecallOutput:
        prompt = self.get_prompt(
            markdown_cv=markdown_cv,
            experience_title=experience_title,
            company=company,
            responsibilities=responsibilities,
        )
        model_response, _ = await self._llm_caller.call_llm(
            llm=self._llm,
            llm_input=prompt,
            logger=self._logger,
        )
        if not model_response:
            self._logger.warning("Evaluator did not return JSON; returning default failure result")
            return ResponsibilitiesPrecisionRecallOutput(precision=0.0, recall=0.0, justification="No response")
        return model_response


