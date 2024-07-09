import logging
import os

import pytest
from _pytest.logging import LogCaptureFixture

from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from evaluation_tests.collect_experiences_agent.collect_experiences_executor import CollectExperiencesAgentExecutor, \
    CollectExperienceAgentGetConversationContextExecutor, CollectExperienceAgentIsFinished
from evaluation_tests.collect_experiences_agent.collect_experiences_test_cases import test_cases, \
    CollectExperiencesAgentTestCase
from evaluation_tests.conversation_libs.conversation_test_function import LLMSimulatedUser, \
    ConversationTestConfig, conversation_test_function


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize('test_case', test_cases,
                         ids=[case.name for case in test_cases])
async def test_collect_experiences_agent_simulated_user(max_iterations: int, test_case: CollectExperiencesAgentTestCase,
                                                        caplog: LogCaptureFixture):
    """
    Tests the welcome agent with a simulated user.
    """
    print(f"Running test case {test_case.name}")

    session_id = hash(test_case.name) % 10 ** 10
    output_folder = os.path.join(os.getcwd(), 'test_output/collect_experiences/simulated_user/', test_case.name)

    # The conversation manager for this test
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id))
    execute_evaluated_agent = CollectExperiencesAgentExecutor(conversation_manager=conversation_manager,
                                                              session_id=session_id)

    # Run the conversation test
    config = ConversationTestConfig(
        max_iterations=max_iterations,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=execute_evaluated_agent,
        execute_simulated_user=LLMSimulatedUser(system_instructions=test_case.simulated_user_prompt),
        is_finished=CollectExperienceAgentIsFinished(),
        get_conversation_context=CollectExperienceAgentGetConversationContextExecutor(
            conversation_manager=conversation_manager)
    )

    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.DEBUG):
        # Guards to ensure that the loggers are correctly setup,
        # otherwise the tests cannot be trusted that they correctly assert the absence of errors and warnings.
        guard_warning_msg = logging.getLevelName(logging.WARNING) + str(session_id)  # some random string
        execute_evaluated_agent._agent._logger.warning(guard_warning_msg)
        assert guard_warning_msg in caplog.text
        guard_error_msg = logging.getLevelName(logging.ERROR) + str(session_id)  # some random string
        execute_evaluated_agent._agent._logger.warning(guard_error_msg)
        assert guard_error_msg in caplog.text
        caplog.records.clear()

        # Run the main test
        await conversation_test_function(
            config=config
        )

        # Check if the agent completed their task
        context = await conversation_manager.get_conversation_context()
        assert context.history.turns[-1].output.finished

        # Check if the actual discovered experiences match the expected ones
        assert len(execute_evaluated_agent.get_experiences()) == test_case.expected_experiences_count

        # Finally check that no errors and no warning were logged
        for record in caplog.records:
            assert record.levelname != 'ERROR'
            assert record.levelname != 'WARNING'
