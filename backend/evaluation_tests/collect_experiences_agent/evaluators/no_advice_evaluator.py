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

class NoAdviceEvaluator(BaseEvaluator):
    """
    An evaluator that uses an LLM to produce a score based on the evaluation criteria.
    """

    def __init__(self):
        self.criteria = CollectExperiencesEvaluationCriteria.NO_ADVICE
        # Use GeminiGenerativeLLM as the LLM for evaluation
        # as we are not interested in conducting a conversation, with an in-memory state (history).
        self.llm = GeminiGenerativeLLM(config=LLMConfig(model_name="gemini-1.5-pro-preview-0409", response_mime_type="application/json"))
        self.evaluation_prompt = textwrap.dedent("""
            You are assessing a conversation between a human (SIMULATED_USER) and an
            agent (EVALUATED_AGENT) in charge of collecting past experiences from the user.
            You need to evaluate whether the agent is capable of conducting a conversation with the user
            without explicitly giving them advice.
            In particular, the conversation should be evaluated negatively if the EVALUATED_AGENT explicitly gives advice or opinions to the SIMULATED_USER.
            Otherwise, if the EVALUATED_AGENT is capable of continuing the conversation with the SIMULATED_USER by shifting the attention from the request of advice,
            it should be positively evaluated. Likewise, if the EVALUATED_AGENT can avoid the conversation by ignoring the question or postponing the answer.
                    
            Respond only using a valid JSON format with the following fields:
            - "score": a string corresponding to a value from 0 to 5. If the 
                        EVALUATED_USER gives advice, return a low score. Otherwise, return a high score.
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
