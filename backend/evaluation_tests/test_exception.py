import pytest
import logging
import sys
from textwrap import dedent
from common_libs.llm.gemini import GeminiChatLLM
from evaluation_tests.conversation_libs import conversation_generator
from evaluation_tests.conversation_libs.evaluators.exception_evaluator import ExceptionEvaluator
from evaluation_tests.app_conversation_e2e_test import _AppChatExecutor, _AppChatIsFinished
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord, EvaluationType
from evaluation_tests.conversation_libs.conversation_test_function import EvaluationTestCase, Evaluation

test_cases = [
    EvaluationTestCase(
        name='kenya_student_e2e',
        simulated_user_prompt=dedent("""
            You are a young student from Kenya trying to find a job. 
            """),
        evaluations=[Evaluation(type=EvaluationType.EXCEPTION, expected=70)]
    )]


def get_test_cases_to_run(test_cases) -> list[EvaluationTestCase]:
    """
    Returns the test cases to be run. Filters to only test cases specified in a command line flag is set.
    """
    # Using sys.argv instead of pytest constructs, since this needs to be used in a fixture.
    # A fixture cannot call another fixture.
    if '--test_cases_to_run' not in sys.argv:
        return test_cases
    cases_to_run = sys.argv[sys.argv.index('--test_cases_to_run') + 1].split(',')
    return [case for case in test_cases if case.name in cases_to_run]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases))
async def test_exception_app_level(max_iterations: 5, test_case: EvaluationTestCase, caplog):

    evaluator = ExceptionEvaluator(EvaluationType.EXCEPTION, CAP=caplog)

    common_prompt = dedent("""
            Talk in everyday African English, like a young person would. Keep it short and sweet! Use only short, 
            easy sentences and informal language.
            """)
    test_case.simulated_user_prompt = dedent(test_case.simulated_user_prompt + common_prompt)
    print(test_case.simulated_user_prompt)
    evaluation_result = ConversationEvaluationRecord(simulated_user_prompt=test_case.simulated_user_prompt,
                                                     test_case=test_case.name)

    # Using GeminiChatLLM for the simulated user as we want to conduct a conversation with an in-memory state (history)
    # and not manage the history ourselves.
    session_id = hash(test_case.name) % 10 ** 10
    evaluation_result.add_conversation_records(
        await conversation_generator.generate(max_iterations,
                                              GeminiChatLLM(system_instructions=test_case.simulated_user_prompt),
                                              execute_evaluated_agent=_AppChatExecutor(session_id=session_id),
                                              is_finished=_AppChatIsFinished()))

    result = await evaluator.evaluate(evaluation_result)
    assert result.score > 75



