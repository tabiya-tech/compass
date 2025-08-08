import logging
import pytest
from evaluation_tests.conversation_libs.evaluators.base_evaluator import BaseEvaluator
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord, \
    EvaluationResult, EvaluationType


class LogTester:
    def __init__(self):
        self.caplog = None

    @staticmethod
    def count_log_levels(records):
        """
        Count the occurrences of each log level in the log records.
        """
        counts = {'CRITICAL': 0, 'ERROR': 0, 'WARNING': 0}
        for rec in records:
            counts[rec.levelname] += 1
        return counts

    @staticmethod
    def generate_score(levels):
        """
        Generate a score based on the log levels.
        The score is calculated as follows:
        - 100 if no logs
        - 75 if only warnings
        - 25 if any errors
        - 0 if any criticals
        """
        score = 100

        if levels.get('CRITICAL', 0) > 0:
            score = 0
        elif levels.get('ERROR', 0) > 0:
            score = 25
        elif levels.get('WARNING', 0) > 0:
            score = 75

        # Apply additional penalties for multiple occurrences
        score -= 10 * levels.get('CRITICAL', 0)
        score -= 5 * levels.get('ERROR', 0)
        score -= 2 * levels.get('WARNING', 0)

        return max(score, 0)  # Ensure score doesn't go below 0


class ExceptionEvaluator(BaseEvaluator):
    """
    An evaluator for handling exceptions.
    """

    def __init__(self, criteria: EvaluationType, **kwargs):
        super().__init__(criteria, **kwargs)

        # TODO: Support individual Agent level exception tests
        # self.agent = kwargs.get('Agent', None)

        self.caplog = kwargs.get('CAP', None)
        self.tester = LogTester()

    async def evaluate(self, actual: ConversationEvaluationRecord) -> EvaluationResult:
        """
        Evaluates the input based on the criteria set during initialization.
        :param actual: The input to be evaluated.
        :return: An EvaluationResult object with the finished evaluations.
        """

        levels = self.tester.count_log_levels(self.caplog.records)
        score = self.tester.generate_score(levels)

        return EvaluationResult(type=self.criteria, score=score,
                                reasoning="Exception Evaluation Score")
