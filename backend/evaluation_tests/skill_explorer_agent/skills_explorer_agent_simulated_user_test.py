import logging
import os

import pytest
from _pytest.logging import LogCaptureFixture

from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState
from app.i18n.translation_service import get_i18n_manager
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from common_libs.test_utilities import get_random_session_id
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.conversation_libs.conversation_test_function import LLMSimulatedUser, \
    ConversationTestConfig, conversation_test_function, assert_expected_evaluation_results
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from .skills_explorer_agent_executor import SkillsExplorerAgentExecutor, \
    SkillsExplorerAgentGetConversationContextExecutor, \
    SkillsExplorerAgentIsFinished
from .skills_explorer_test_cases import SkillsExplorerAgentTestCase, test_cases


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.5-flash-lite/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_skills_explorer_agent_simulated_user(max_iterations: int, test_case: SkillsExplorerAgentTestCase,
                                                    caplog: LogCaptureFixture):
    """
    Tests the skills explorer agent with a simulated user.
    """
    print(f"Running test case {test_case.name}")

    session_id = get_random_session_id()
    get_i18n_manager().set_locale(test_case.locale)
    output_folder = os.path.join(os.getcwd(), 'test_output/skills_explorer_agent/simulated_user/', test_case.name)

    # The conversation manager for this test
    given_experience = test_case.given_experience.model_copy(deep=True)  # model_copy is needed to avoid modifying the original experience between repeats
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id=session_id))
    execute_evaluated_agent = SkillsExplorerAgentExecutor(conversation_manager=conversation_manager,
                                                          state=SkillsExplorerAgentState(
                                                              session_id=session_id,
                                                              country_of_user=test_case.country_of_user,
                                                          ),
                                                          experience=given_experience)

    # Run the conversation test
    config = ConversationTestConfig(
        max_iterations=max_iterations,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=execute_evaluated_agent,
        execute_simulated_user=LLMSimulatedUser(system_instructions=test_case.simulated_user_prompt),
        is_finished=SkillsExplorerAgentIsFinished(),
        get_conversation_context=SkillsExplorerAgentGetConversationContextExecutor(
            conversation_manager=conversation_manager),
        deferred_evaluation_assertions=True  # run the evaluation assertions at the end
    )

    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.DEBUG):
        # Guards to ensure that the loggers are correctly set up
        guard_caplog(logger=execute_evaluated_agent._agent._logger, caplog=caplog)

        # Run the main test
        evaluation_result: ConversationEvaluationRecord = await conversation_test_function(
            config=config
        )

        # Check if the agent completed their task
        context = await conversation_manager.get_conversation_context()
        assert context.history.turns[-1].output.finished

        # Check if the actual discovered experiences match the expected ones
        # assert if the test_case.expected_responsibilities is a subset of the actual responsibilities
        if not set(test_case.expected_responsibilities).issubset(
                set(given_experience.responsibilities.responsibilities)):
            assert sorted(given_experience.responsibilities.responsibilities) == sorted(test_case.expected_responsibilities)

        # Finally, check that no errors and no warning were logged
        assert_log_error_warnings(caplog=caplog, expect_errors_in_logs=False, expect_warnings_in_logs=False)

    # We run the evaluation assertions at the end
    # as it fails often due to the unpredictability of the LLM responses
    assert_expected_evaluation_results(evaluation_result=evaluation_result, test_case=test_case)
