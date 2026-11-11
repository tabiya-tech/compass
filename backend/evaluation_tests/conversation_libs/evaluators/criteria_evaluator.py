from pydantic import BaseModel, Field

from app.agent.config import ModelTier
from common_libs.llm.models_utils import LLMConfig
from common_libs.llm.generative_models import GeminiGenerativeLLM
from evaluation_tests.conversation_libs.evaluators.base_evaluator import BaseEvaluator
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord, \
    EvaluationResult, EvaluationType
from evaluation_tests.conversation_libs.evaluators.prompt_generator import PromptGenerator


class LlmEvaluatorOutput(BaseModel):
    """
    The response of the llm evaluator (its structured output).
    """
    score: int = Field(description="The score of the evaluation, on the scale given in the instructions.")
    reason: str = Field(description="The reason of the score, based on the evaluation criteria.")


class CriteriaEvaluator(BaseEvaluator):
    """
    An evaluator that uses an LLM to produce a score based on the evaluation criteria.
    """

    def __init__(self, criteria: EvaluationType):
        super().__init__(criteria)
        self.criteria = criteria
        # Use GeminiGenerativeLLM as the LLM for evaluation
        # as we are not interested in conducting a conversation, with an in-memory state (history).
        self.llm = GeminiGenerativeLLM(config=LLMConfig(model_tier=ModelTier.DEEP_REASONING))

    async def evaluate(self, actual: ConversationEvaluationRecord) -> EvaluationResult:
        prompt = PromptGenerator.generate_prompt(conversation=actual.generate_conversation(),
                                                 criteria=self.criteria)
        result = await self.llm.generate_content(prompt, response_schema=LlmEvaluatorOutput)
        parsed_result = LlmEvaluatorOutput.model_validate_json(result.text)
        return EvaluationResult(evaluator_name=self.criteria.value, score=parsed_result.score,
                                reasoning=parsed_result.reason)
