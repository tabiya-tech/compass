from langchain_google_vertexai import ChatVertexAI

from evaluation_tests.evaluators.base_evaluator import BaseEvaluator
from evaluation_tests.evaluators.evaluation_result import TestEvaluationRecord, EvaluationResult, EvaluationType
from evaluation_tests.evaluators.prompt_generator import PromptGenerator


class CriteriaEvaluator(BaseEvaluator):

    def __init__(self, criteria: EvaluationType, data: TestEvaluationRecord):
        super().__init__(criteria, data)
        self.criteria = criteria
        self.prompt = PromptGenerator.generate_prompt(conversation=data.generate_conversation(),
                                                      context=data.simulated_user_prompt,
                                                      criteria=criteria)

        # TODO(shaheen): Change to use VertexAI directly.
        self.llm = ChatVertexAI(model_name="gemini-pro")

    async def evaluate(self) -> EvaluationResult:
        result = (await self.llm.ainvoke(self.prompt)).content
        # TODO(shaheen): Fix the JSON parsing issue.
        # Score is 0 for now, since often JSON doesn't parse correctly.
        return EvaluationResult(type=self.criteria, score=0,
                                reasoning=result)
