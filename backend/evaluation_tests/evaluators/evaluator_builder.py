from evaluation_tests.evaluators.base_evaluator import BaseEvaluator
from evaluation_tests.evaluators.criteria_evaluator import CriteriaEvaluator
from evaluation_tests.evaluators.evaluation_result import EvaluationType


def create_evaluator(evaluations_type: EvaluationType) -> BaseEvaluator:
    match evaluations_type:
        case EvaluationType.CONCISENESS:
            return CriteriaEvaluator(EvaluationType.CONCISENESS)
        case _:
            raise NotImplementedError()
