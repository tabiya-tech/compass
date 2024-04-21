import json
import os
import pprint

from datetime import timezone, datetime
from textwrap import dedent
from typing import Callable, TextIO

import pytest
import vertexai
from dotenv import load_dotenv
from tqdm import tqdm
from vertexai.generative_models import GenerativeModel

from app.server import welcome
from evaluation_tests.evaluators.evaluation_result import TestEvaluationRecord, ConversationRecord, Actor, \
    EvaluationType
from evaluation_tests.evaluators.criteria_evaluator import CriteriaEvaluator


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_conversation():
    """Test for CONCISENESS: 'young student from Kenya trying to find a job'"""
    load_dotenv()
    test_case = "e2e_test"
    prompt = dedent("""
        You are a young student from Kenya trying to find a job.
        Make your responses specific and make sure to only act as the student. 
        Your responses should be concise and precise and you should never go out of character. You should talk like a
        human and make sure to answer only to the specific questions you are asked. Answer like a human would answer chat
        messages, answer only what the student would write. Don't use placeholders, instead make up something.
        """)
    vertexai.init()
    model = GenerativeModel(
        "gemini-1.0-pro",
        system_instruction=[prompt])
    simulated_user = model.start_chat()
    evaluation_result = TestEvaluationRecord(simulated_user_prompt=prompt, test_case=test_case)
    user_output = ""

    # TODO(kingam): Also finish the conversation when Compass is done.
    for _ in tqdm(range(0, 5), desc="Conversation progress"):
        # Get a response from the evaluated agent
        agent_output = (await welcome(user_input=user_output)).last.message_for_user
        evaluation_result.add_conversation_record(
            ConversationRecord(message=agent_output, actor=Actor.EVALUATED_AGENT))
        # Get a response from the simulated user
        user_output = simulated_user.send_message(agent_output, stream=False).text
        evaluation_result.add_conversation_record(
            ConversationRecord(message=user_output, actor=Actor.SIMULATED_USER))

    evaluators = [CriteriaEvaluator(EvaluationType.CONCISENESS, evaluation_result)]
    for evaluator in tqdm(evaluators, desc="Evaluating"):
        evaluation_result.add_evaluation_result(await evaluator.evaluate())
    # TODO(kingam):  From Apostolos: I would suggest to print here a summary of the evaluation results.
    #  Currently much information is printed in the console. I found it more useful to see the progress
    #  of the conversation as it take long and I am not sure when it will finish.
    pprint.pprint(json.loads(evaluation_result.to_json()), indent=4)
    base_path = os.path.dirname(__file__) + "/test_output/" + test_case + "_" + datetime.now(timezone.utc).isoformat()
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
