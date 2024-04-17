from evaluation_tests.conversation_libs.evaluators.base_evaluator import BaseEvaluator
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord, \
    EvaluationResult


class AgentHealthEvaluator(BaseEvaluator):
    """
    An evaluator that uses the conversation context to evaluate the agent health with respect to:
    - The number of turns in the conversation.
    - Errors occurred by the agent.
    - If the agent completed their task.
    """

    async def evaluate(self, actual: ConversationEvaluationRecord) -> EvaluationResult:
        if actual.conversation is None:
            raise ValueError("Conversation is None.")

        for turn  in actual.conversation_context.history.turns:
            if turn.output.finished:
                actual.agent_errors += 1
