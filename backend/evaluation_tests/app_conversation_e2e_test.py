from typing import Generator, Any
from fastapi import FastAPI
from common_libs.test_utilities.setup_env_vars import setup_env_vars, teardown_env_vars

import pytest
from fastapi.testclient import TestClient
from tqdm import tqdm
import logging.config

from app.agent.agent_types import AgentOutput, AgentInput
from app.conversation_memory.conversation_memory_types import ConversationContext
from evaluation_tests.conversation_libs import conversation_generator
from evaluation_tests.conversation_libs.conversation_test_function import EvaluationTestCase, LLMSimulatedUser
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from evaluation_tests.conversation_libs.evaluators.evaluator_builder import create_evaluator
from evaluation_tests.conversation_libs.fake_conversation_context import save_conversation
from evaluation_tests.core_e2e_tests_cases import test_cases
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from httpx import AsyncClient

# Mute the logging of the httpx and httpcore
LOGGING_CONFIG = {
    "version": 1,
    'loggers': {
        'httpx': {
            'level': 'WARN',
        },
        'httpcore': {
            'level': 'WARN',
        },
    }
}

logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger()


class _AppChatExecutor:
    def __init__(self, session_id: int, app: FastAPI):
        self._session_id = session_id
        self._app = app

    async def __call__(self, agent_input: AgentInput) -> AgentOutput:
        """
        Executes the application chat route
        """
        async with AsyncClient(app=self._app, base_url="http://test") as ac:
            response = await ac.get('/poc/conversation', params={'user_input': agent_input.message,
                                                                 'session_id': self._session_id})
        return AgentOutput.model_validate(response.json()['last'])


class _AppChatIsFinished:

    def __call__(self, agent_output: AgentOutput) -> bool:
        """
        Checks if the application chat route is finished
        """
        return agent_output.finished and agent_output.agent_type is None


@pytest.fixture(autouse=True)
def app_setup_and_teardown() -> Generator[FastAPI, Any, None]:
    """
    Before loading any models, we need to set the environment variables to avoid loading them from the local environment.
    """
    setup_env_vars(env_vars={
        'VERTEX_API_REGION': 'us-central1'})
    from app.server import app
    yield app
    teardown_env_vars()


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_main_app_chat(max_iterations: int, test_case: EvaluationTestCase, common_folder_path: str, app_setup_and_teardown: FastAPI):
    """
    E2E conversation test, based on the test cases specified above. It calls the same endpoint as the frontend
    would call and does not mock any of the tested components.
    """
    print(f"Running test case {test_case.name}")
    _app = app_setup_and_teardown

    session_id = hash(test_case.name) % 10 ** 10
    evaluation_result = ConversationEvaluationRecord(simulated_user_prompt=test_case.simulated_user_prompt,
                                                     test_case=test_case.name)
    try:
        evaluation_result.add_conversation_records(
            await conversation_generator.generate(max_iterations=test_case.conversation_rounds if test_case.conversation_rounds else max_iterations,
                                                  execute_simulated_user=LLMSimulatedUser(
                                                      system_instructions=test_case.simulated_user_prompt),
                                                  execute_evaluated_agent=_AppChatExecutor(session_id=session_id, app=_app),
                                                  is_finished=_AppChatIsFinished()))

        for evaluation in tqdm(test_case.evaluations, desc='Evaluating'):
            output = await create_evaluator(evaluation.type).evaluate(evaluation_result)
            evaluation_result.add_evaluation_result(output)
            logger.info(f'Evaluation for {evaluation.type.name}: {output.score} {output.reasoning}')
            assert output.score >= evaluation.expected, f"{evaluation.type.name} expected " \
                                                        f"{evaluation.expected} actual {output.score}"
    except Exception as e:
        logger.exception(f"Error in test case {test_case.name}: {e}", exc_info=True)
    finally:
        output_folder = common_folder_path + 'e2e_test_' + test_case.name
        evaluation_result.save_data(folder=output_folder, base_file_name='evaluation_record')
        client = TestClient(_app)
        context = ConversationContext.model_validate(
            client.get("/poc/conversation_context", params={'session_id': session_id}).json())
        save_conversation(context, title=test_case.name, folder_path=output_folder)
