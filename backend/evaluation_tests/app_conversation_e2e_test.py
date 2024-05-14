import asyncio
import os

import pytest

from app.agent.agent_types import AgentOutput, AgentInput
from app.conversation_memory.conversation_memory_types import ConversationContext
from app.server import welcome, get_conversation_context
from common_libs.llm.gemini import LLMConfig, SAFETY_OFF_SETTINGS, \
    MEDIUM_TEMPERATURE_GENERATION_CONFIG
from evaluation_tests.conversation_libs.conversation_test_function import conversation_test_function, \
    EvaluationTestCase, LLMSimulatedUser, ConversationTestConfig
from evaluation_tests.core_e2e_tests_cases import test_cases
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


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


class _AppChatExecutor:
    def __init__(self, session_id: int):
        self._session_id = session_id

    async def __call__(self, agent_input: AgentInput) -> AgentOutput:
        """
        Executes the application chat route
        """
        return (await welcome(user_input=agent_input.message, session_id=self._session_id)).last


class _AppGetConversationContextExecutor:
    def __init__(self, session_id: int):
        self._session_id = session_id

    async def __call__(self) -> ConversationContext:
        """
        Returns the conversation context from the application
        """
        return await get_conversation_context(session_id=self._session_id)


class _AppChatIsFinished:

    def __call__(self, agent_output: AgentOutput) -> bool:
        """
        Checks if the application chat route is finished
        """
        return agent_output.finished and agent_output.agent_type is None


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_main_app_chat(max_iterations: int, test_case: EvaluationTestCase):
    """
    E2E conversation test, based on the test cases specified above. It calls the same endpoint as the frontend
    would call and does not mock any of the tested components.
    """
    print(f"Running test case {test_case.name}")

    session_id = hash(test_case.name) % 10 ** 10
    output_folder = os.path.join(os.getcwd(), 'test_output/app_e2e', test_case.name)
    await conversation_test_function(
        config=ConversationTestConfig(
            max_iterations=max_iterations,
            test_case=test_case,
            output_folder=output_folder,
            execute_evaluated_agent=_AppChatExecutor(session_id=session_id),
            execute_simulated_user=LLMSimulatedUser(system_instructions=test_case.simulated_user_prompt,
                                                    llm_config=LLMConfig(
                                                        generation_config=MEDIUM_TEMPERATURE_GENERATION_CONFIG,
                                                        safety_settings=SAFETY_OFF_SETTINGS)),
            is_finished=_AppChatIsFinished(),
            get_conversation_context=_AppGetConversationContextExecutor(session_id=session_id)
        )
    )
