import asyncio
import os
import sys
from textwrap import dedent

import pytest

from app.agent.agent_types import AgentOutput, AgentInput
from app.conversation_memory.conversation_memory_manager import ConversationHistory
from app.server import welcome, get_history
from evaluation_tests.conversation_libs.conversation_test_function import conversation_test_function, EvaluationTestCase, Evaluation
from evaluation_tests.conversation_libs.evaluators.evaluation_result import EvaluationType

test_cases = [
    EvaluationTestCase(
        name='kenya_student_e2e',
        simulated_user_prompt=dedent("""
            You are a young student from Kenya trying to find a job. 
            """),
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    ),
    EvaluationTestCase(
        name='genZ_student_e2e',
        simulated_user_prompt=dedent("""
            Let's put you in the shoes of Shiela! You're a Gen Z student living with your mom and three 
            brothers. Classes are mostly online for you, but you still hustle hard.  You volunteer and love teaching 
            others graphic design, transcription, the whole digital skills thing. You even help people without fancy 
            degrees get started online.
            """),
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    ),
    EvaluationTestCase(
        name='creative_writer_e2e',
        simulated_user_prompt=dedent("""
            Let's put you in the shoes of Mark. A 24-year-old writer from Mombasa... always looking for that creative 
            spark, you know?  Last year, 2023, I joined Huum Hub, and wow, what a journey! Learning, growing, the whole 
            deal. They even had this mentorship program, and before I knew it, I was working with nine guys!  It's been 
            amazing, helping others find their path, just like Huum helped me.
            """),
        evaluations=[Evaluation(type=EvaluationType.CONCISENESS, expected=70)]
    ),
]


def get_test_cases_to_run() -> list[EvaluationTestCase]:
    """
    Returns the test cases to be run. Filters to only test cases specified in a command line flag is set.
    """
    # Using sys.argv instead of pytest constructs, since this needs to be used in a fixture.
    # A fixture cannot call another fixture.
    if '--test_cases_to_run' not in sys.argv:
        return test_cases
    cases_to_run = sys.argv[sys.argv.index('--test_cases_to_run') + 1].split(',')
    return [case for case in test_cases if case.name in cases_to_run]


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


class _AppGetHistoryExecutor:
    def __init__(self, session_id: int):
        self._session_id = session_id

    async def __call__(self) -> ConversationHistory:
        """
        Returns the conversation history from the application
        """
        return await get_history(session_id=self._session_id)


class _AppChatIsFinished:

    def __call__(self, agent_output: AgentOutput) -> bool:
        """
        Checks if the application chat route is finished
        """
        return agent_output.finished and agent_output.agent_type is None


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize('test_case', get_test_cases_to_run())
async def test_main_app_chat(max_iterations: int, test_case: EvaluationTestCase):
    """
    E2E conversation test, based on the test cases specified above. It calls the same endpoint as the frontend
    would call and does not mock any of the tested components.
    """
    print(f"Running test case {test_case.name}")
    common_prompt = dedent("""
        Talk in everyday African English, like a young person would. Keep it short and sweet! Use only short, 
        easy sentences and informal language.
        """)
    test_case.simulated_user_prompt = dedent(test_case.simulated_user_prompt + common_prompt)

    session_id = hash(test_case.name) % 10 ** 10
    output_folder = os.path.join(os.path.dirname(__file__), 'test_output/e2e', test_case.name)
    await conversation_test_function(
        max_iterations=max_iterations,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=_AppChatExecutor(session_id=session_id),
        is_finished=_AppChatIsFinished(),
        get_conversation_history=_AppGetHistoryExecutor(session_id=session_id)
    )
