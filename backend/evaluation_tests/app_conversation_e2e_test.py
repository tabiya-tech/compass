import pytest
from tqdm import tqdm

from app.agent.agent_types import AgentOutput, AgentInput
from app.server import conversation, get_conversation_context
from common_libs.llm.models_utils import MEDIUM_TEMPERATURE_GENERATION_CONFIG, LLMConfig
from evaluation_tests.conversation_libs import conversation_generator
from evaluation_tests.conversation_libs.conversation_test_function import EvaluationTestCase, LLMSimulatedUser
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from evaluation_tests.conversation_libs.evaluators.evaluator_builder import create_evaluator
from evaluation_tests.conversation_libs.fake_conversation_context import save_conversation
from evaluation_tests.core_e2e_tests_cases import test_cases
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


class _AppChatExecutor:
    def __init__(self, session_id: int):
        self._session_id = session_id

    async def __call__(self, agent_input: AgentInput) -> AgentOutput:
        """
        Executes the application chat route
        """
        return (await conversation(user_input=agent_input.message, session_id=self._session_id)).last


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
async def test_main_app_chat(max_iterations: int, test_case: EvaluationTestCase, common_folder_path: str):
    """
    E2E conversation test, based on the test cases specified above. It calls the same endpoint as the frontend
    would call and does not mock any of the tested components.
    """
    print(f"Running test case {test_case.name}")

    session_id = hash(test_case.name) % 10 ** 10
    evaluation_result = ConversationEvaluationRecord(simulated_user_prompt=test_case.simulated_user_prompt,
                                                     test_case=test_case.name)
    try:
        evaluation_result.add_conversation_records(
            await conversation_generator.generate(max_iterations=max_iterations,
                                                  execute_simulated_user=LLMSimulatedUser(
                                                      system_instructions=test_case.simulated_user_prompt,
                                                      llm_config=LLMConfig(
                                                          generation_config=MEDIUM_TEMPERATURE_GENERATION_CONFIG)),
                                                  execute_evaluated_agent=_AppChatExecutor(session_id=session_id),
                                                  is_finished=_AppChatIsFinished()))

        for evaluation in tqdm(test_case.evaluations, desc='Evaluating'):
            output = await create_evaluator(evaluation.type).evaluate(evaluation_result)
            evaluation_result.add_evaluation_result(output)
            print(f'Evaluation for {evaluation.type.name}: {output.score} {output.reasoning}')
            assert output.score >= evaluation.expected, f"{evaluation.type.name} expected " \
                                                        f"{evaluation.expected} actual {output.score}"

    finally:
        output_folder = common_folder_path + test_case.name
        evaluation_result.save_data(folder=output_folder, base_file_name='evaluation_record')
        context = await get_conversation_context(session_id=session_id)
        save_conversation(context, title=test_case.name, folder_path=output_folder)
