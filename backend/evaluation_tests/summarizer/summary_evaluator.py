from common_libs.llm.models_utils import LLMConfig
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.text_formatters import extract_json
from evaluation_tests.conversation_libs.evaluators.base_evaluator import BaseEvaluator
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationResult, EvaluationType,\
    SummaryEvaluationRecord
from evaluation_tests.conversation_libs.evaluators.prompt_generator import PromptGenerator
from evaluation_tests.conversation_libs.evaluators.criteria_evaluator import LlmEvaluatorOutput


class SummaryCriteriaEvaluator(BaseEvaluator):
    """
    An evaluator that uses an LLM to produce a score based on the evaluation criteria for summary evaluation.
    """

    def __init__(self, criteria: EvaluationType):
        super().__init__(criteria)
        self.criteria = criteria
        # Use GeminiGenerativeLLM as the LLM for evaluation
        self.llm = GeminiGenerativeLLM(config=LLMConfig(model_name="gemini-1.5-pro-preview-0409"))

    async def evaluate(self, actual: SummaryEvaluationRecord) -> EvaluationResult:
        prompt = PromptGenerator.generate_summary_prompt(conversation=actual.generate_conversation(),
                                                         current_summary=actual.current_summary, new_summary=actual.new_summary,
                                                         criteria=self.criteria)
        result = await self.llm.generate_content(prompt)
        parsed_result = extract_json.extract_json(result.text, LlmEvaluatorOutput)
        return EvaluationResult(type=self.criteria, score=parsed_result.score,
                                reasoning=parsed_result.reason)
