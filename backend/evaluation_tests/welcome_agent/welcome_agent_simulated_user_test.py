import asyncio
import os

import pytest

from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from common_libs.llm.gemini import LLMConfig, SAFETY_OFF_SETTINGS
from evaluation_tests.conversation_libs.conversation_test_function import conversation_test_function, \
    EvaluationTestCase, ConversationTestConfig, LLMSimulatedUser
from evaluation_tests.core_e2e_tests_cases import test_cases
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from evaluation_tests.welcome_agent.welcome_agent_executors import WelcomeAgentGetConversationContextExecutor, \
    WelcomeAgentIsFinished, WelcomeAgentExecutor


@pytest.fixture(scope="session")
def event_loop():
    """
    Makes sure that all the async calls finish.

    Without it, the tests sometimes fail with "Event loop is closed" error.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases), ids=[case.name for case in test_cases])
async def test_welcome_agent_simulated_user(max_iterations: int, test_case: EvaluationTestCase):
    """
    Tests the welcome agent with a simulated user.
    """
    print(f"Running test case {test_case.name}")

    session_id = hash(test_case.name) % 10 ** 10
    output_folder = os.path.join(os.getcwd(), 'test_output/welcome_agent/simulated_user/', test_case.name)

    # The conversation manager for this test
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)

    # Run the conversation test
    config = ConversationTestConfig(
        max_iterations=max_iterations,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=WelcomeAgentExecutor(conversation_manager=conversation_manager, session_id=session_id),
        execute_simulated_user=LLMSimulatedUser(system_instructions=test_case.simulated_user_prompt,
                                                llm_config=LLMConfig(safety_settings=SAFETY_OFF_SETTINGS)),
        is_finished=WelcomeAgentIsFinished(),
        get_conversation_context=WelcomeAgentGetConversationContextExecutor(conversation_manager=conversation_manager,
                                                                            session_id=session_id)
    )
    await conversation_test_function(
        config=config
    )
    # Check if the welcome agent completed their task
    context = await conversation_manager.get_conversation_context(session_id)
    assert context.history.turns[-1].output.finished
