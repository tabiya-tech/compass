from abc import ABC, abstractmethod
from evaluation_tests.evaluators.evaluation_result import TestEvaluationRecord, EvaluationResult, EvaluationType


class BaseEvaluator(ABC):
    """
    An abstract class for a BaseEvaluator.
    """

    def __init__(self, criteria: EvaluationType, data: TestEvaluationRecord):
        self.criteria = criteria
        self.data = data

    @abstractmethod
    async def evaluate(self) -> EvaluationResult:
        raise NotImplementedError()
