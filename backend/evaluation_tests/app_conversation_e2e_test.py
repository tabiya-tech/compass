import importlib
import os
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

from app.server_dependencies.db_dependencies import CompassDBProvider
from app.vector_search.validate_taxonomy_model import validate_taxonomy_model
from common_libs.test_utilities import get_random_session_id, get_random_user_id
from common_libs.test_utilities.setup_env_vars import setup_env_vars, teardown_env_vars

import pytest
from fastapi.testclient import TestClient
from tqdm import tqdm
import logging.config

from app.agent.agent_types import AgentOutput, AgentInput, AgentType
from app.conversation_memory.conversation_memory_types import ConversationContext
from evaluation_tests.conversation_libs import conversation_generator
from evaluation_tests.conversation_libs.conversation_test_function import EvaluationTestCase, LLMSimulatedUser
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from evaluation_tests.conversation_libs.evaluators.evaluator_builder import create_evaluator
from evaluation_tests.conversation_libs.fake_conversation_context import save_conversation
from evaluation_tests.core_e2e_tests_cases import test_cases
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from httpx import AsyncClient

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(name)s - %(levelname)s - %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
        },
    },
    "loggers": {
        # Mute the logging of the httpx and httpcore
        "httpx": {
            "level": "WARN",
            "handlers": ["console"],
            "propagate": False,
        },
        "httpcore": {
            "level": "WARN",
            "handlers": ["console"],
            "propagate": False,
        },
        # Mute 'foo' logger by setting the level to WARN and propagate to False
        # "foo": {
        #    "level": "WARN",
        #    "handlers": ["console"],
        #    "propagate": False,
        # },
    },
}
# The logging is configured in the pytest.ini file
# An additional config is added here to mute specific loggers
logging.config.dictConfig(LOGGING_CONFIG)
logger = logging.getLogger()


class _AppChatExecutor:
    def __init__(self, *, session_id: int, app: FastAPI, record_metrics: bool = False, user_id: str = None):
        self._session_id = session_id
        self._app = app
        self._record_metrics = record_metrics
        self._user_id = user_id

    async def __call__(self, agent_input: AgentInput) -> AgentOutput:
        """
        Executes the application chat route
        """
        async with AsyncClient(app=self._app, base_url="http://test") as ac:
            response = await ac.get('/poc/conversation', params={'user_input': agent_input.message,
                                                                 'session_id': self._session_id,
                                                                 'record_metrics': self._record_metrics,
                                                                 'user_id': self._user_id})
        if response.is_error:
            logger.error(f"Error in response: {response.text}", exc_info=True)
            raise Exception(f"Error in response: {response.text}")

        try:
            json = response.json()
            return AgentOutput.model_validate(json['last'])
        except Exception as e:
            logger.error(f"Error in response: {response.text}", exc_info=True)
            raise e


class _AppChatIsFinished:

    def __call__(self, agent_output: AgentOutput) -> bool:
        """
        Checks if the application chat route is finished
        """
        return agent_output.finished and agent_output.agent_type is AgentType.FAREWELL_AGENT


@pytest.fixture(scope="function")
def current_test_case(request) -> EvaluationTestCase:
    return request.param


@asynccontextmanager
async def app_setup_and_teardown(current_test_case: EvaluationTestCase) -> AsyncGenerator[FastAPI, None]:
    logger.info("Setting up app for test")
    setup_env_vars(env_vars={
        # Set the LOG_CONFIG_FILE to "null" so that the pytest loggers are preserved.
        # None does not work as it this will lead to the default config being used
        # The log level during the tests is declared in the pytest.ini file
        'LOG_CONFIG_FILE': "null",
        'VERTEX_API_REGION': 'us-central1',
        'DEFAULT_COUNTRY_OF_USER': current_test_case.country_of_user.value,
        # Set the path to the credentials file otherwise the app will not be able to authenticate with the GCP services
        'GOOGLE_APPLICATION_CREDENTIALS': os.getenv('GOOGLE_APPLICATION_CREDENTIALS'),
        # Set the taxonomy db env vars as they required for this test for the search service
        'TAXONOMY_MONGODB_URI': os.getenv('TAXONOMY_MONGODB_URI'),
        'TAXONOMY_DATABASE_NAME': os.getenv('TAXONOMY_DATABASE_NAME'),
        'TAXONOMY_MODEL_ID': os.getenv('TAXONOMY_MODEL_ID'),
        # Set the metrics db env vars as they will be required if the test is run with metrics
        'METRICS_MONGODB_URI': os.getenv('METRICS_MONGODB_URI'),
        'METRICS_DATABASE_NAME': os.getenv('METRICS_DATABASE_NAME'),
        'BACKEND_ENABLE_METRICS': 'False',  # set to True if you want to run the test with metrics
        # Ensure sentry is disabled for the tests
        'BACKEND_ENABLE_SENTRY': 'False',
        'EMBEDDINGS_SERVICE_NAME': os.getenv('EMBEDDINGS_SERVICE_NAME'),
        'EMBEDDINGS_MODEL_NAME':  os.getenv('EMBEDDINGS_MODEL_NAME'),
    })
    _app_server_module_name = 'app.server'
    try:
        # explicitly validate the taxonomy model id and embeddings service, as the app lifespan is not called when running the tests
        taxonomy_db = await CompassDBProvider.get_taxonomy_db()
        await validate_taxonomy_model(
            taxonomy_db=taxonomy_db,
            taxonomy_model_id=os.getenv('TAXONOMY_MODEL_ID'),
            embeddings_service_name=os.getenv('EMBEDDINGS_SERVICE_NAME'),
            embeddings_model_name=os.getenv('EMBEDDINGS_MODEL_NAME')
        )
        # Clean up modules cache before importing, to ensure that the app is reloaded with the new environment variables
        if _app_server_module_name in sys.modules:
            del sys.modules[_app_server_module_name]

        app_server = importlib.import_module(_app_server_module_name)
        app: FastAPI = app_server.app
        # Remove or replace lifespan
        if hasattr(app, 'router') and hasattr(app.router, 'lifespan_context'):
            app.router.lifespan_context = None  # or set to noop_lifespan

        yield app
    except Exception as e:
        logger.exception("Error during app setup: %s", e)
        raise  # re-raise so the test framework can see it
    finally:
        logger.info("Cleaning up after test")
        # Clean after test to avoid polluting the next one
        teardown_env_vars()
        if _app_server_module_name in sys.modules:
            del sys.modules[_app_server_module_name]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize('current_test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_main_app_chat(
        max_iterations: int,
        current_test_case: EvaluationTestCase,
        common_folder_path: str
):
    """
    E2E conversation test, based on the test cases specified above. It calls the same endpoint as the frontend
    would call and does not mock any of the tested components.
    """
    logger.info(f"Running test case {current_test_case.name}")
    async with app_setup_and_teardown(current_test_case) as _app:
        session_id = get_random_session_id()
        user_id = get_random_user_id()
        record_metrics = False  # change this value to run with or without metrics
        evaluation_result = ConversationEvaluationRecord(simulated_user_prompt=current_test_case.simulated_user_prompt,
                                                         test_case=current_test_case.name)
        try:
            evaluation_result.add_conversation_records(
                await conversation_generator.generate(
                    max_iterations=current_test_case.conversation_rounds if current_test_case.conversation_rounds else max_iterations,
                    execute_simulated_user=LLMSimulatedUser(
                        system_instructions=current_test_case.simulated_user_prompt),
                    execute_evaluated_agent=_AppChatExecutor(session_id=session_id, app=_app, user_id=user_id, record_metrics=record_metrics),
                    is_finished=_AppChatIsFinished()
                ))

            for evaluation in tqdm(current_test_case.evaluations, desc='Evaluating'):
                output = await create_evaluator(evaluation.type).evaluate(evaluation_result)
                evaluation_result.add_evaluation_result(output)
                logger.info(f'Evaluation for {evaluation.type.name}: {output.score} {output.reasoning}')
                assert output.score >= evaluation.expected, f"{evaluation.type.name} expected " \
                                                            f"{evaluation.expected} actual {output.score}"
        except Exception as e:
            logger.exception(f"Error in test case {current_test_case.name}: {e}", exc_info=True)
        finally:
            output_folder = common_folder_path + 'e2e_test_' + current_test_case.name
            evaluation_result.save_data(folder=output_folder, base_file_name='evaluation_record')
            client = TestClient(_app)
            context = ConversationContext.model_validate(
                client.get("/poc/conversation_context", params={'session_id': session_id}).json())
            save_conversation(context, title=current_test_case.name, folder_path=output_folder)
