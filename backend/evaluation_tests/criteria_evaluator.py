import json

from langchain_google_vertexai import ChatVertexAI

from base_evaluator import BaseEvaluator
from evaluation_result import TestEvaluationRecord, EvaluationResult, EvaluationType
from prompt_generator import PromptGenerator


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
        try:
            parsed_result = json.loads(result)
            return EvaluationResult(evalation_type=self.criteria, score=int(parsed_result['score']),
                                    reasoning=parsed_result['reason'])
        except Exception:
            raise ValueError()
