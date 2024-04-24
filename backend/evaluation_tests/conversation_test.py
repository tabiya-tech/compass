import asyncio
import json
import os
import sys
from datetime import timezone, datetime
from textwrap import dedent
from typing import Callable, TextIO, TypedDict, Tuple

import pytest
from tqdm import tqdm

from app.server import welcome
from common_libs.llm.gemini import GeminiChatLLM
from evaluation_tests.evaluators.evaluation_result import TestEvaluationRecord, ConversationRecord, Actor, \
    EvaluationType
from evaluation_tests.evaluators.evaluator_builder import create_evaluator


class EvaluationTestCase(TypedDict):
    """
    The definition of the test cases to be run.
    """
    name: str
    context: str
    evaluations: list[Tuple[EvaluationType, int]]


test_cases = [
    {
        'name': 'kenya_student_e2e',
        'context': """
            You are a young student from Kenya trying to find a job. 
            """,
        'evaluations': [(EvaluationType.CONCISENESS, 70)]
    },
    {
        'name': 'genz_student_e2e',
        'context': """
            Let's put you in the shoes of Shiela! You're a Gen Z student living with your mom and three 
            brothers. Classes are mostly online for you, but you still hustle hard.  You volunteer and love teaching 
            others graphic design, transcription, the whole digital skills thing. You even help people without fancy 
            degrees get started online.
            """,
        'evaluations': [(EvaluationType.CONCISENESS, 70)]
    },
    {
        'name': 'creative_writer_e2e',
        'context': """
            Let's put you in the shoes of Mark. A 24-year-old writer from Mombasa... always looking for that creative 
            spark, you know?  Last year, 2023, I joined Huum Hub, and wow, what a journey! Learning, growing, the whole 
            deal. They even had this mentorship program, and before I knew it, I was working with nine guys!  It's been 
            amazing, helping others find their path, just like Huum helped me.
            """,
        'evaluations': [(EvaluationType.CONCISENESS, 70)]
    }
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
    return [case for case in test_cases if case['name'] in cases_to_run]


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
@pytest.mark.parametrize('test_case', get_test_cases_to_run())
async def test_conversation(max_iterations: int, test_case: EvaluationTestCase):
    """
    E2E conversation test, based on the test cases specified above. It calls the same endpoint as the frontend
    would call and does not mock any of the tested components.
    """
    print(f"Running test case {test_case['name']}")
    common_prompt = """
        Talk in everyday African English, like a young person would. Keep it short and sweet! Use only short, 
        easy sentences and informal language.
        """
    prompt = dedent(test_case['context'] + common_prompt)

    # Using GeminiChatLLM for the simulated user as we want to conduct a conversation with an in-memory state (history)
    # and not manage the history ourselves.
    simulated_user = GeminiChatLLM(system_instructions=prompt)
    evaluation_result = TestEvaluationRecord(simulated_user_prompt=prompt, test_case=test_case['name'])
    user_output = ""

    for i in tqdm(range(0, max_iterations), desc='Conversation progress'):
        # Get a response from the evaluated agent
        agent_output = await welcome(user_input=user_output, session_id=hash(test_case['name']) % 10 ** 10)
        agent_message = agent_output.last.message_for_user
        # Checks whether the chatbot is done. This is very implementation specific. We might want to change the API
        # moving forward.
        is_finished = agent_output.last.finished and agent_output.last.agent_type is None
        if is_finished:
            print(f'Conversation finished earlier, after {i} out of {max_iterations} iterations.')
            break
        evaluation_result.add_conversation_record(
            ConversationRecord(message=agent_message, actor=Actor.EVALUATED_AGENT))
        # Get a response from the simulated user
        user_output = simulated_user.send_message(agent_message)
        evaluation_result.add_conversation_record(
            ConversationRecord(message=user_output, actor=Actor.SIMULATED_USER))

    for evaluation, _ in tqdm(test_case['evaluations'], desc='Evaluating'):
        output = await create_evaluator(evaluation).evaluate(evaluation_result)
        evaluation_result.add_evaluation_result(output)
        print(f'Evaluation for {evaluation.name}: {output.score} {output.reasoning}')

    _save_data(test_case, evaluation_result)

    # Run the actual asserts at the end, to make sure that all data is calculated/stored properly.
    assert len(evaluation_result.evaluations) == len(test_case['evaluations'])
    for i, evaluation in enumerate(evaluation_result.evaluations):
        expected = test_case['evaluations'][i][1]
        actual = evaluation.score
        assert actual >= expected, f"{test_case['evaluations'][i][0].name} expected {expected} actual {actual}"


def _save_data(test_case: EvaluationTestCase, evaluation_result: TestEvaluationRecord):
    base_path = os.path.dirname(__file__) + '/test_output/' + test_case['name'] + "_" + datetime.now(
        timezone.utc).isoformat()
    print(f'The full conversation and evaluation is saved at {base_path}')
    # Save the evaluation result to a json file
    _save_to_file(base_path + '.json',
                  lambda f: json.dump(json.loads(evaluation_result.to_json()), f, ensure_ascii=False, indent=4))
    # Save the evaluation result to a markdown file
    _save_to_file(base_path + '.md', lambda f: f.write(evaluation_result.to_markdown()))


def _save_to_file(file_path: str, callback: Callable[[TextIO], None]):
    """
    Save contents to a file.
    :param file_path: The path to the file, including the file name. If the paths do not exist, they will be created.
    :param callback: A callback function that should be called to write the content to the file.
    """
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        callback(f)
