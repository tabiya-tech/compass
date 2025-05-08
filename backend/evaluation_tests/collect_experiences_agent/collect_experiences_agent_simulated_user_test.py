import logging
import os

import pytest
from _pytest.logging import LogCaptureFixture

from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from common_libs.test_utilities import get_random_session_id
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.collect_experiences_agent.collect_experiences_executor import CollectExperiencesAgentExecutor, \
    CollectExperienceAgentGetConversationContextExecutor, CollectExperienceAgentIsFinished
from evaluation_tests.collect_experiences_agent.collect_experiences_test_cases import test_cases, \
    CollectExperiencesAgentTestCase
from evaluation_tests.conversation_libs.conversation_test_function import LLMSimulatedUser, \
    ConversationTestConfig, conversation_test_function, assert_expected_evaluation_results
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_collect_experiences_agent_simulated_user(test_case: CollectExperiencesAgentTestCase,
                                                        caplog: LogCaptureFixture):
    """
    Tests the welcome agent with a simulated user.
    """
    print(f"Running test case {test_case.name}")

    session_id = get_random_session_id()
    output_folder = os.path.join(os.getcwd(), 'test_output/collect_experiences/simulated_user/', test_case.name)

    # The conversation manager for this test
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id=session_id))
    execute_evaluated_agent = CollectExperiencesAgentExecutor(conversation_manager=conversation_manager,
                                                              session_id=session_id,
                                                              country_of_user=test_case.country_of_user)
    max_iterations = 50
    # Run the conversation test
    config = ConversationTestConfig(
        max_iterations=max_iterations,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=execute_evaluated_agent,
        execute_simulated_user=LLMSimulatedUser(system_instructions=test_case.simulated_user_prompt),
        is_finished=CollectExperienceAgentIsFinished(),
        get_conversation_context=CollectExperienceAgentGetConversationContextExecutor(
            conversation_manager=conversation_manager),
        deferred_evaluation_assertions=True  # run the evaluation assertions at the end
    )

    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.DEBUG):
        # Guards to ensure that the loggers are correctly setup,
        guard_caplog(logger=execute_evaluated_agent._agent._logger, caplog=caplog)

        # Run the main test
        evaluation_result: ConversationEvaluationRecord = await conversation_test_function(
            config=config
        )

        # Check if the agent completed their task
        context = await conversation_manager.get_conversation_context()
        assert context.history.turns[-1].output.finished

        failures = []

        # Check if the actual discovered experiences match the expected ones
        failures.append(
            f"Expected at least {test_case.expected_experiences_count_min} experiences, but got {len(execute_evaluated_agent.get_experiences())}"
        ) if len(execute_evaluated_agent.get_experiences()) < test_case.expected_experiences_count_min else None
        failures.append(
            f"Expected at most {test_case.expected_experiences_count_max} experiences, but got {len(execute_evaluated_agent.get_experiences())}"
        ) if len(execute_evaluated_agent.get_experiences()) > test_case.expected_experiences_count_max else None

        # assert that the experiences are in the expected work types test_case.expected_minimum_work_types
        # build a dictionary with the work types and their counts
        actual_work_types_count = {}
        for experience in execute_evaluated_agent.get_experiences():
            work_type = experience.work_type
            if work_type in actual_work_types_count:
                actual_work_types_count[work_type] += 1
            else:
                actual_work_types_count[work_type] = 1

        # check that the actual work types are in the expected work types
        for expected_work_type, expected_min_max_count in test_case.expected_work_types.items():
            expected_minimum_count = expected_min_max_count[0]
            expected_maximum_count = expected_min_max_count[1]
            actual_work_type_count = actual_work_types_count.get(expected_work_type, 0)
            failures.append(
                f"Expected at least {expected_minimum_count} experiences of type {expected_work_type}, but got {actual_work_type_count}"
            ) if actual_work_type_count < expected_minimum_count else None
            failures.append(
                f"Expected at most {expected_maximum_count} experiences of type {expected_work_type}, but got {actual_work_type_count}"
            ) if actual_work_type_count > expected_maximum_count else None
        if len(failures) > 0:
            pytest.fail(
                '\n'.join(failures)
            )

        # We run the evaluation assertions at the end
        # as it fails often due to the unpredictability of the LLM responses
        assert_expected_evaluation_results(evaluation_result=evaluation_result, test_case=test_case)

        # Finally, check that no errors and no warning were logged
        assert_log_error_warnings(caplog=caplog, expect_errors_in_logs=False, expect_warnings_in_logs=True)
