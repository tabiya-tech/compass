import textwrap

from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from common_libs.llm.models_utils import LLMConfig
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.text_formatters import extract_json
from evaluation_tests.conversation_libs.evaluators.base_evaluator import BaseEvaluator
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord, \
    EvaluationResult
from evaluation_tests.collect_experiences_agent.evaluators.evaluation_criteria import CollectExperiencesEvaluationCriteria
from evaluation_tests.collect_experiences_agent.evaluators.utils import EvaluatorOutput, CollectExperienceEvaluationResult

class FocusEvaluator(BaseEvaluator):
    """
    An evaluator that uses an LLM to produce a score based on the evaluation criteria.
    """

    def __init__(self):
        self.criteria = CollectExperiencesEvaluationCriteria.COLLECT_EXPERIENCE_FOCUS
        # Use GeminiGenerativeLLM as the LLM for evaluation
        # as we are not interested in conducting a conversation, with an in-memory state (history).
        self.llm = GeminiGenerativeLLM(config=LLMConfig(model_name="gemini-1.5-pro-preview-0409", response_mime_type="application/json"))
        self.evaluation_prompt = textwrap.dedent("""
            You are assessing a conversation between a human (SIMULATED_USER) and an
            agent (EVALUATED_AGENT) in charge of collecting past experiences from the user.
            You need to evaluate whether the agent is focused on the task at hand, and 
            doesn't get distracted by requests of the user. In particular,
            is the EVALUATED_AGENT following the SIMULATED_USER into a conversation that
            steers away from the experience and skill collection or is the EVALUATED_AGENT
            bringing back the conversation to the right track?
            
            Rate it from 0 to 5, 0 being worst 5 being best.
                    
            Respond only using a valid JSON format with the following fields:
            - "score": a value from 0 to 5 indicating how much the EVALUATED_AGENT was 
                        able to keep focus. Overall, anything larger or equal to 3
                        indicates that the conversation was mostly focused.
            - "reason": a reason for the score.
            """)
    async def evaluate(self, actual: ConversationEvaluationRecord) -> EvaluationResult:
        focus_evaluation_prompt =  self.evaluation_prompt+textwrap.dedent(f""" 
            Conversation Data:
            [BEGIN DATA]
            [Conversation]: {actual.conversation}
            [END DATA] 
        """)

        result = await self.llm.generate_content(focus_evaluation_prompt)
        parsed_result = extract_json.extract_json(result.text, EvaluatorOutput)
        return CollectExperienceEvaluationResult(type=self.criteria, score=parsed_result.score,
                                reason=parsed_result.reason)
