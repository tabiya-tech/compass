from evaluation_tests.conversation_libs.evaluators.base_evaluator import BaseEvaluator
from evaluation_tests.conversation_libs.evaluators.criteria_evaluator import CriteriaEvaluator
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationType


def create_evaluator(evaluations_type: EvaluationType) -> BaseEvaluator:
    """ Function that creates the right Evaluator based on EvaluationType.

    :param evaluations_type: The type of evaluation to be performed.
    :return: The instantiated evaluator.
    """
    match evaluations_type:
        case EvaluationType.CONCISENESS:
            return CriteriaEvaluator(EvaluationType.CONCISENESS)
        case EvaluationType.FOCUS:
            return CriteriaEvaluator(EvaluationType.FOCUS)
        case EvaluationType.NO_ADVICE:
            return CriteriaEvaluator(EvaluationType.NO_ADVICE)
        case _:
            raise NotImplementedError()
