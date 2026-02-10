import asyncio
import logging
import os

import pytest

from app.agent.welcome_agent import WelcomeAgentState
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from common_libs.test_utilities import get_random_session_id
from common_libs.test_utilities.guard_caplog import guard_caplog
from evaluation_tests.conversation_libs.conversation_test_function import conversation_test_function, \
    Evaluation, ConversationTestConfig, ScriptedUserEvaluationTestCase, \
    ScriptedSimulatedUser
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationType
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from evaluation_tests.welcome_agent.welcome_agent_executors import WelcomeAgentExecutor, WelcomeAgentIsFinished, \
    WelcomeAgentGetConversationContextExecutor

test_cases = [
    ScriptedUserEvaluationTestCase(
        name='user_say_yes_to_start',
        simulated_user_prompt="Scripted user: Just says yes",
        scripted_user=[
            "yes"
        ],
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=90)]
    ),
    ScriptedUserEvaluationTestCase(
        name='user_eager_to_start_1',
        simulated_user_prompt="Scripted user: Just says Let's start",
        scripted_user=[
            "Let's start"  # Expect to complete the conversation
        ],
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=90)]
    ),
    ScriptedUserEvaluationTestCase(
        name='user_eager_to_start_2',
        simulated_user_prompt="Scripted user: Just says Ok, let's start",
        scripted_user=[
            "Ok, let's start"  # Expect to complete the conversation
        ],
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=80)]
    ),
    ScriptedUserEvaluationTestCase(
        name='user_asks_irrelevant_questions',
        simulated_user_prompt="Scripted user: user asks irrelevant questions",
        scripted_user=[
            "How is the weather?",
            "What is the time?",
            "What is your name?",
            "Do you cook food?",
            "Can we build a house?",
            "Yes, let's start"  # Expect to complete the conversation
        ],
        evaluations=[]
    ),
    ScriptedUserEvaluationTestCase(
        name='user_asks_questions',
        simulated_user_prompt="Scripted user: user asks questions about the process",
        scripted_user=[
            "Tell me how this process works?",
            "What do i have to do?",
            "What happens at the end?",
            "What if I am unable to complete the process?",
            "What if I get interrupted?",
            "Ok, let's start"  # Expect to complete the conversation
        ],
        evaluations=[]
    ),

    ScriptedUserEvaluationTestCase(
        name='user_delays_questions',
        simulated_user_prompt="Scripted user: user is uncertain and asks various questions",
        scripted_user=[
            "Tell me how this process works?",
            "What do i have to do?",
            "What happens at the end?",
            "How does the process start?",
            "What if I am unable to complete the process?",
            "I am still not sure, can you explain again?",
            "What if I don't understand the process?",
            "What if I don't like the process?",
            "Let's begin"  # Expect to complete the conversation
        ],
        evaluations=[]
    ),
    ScriptedUserEvaluationTestCase(
        name='user_shares_experience',
        simulated_user_prompt="Scripted user: user shares an experience during the introduction",
        scripted_user=[
            "Worked at a Kenya organization",  # Expect to complete the conversation
        ],
        evaluations=[]
    ),
    ScriptedUserEvaluationTestCase(
        name='user_asks_for_a_cv',
        simulated_user_prompt="Scripted user: user asks for a CV during the introduction",
        scripted_user=[
            "Generate a CV",  # Expect to complete the conversation
        ],
        evaluations=[]
    ),
]


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
@pytest.mark.evaluation_test("gemini-2.5-flash-lite/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_welcome_agent_scripted_user(max_iterations: int,
                                           test_case: ScriptedUserEvaluationTestCase, caplog):
    """
    Conversation test, based on a scripted user.
    Asserts that the welcome agent is able to complete the conversation.

    :param max_iterations: Is not used in this test,
    as the agent is expected to complete the conversation at the last input from the user
    :return:
    """
    print(f"Running test case {test_case.name}")

    session_id = get_random_session_id()
    output_folder = os.path.join(os.getcwd(), 'test_output/welcome_agent/scripted', test_case.name)

    # The conversation manager for this test
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id=session_id))
    welcome_agent_state = WelcomeAgentState(
        session_id=session_id,
        is_first_encounter=True,
        user_started_discovery=False,
        country_of_user=test_case.country_of_user
    )
    execute_evaluated_agent = WelcomeAgentExecutor(state=welcome_agent_state, conversation_manager=conversation_manager)

    # Run the conversation test
    config = ConversationTestConfig(
        # Ignoring max_iterations, The agent is expected to complete the conversation at the last input from the user
        max_iterations=len(test_case.scripted_user) + 1,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=execute_evaluated_agent,
        execute_simulated_user=ScriptedSimulatedUser(script=test_case.scripted_user),
        is_finished=WelcomeAgentIsFinished(),
        get_conversation_context=WelcomeAgentGetConversationContextExecutor(conversation_manager=conversation_manager)
    )
    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.INFO):
        guard_caplog(execute_evaluated_agent._agent._logger, caplog)

        # Run the main test
        await conversation_test_function(
            config=config
        )

        # Check if the welcome agent completed their task
        context = await conversation_manager.get_conversation_context()
        assert context.history.turns[-1].output.finished
        assert context.history.turns[-1].index == len(test_case.scripted_user) + 1

        # Check that no errors and no warning were logged
        for record in caplog.records:
            assert record.levelname != 'ERROR'
            assert record.levelname != 'WARNING'
