from pydantic import BaseModel

from common_libs.llm.models_utils import LLMConfig
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.text_formatters import extract_json
from evaluation_tests.conversation_libs.evaluators.base_evaluator import BaseEvaluator
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord, \
    EvaluationResult, EvaluationType
from evaluation_tests.conversation_libs.evaluators.prompt_generator import PromptGenerator


class LlmEvaluatorOutput(BaseModel):
    """
    Class used to parse the JSON returned from the llm evaluator.
    """
    score: int
    reason: str


class CriteriaEvaluator(BaseEvaluator):
    """
    An evaluator that uses an LLM to produce a score based on the evaluation criteria.
    """

    def __init__(self, criteria: EvaluationType):
        super().__init__(criteria)
        self.criteria = criteria
        # Use GeminiGenerativeLLM as the LLM for evaluation
        # as we are not interested in conducting a conversation, with an in-memory state (history).
        self.llm = GeminiGenerativeLLM(config=LLMConfig(language_model_name="gemini-2.5-pro-preview-05-06"))

    async def evaluate(self, actual: ConversationEvaluationRecord) -> EvaluationResult:
        prompt = PromptGenerator.generate_prompt(conversation=actual.generate_conversation(),
                                                 criteria=self.criteria)
        result = await self.llm.generate_content(prompt)
        parsed_result = extract_json.extract_json(result.text, LlmEvaluatorOutput)
        return EvaluationResult(evaluator_name=self.criteria.value, score=parsed_result.score,
                                reasoning=parsed_result.reason)
