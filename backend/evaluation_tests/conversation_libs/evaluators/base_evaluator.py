from abc import ABC, abstractmethod

from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord, EvaluationResult, EvaluationType


class BaseEvaluator(ABC):
    """
    An abstract class for a BaseEvaluator.
    """

    def __init__(self, criteria: EvaluationType, **kwargs):
        self.criteria = criteria

    @abstractmethod
    async def evaluate(self, actual: ConversationEvaluationRecord) -> EvaluationResult:
        """
        Evaluates the input based on the criteria set during initialization.
        :param actual: The input to be evaluated.
        :return: An EvaluationResult object with the finished evaluations.
        """
        raise NotImplementedError()
