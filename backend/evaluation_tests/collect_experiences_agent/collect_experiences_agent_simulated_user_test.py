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
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_collect_experiences_agent_simulated_user(test_case: CollectExperiencesAgentTestCase,
                                                        caplog: LogCaptureFixture,
                                                        setup_multi_locale_app_config):
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
        # Guards to ensure that the loggers are correctly set up,
        guard_caplog(logger=execute_evaluated_agent._agent._logger, caplog=caplog)

        # Run the main test
        evaluation_result: ConversationEvaluationRecord = await conversation_test_function(
            config=config
        )

        # Check if the agent completed their task
        context = await conversation_manager.get_conversation_context()
        assert context.history.turns[-1].output.finished

        # check that that experiences discovered meet the expectations
        failures = await test_case.check_expectations(execute_evaluated_agent.get_experiences())
        if len(failures) > 0:
            pytest.fail(
                '\n'.join(failures)
            )
        # We run the evaluation assertions at the end
        # as it fails often due to the unpredictability of the LLM responses
        assert_expected_evaluation_results(evaluation_result=evaluation_result, test_case=test_case)

        # Finally, check that no errors and no warning were logged
        assert_log_error_warnings(caplog=caplog, expect_errors_in_logs=False, expect_warnings_in_logs=True)
