import asyncio
import os
from datetime import datetime, timezone

import pytest
from pydantic.main import BaseModel
from tqdm import tqdm

from app.conversation_memory.conversation_memory_manager import save_conversation_history_to_json, \
    save_conversation_history_to_markdown
from common_libs.llm.gemini import GeminiChatLLM
from evaluation_tests.conversation_libs import conversation_generator
from evaluation_tests.conversation_libs.agent_executors import ExecuteAgentCallable, CheckAgentFinishedCallable, \
    GetConversationHistoryCallable
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord, EvaluationType
from evaluation_tests.conversation_libs.evaluators.evaluator_builder import create_evaluator


class Evaluation(BaseModel):
    """
    The definition of the evaluation to be run.
    """
    type: EvaluationType
    expected: int


class EvaluationTestCase(BaseModel):
    """
    The definition of the test cases to be run.
    """
    name: str
    simulated_user_prompt: str
    evaluations: list[Evaluation]


@pytest.fixture(scope="session")
def _event_loop():
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


async def conversation_test_function(*, max_iterations: int,
                                     test_case: EvaluationTestCase,
                                     output_folder: str,
                                     execute_evaluated_agent: ExecuteAgentCallable,
                                     is_finished: CheckAgentFinishedCallable,
                                     get_conversation_history: GetConversationHistoryCallable
                                     ):
    """
    E2E conversation test, based on the test cases specified above. It calls the same endpoint as the frontend
    would call and does not mock any of the tested components.
    """
    print(f"Running test case {test_case.name}")
    evaluation_result = ConversationEvaluationRecord(simulated_user_prompt=test_case.simulated_user_prompt,
                                                     test_case=test_case.name)

    # Using GeminiChatLLM for the simulated user as we want to conduct a conversation with an in-memory state (history)
    # and not manage the history ourselves.
    evaluation_result.add_conversation_records(
        await conversation_generator.generate(max_iterations,
                                              GeminiChatLLM(system_instructions=test_case.simulated_user_prompt),
                                              execute_evaluated_agent=execute_evaluated_agent,
                                              is_finished=is_finished))

    for evaluation in tqdm(test_case.evaluations, desc='Evaluating'):
        output = await create_evaluator(evaluation.type).evaluate(evaluation_result)
        evaluation_result.add_evaluation_result(output)
        print(f'Evaluation for {evaluation.type.name}: {output.score} {output.reasoning}')

    # Save the conversation and evaluation results.
    time_now = datetime.now(timezone.utc).isoformat()
    evaluation_result.save_data(folder=output_folder, base_file_name=test_case.name + time_now)

    # Save the conversation history
    # save the internal conversation history
    history = await get_conversation_history()
    history_path = os.path.join(output_folder, test_case.name + '_conversation_history' + time_now)
    save_conversation_history_to_json(history, history_path + ".json")
    save_conversation_history_to_markdown("Test Case:" + test_case.name, history, history_path + ".md")

    # Run the actual asserts at the end, to make sure that all data is calculated/stored properly.
    assert len(evaluation_result.evaluations) == len(test_case.evaluations)
    for i, evaluation in enumerate(evaluation_result.evaluations):
        expected = test_case.evaluations[i].expected
        actual = evaluation.score
        assert actual >= expected, f"{test_case.evaluations[i].type.name} expected {expected} actual {actual}"
