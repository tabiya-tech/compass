from app.llm.gemini import GeminiGenerativeLLM

from evaluation_tests.evaluators.base_evaluator import BaseEvaluator
from evaluation_tests.evaluators.evaluation_result import TestEvaluationRecord, EvaluationResult, EvaluationType
from evaluation_tests.evaluators.prompt_generator import PromptGenerator


class CriteriaEvaluator(BaseEvaluator):

    def __init__(self, criteria: EvaluationType):
        super().__init__(criteria)
        self.criteria = criteria
        # Use GeminiGenerativeLLM as the LLM for evaluation
        # as we are not interested in conducting a conversation, with an in-memory state (history).
        self.llm = GeminiGenerativeLLM()

    async def evaluate(self, actual: TestEvaluationRecord) -> EvaluationResult:
        prompt = PromptGenerator.generate_prompt(conversation=actual.generate_conversation(),
                                                 context=actual.simulated_user_prompt,
                                                 criteria=self.criteria)
        result = await self.llm.generate_content_async(prompt)
        # TODO(shaheen): Fix the JSON parsing issue.
        # Score is 0 for now, since often JSON doesn't parse correctly.
        return EvaluationResult(type=self.criteria, score=0,
                                reasoning=result)
