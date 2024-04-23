from evaluation_tests.evaluators.base_evaluator import BaseEvaluator
from evaluation_tests.evaluators.criteria_evaluator import CriteriaEvaluator
from evaluation_tests.evaluators.evaluation_result import EvaluationType


def create_evaluator(evaluations_type: EvaluationType) -> BaseEvaluator:
    """ Function that creates the right Evaluator based on EvaluationType.

    :param evaluations_type: The type of evaluation to be performed.
    :return: The instantiated evaluator.
    """
    match evaluations_type:
        case EvaluationType.CONCISENESS:
            return CriteriaEvaluator(EvaluationType.CONCISENESS)
        case _:
            raise NotImplementedError()
