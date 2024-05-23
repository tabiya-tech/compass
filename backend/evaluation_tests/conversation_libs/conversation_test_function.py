import asyncio
import os
from datetime import datetime, timezone

import pytest
from pydantic.main import BaseModel
from tqdm import tqdm

from app.conversation_memory.save_conversation_context import save_conversation_context_to_json, \
    save_conversation_context_to_markdown
from common_libs.llm.models_utils import LLMConfig, LLMInput
from common_libs.llm.chat_models import GeminiChatLLM
from evaluation_tests.conversation_libs import conversation_generator
from evaluation_tests.conversation_libs.agent_executors import ExecuteAgentCallable, CheckAgentFinishedCallable, \
    ExecuteSimulatedUserCallable, GetConversationContextCallable
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


class ScriptedUserEvaluationTestCase(EvaluationTestCase):
    """
    The definition of the test cases to be run.
    """
    scripted_user: list[str]


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
    get_conversation_context: GetConversationContextCallable

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

    # Save the agent's internal conversation context
    context = await config.get_conversation_context()
    context_path = os.path.join(config.output_folder, config.test_case.name + '_conversation_context' + time_now)
    save_conversation_context_to_json(context=context, file_path=context_path + ".json")
    save_conversation_context_to_markdown(title="Test Case:" + config.test_case.name, context=context,
                                          file_path=context_path + ".md")

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

    def __init__(self, *, system_instructions: str, llm_input: LLMInput | None = None,
                 llm_config: LLMConfig = LLMConfig()):
        """
        :param system_instructions: The system instructions to be used by the simulated user.
        :param llm_input: An optional LLM input to be used by the simulated user.
        :param llm_config: The configuration for the GeminiChatLLM.
        """
        self._chat = GeminiChatLLM(system_instructions=system_instructions, llm_input=llm_input, config=llm_config)

    async def __call__(self, turn_number: int, message_for_user: str) -> str:
        """
        :param turn_number: The turn number of the conversation.
        :param message_for_user: The message that the user should respond to.
        :return: The response from the simulated user.
        """
        llm_response = await self._chat.generate_content(message_for_user)
        return llm_response.text


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
        if turn_number >= len(self._script):
            print(f"Turn number {turn_number} is out of bounds for the script.")
            return ""
        return self._script[turn_number]
