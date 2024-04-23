from abc import ABC, abstractmethod
from evaluation_tests.evaluators.evaluation_result import TestEvaluationRecord, EvaluationResult, EvaluationType


class BaseEvaluator(ABC):
    """
    An abstract class for a BaseEvaluator.
    """

    def __init__(self, criteria: EvaluationType):
        self.criteria = criteria

    @abstractmethod
    async def evaluate(self, actual: TestEvaluationRecord) -> EvaluationResult:
        """
        Evaluates the input based on the criteria set during initialization.
        :param actual: The input to be evaluated.
        :return: An EvaluationResult object with the finished evaluations.
        """
        raise NotImplementedError()
