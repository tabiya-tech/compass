import asyncio
import json
import os
import sys
from datetime import timezone, datetime
from textwrap import dedent
from typing import Callable, TextIO, TypedDict

import pytest
from dotenv import load_dotenv
from tqdm import tqdm

from common_libs.llm.gemini import GeminiChatLLM
from app.server import welcome
from evaluation_tests.evaluators.evaluation_result import TestEvaluationRecord, ConversationRecord, Actor, \
    EvaluationType
from evaluation_tests.evaluators.evaluator_builder import create_evaluator


class EvaluationTestCase(TypedDict):
    """
    The definition of the test cases to be run.
    """
    name: str
    context: str
    evaluations: list[EvaluationType]


# TODO: We might want to change evaluations to (criteria, expected_value) once the evaluators are more stable.
test_cases = [
    {
        'name': 'kenya_student_e2e',
        'context': """
            You are a young student from Kenya trying to find a job.
            """,
        'evaluations': [EvaluationType.CONCISENESS]
    },
    {
        'name': 'genz_student_e2e',
        'context': """
            Pretend to be Shiela. She is a Gen Z, living with her mother and three siblings, balancing her roles as a 
            student and mentor, with most of her classes being conducted online. She highlighted the importance of 
            online learning in providing flexibility and convenience in her education, allowing her to engage in 
            mentorship activities while pursuing her studies. Additionally, she emphasised the significance of 
            networking opportunities and practical experience gained through her involvement in organisations like 
            Swahili Pot. She actively trains youths in graphic design, transcription, and website development and 
            helps them on online platforms. She is also part of Huum, where she provides training to people who may 
            not have traditional educational qualifications but are keen on acquiring digital skills. She is 
            dedicated to sharing her knowledge and skills with others, empowering youths and providing opportunities 
            to enhance their professional capabilities.
            """,
        'evaluations': [EvaluationType.CONCISENESS]
    },
    {
        'name': 'creative_writer_e2e',
        'context': """
            Pretend to be Mark. He is a 24-year-old creative writer residing in Mombasa, Kenya. In 2023, 
            he joined Huum Hub, embarking on a transformative “journey of self-discovery” and career 
            exploration. As a volunteer at Huum, he delved into various opportunities to learn and grow, 
            eventually becoming a mentor with nine mentees. His involvement in the mentorship programme and 
            dedication to guiding others reflect his commitment to personal development and making a positive impact 
            within his community. Through his experiences at Huum, He has demonstrated a 
            passion for learning, a drive for self-improvement, and a desire to support and inspire those around him.
            """,
        'evaluations': [EvaluationType.CONCISENESS]
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
@pytest.mark.evaluation_tests
@pytest.mark.parametrize('test_case', get_test_cases_to_run())
async def test_conversation(max_iterations: int, test_case: EvaluationTestCase):
    """
    E2E conversation test, based on the test cases specified above. It calls the same endpoint as the frontend
    would call and does not mock any of the tested components.
    """
    print(f"Running test case {test_case['name']}")
    load_dotenv()
    common_prompt = """
        Make your responses specific and make sure to only act as the person you are pretending to be.
        Your responses should be concise and precise and you should never go out of character. You should talk like a
        human and make sure to answer only to the specific questions you are asked. Answer like that character would. 
        Be concise. Don't use bullet point lists, subheadings or numbered lists in your answers. Don't add context in 
        brackets, don't use ## in your answers. Your answers should be at most 10 sentences long. Don't use placeholders, 
        instead make up something. Try to make the conversation flow naturally.
        """
    prompt = dedent(test_case['context'] + common_prompt)
    # Using GeminiChatLLM for the simulated user as we want to conduct a conversation with an in-memory state (history)
    # and not manage the history ourselves.
    simulated_user = GeminiChatLLM(system_instructions=prompt)
    evaluation_result = TestEvaluationRecord(simulated_user_prompt=prompt, test_case=test_case['name'])
    user_output = ""

    for i in tqdm(range(0, max_iterations), desc='Conversation progress'):
        # Get a response from the evaluated agent
        agent_output = await welcome(user_input=user_output, session_id=(hash(test_case['name']) % 10 ** 10))
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
    evaluators = [create_evaluator(evaluation) for evaluation in test_case['evaluations']]
    for evaluator in tqdm(evaluators, desc='Evaluating'):
        evaluation_result.add_evaluation_result(await evaluator.evaluate(evaluation_result))
    for evaluation in evaluation_result.evaluations:
        # TODO: Add evaluation score once we properly parse it.
        print(f'Evaluation for {evaluation.type.name}: {evaluation.reasoning}')
    base_path = os.path.dirname(__file__) + '/test_output/' + test_case['name'] + "_" + datetime.now(
        timezone.utc).isoformat()
    print(f'The full conversation and evaluation is saved at {base_path}')
    # Save the evaluation result to a json file
    save_to_file(base_path + '.json',
                 lambda f: json.dump(json.loads(evaluation_result.to_json()), f, ensure_ascii=False, indent=4))
    # Save the evaluation result to a markdown file
    save_to_file(base_path + '.md', lambda f: f.write(evaluation_result.to_markdown()))


def save_to_file(file_path: str, callback: Callable[[TextIO], None]):
    """
    Save contents to a file.
    :param file_path: The path to the file, including the file name. If the paths do not exist, they will be created.
    :param callback: A callback function that should be called to write the content to the file.
    """
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        callback(f)
