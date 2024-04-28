import asyncio
import os
from datetime import datetime, timezone

import pytest
from pydantic.main import BaseModel
from tqdm import tqdm
from vertexai.generative_models import Content

from app.conversation_memory.conversation_memory_manager import save_conversation_history_to_json, \
    save_conversation_history_to_markdown
from common_libs.llm.gemini import GeminiChatLLM, LLMConfig
from evaluation_tests.conversation_libs import conversation_generator
from evaluation_tests.conversation_libs.agent_executors import ExecuteAgentCallable, CheckAgentFinishedCallable, \
    GetConversationHistoryCallable, ExecuteSimulatedUserCallable
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


class ConversationTestConfig(BaseModel):
    """
    The configuration for the conversation test.
    """
    max_iterations: int
    test_case: EvaluationTestCase
    output_folder: str
    execute_evaluated_agent: ExecuteAgentCallable
    execute_simulated_user: ExecuteSimulatedUserCallable
    is_finished: CheckAgentFinishedCallable
    get_conversation_history: GetConversationHistoryCallable

    class Config:
        """
        Pydantic configuration.
        """
        arbitrary_types_allowed = True
        """
        Allow arbitrary types for the model as the various callables are custom types.
        """


async def conversation_test_function(*, config: ConversationTestConfig):
    """
    E2E conversation test, based on the test cases specified above. It calls the same endpoint as the frontend
    would call and does not mock any of the tested components.
    """
    print(f"Running test case {config.test_case.name}")
    evaluation_result = ConversationEvaluationRecord(simulated_user_prompt=config.test_case.simulated_user_prompt,
                                                     test_case=config.test_case.name)

    # Using GeminiChatLLM for the simulated user as we want to conduct a conversation with an in-memory state (history)
    # and not manage the history ourselves.
    evaluation_result.add_conversation_records(
        await conversation_generator.generate(max_iterations=config.max_iterations,
                                              execute_simulated_user=config.execute_simulated_user,
                                              execute_evaluated_agent=config.execute_evaluated_agent,
                                              is_finished=config.is_finished))

    for evaluation in tqdm(config.test_case.evaluations, desc='Evaluating'):
        output = await create_evaluator(evaluation.type).evaluate(evaluation_result)
        evaluation_result.add_evaluation_result(output)
        print(f'Evaluation for {evaluation.type.name}: {output.score} {output.reasoning}')

    # Save the conversation and evaluation results.
    time_now = datetime.now(timezone.utc).isoformat()
    evaluation_result.save_data(folder=config.output_folder, base_file_name=config.test_case.name + time_now)

    # Save the conversation history
    # save the internal conversation history
    history = await config.get_conversation_history()
    history_path = os.path.join(config.output_folder, config.test_case.name + '_conversation_history' + time_now)
    save_conversation_history_to_json(history, history_path + ".json")
    save_conversation_history_to_markdown("Test Case:" + config.test_case.name, history, history_path + ".md")

    # Run the actual asserts at the end, to make sure that all data is calculated/stored properly.
    assert len(evaluation_result.evaluations) == len(config.test_case.evaluations)
    for i, evaluation in enumerate(evaluation_result.evaluations):
        expected = config.test_case.evaluations[i].expected
        actual = evaluation.score
        assert actual >= expected, f"{config.test_case.evaluations[i].type.name} expected {expected} actual {actual}"


class LLMSimulatedUser:
    """
    A simulated user that uses the GeminiChatLLM.
    """

    def __init__(self, *, system_instructions: str, history: list[Content] | None = None,
                 llm_config: LLMConfig = LLMConfig()):
        """
        :param system_instructions: The system instructions to be used by the simulated user.
        :param history: An optional history to be used by the simulated user.
        :param llm_config: The configuration for the GeminiChatLLM.
        """
        self._chat = GeminiChatLLM(system_instructions=system_instructions, history=history, config=llm_config)

    async def __call__(self, turn_number: int, message_for_user: str) -> str:
        """
        :param turn_number: The turn number of the conversation.
        :param message_for_user: The message that the user should respond to.
        :return: The response from the simulated user.
        """
        return await self._chat.send_message_async(message_for_user)


class ScriptedSimulatedUser:
    """
    A simulated user that follows a script.
    """

    def __init__(self, *, script: list[str]):
        """
        :param script: The script that the simulated user should follow at each turn. It is zero-indexed.
        """
        self._script = script

    async def __call__(self, turn_number: int, message_for_user: str) -> str:
        """
        :param turn_number: The turn number of the conversation.
        :param message_for_user: The message that the user should respond to.
        :return: The response from the simulated user.
        """
        return self._script[turn_number]
