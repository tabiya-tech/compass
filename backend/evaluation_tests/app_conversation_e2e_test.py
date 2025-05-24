import logging.config
from typing import Awaitable

import pytest
from tqdm import tqdm

from app.agent.linking_and_ranking_pipeline import ExperiencePipelineConfig
from app.vector_search.vector_search_dependencies import SearchServices
from common_libs.test_utilities import get_random_session_id
from evaluation_tests.conversation_libs import conversation_generator
from evaluation_tests.conversation_libs.conversation_test_function import EvaluationTestCase, LLMSimulatedUser
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from evaluation_tests.conversation_libs.evaluators.evaluator_builder import create_evaluator
from evaluation_tests.conversation_libs.fake_conversation_context import save_conversation
from evaluation_tests.core_e2e_tests_cases import test_cases
from evaluation_tests.e2e_chat_executor import E2EChatExecutor
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


@pytest.fixture(scope="function")
def current_test_case(request) -> EvaluationTestCase:
    return request.param


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize('current_test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_main_app_chat(
        max_iterations: int,
        current_test_case: EvaluationTestCase,
        common_folder_path: str
        common_folder_path: str,
        setup_search_services: Awaitable[SearchServices]
):
    """
    E2E conversation test, based on the test cases specified above. It calls the same endpoint as the frontend
    would call and does not mock any of the tested components.
    """
    logger = logging.getLogger()
    logger.info(f"Running test case {current_test_case.name}")
    session_id = get_random_session_id()
    search_services = await setup_search_services
    chat_executor = E2EChatExecutor(session_id=session_id,
                                    default_country_of_user=current_test_case.country_of_user,
                                    search_services=search_services)

    evaluation_result = ConversationEvaluationRecord(simulated_user_prompt=current_test_case.simulated_user_prompt,
                                                     test_case=current_test_case.name)
    failures = []
    try:
        evaluation_result.add_conversation_records(
            await conversation_generator.generate(
                max_iterations=current_test_case.conversation_rounds if current_test_case.conversation_rounds else max_iterations,
                execute_simulated_user=LLMSimulatedUser(
                    system_instructions=current_test_case.simulated_user_prompt),
                execute_evaluated_agent=lambda agent_input: chat_executor.send_message(agent_input=agent_input),
                is_finished=lambda agent_output: chat_executor.conversation_is_complete(agent_output=agent_output),
            ))

        for evaluation in tqdm(current_test_case.evaluations, desc='Evaluating'):
            output = await create_evaluator(evaluation.type).evaluate(evaluation_result)
            evaluation_result.add_evaluation_result(output)
            logger.info(f'Evaluation for {evaluation.type.name}: {output.score} {output.reasoning}')
            if output.score < evaluation.expected:
                failures.append(f"{evaluation.type.name} expected "
                                f"{evaluation.expected} actual {output.score}")
    except Exception as e:
        logger.exception(f"Error in test case {current_test_case.name}: {e}", exc_info=True)
        failures.append(f"Error in test case {current_test_case.name}: {e}")
    finally:
        output_folder = common_folder_path + 'e2e_test_' + current_test_case.name
        evaluation_result.save_data(folder=output_folder, base_file_name='evaluation_record')
        context = await chat_executor.get_conversation_memory_manager().get_conversation_context()
        save_conversation(context, title=current_test_case.name, folder_path=output_folder)

        if failures:
            failures = "\n  - ".join(failures)
            pytest.fail(f"Test case {current_test_case.name} failed with errors: {failures}")
        else:
            logger.info(f"Test case {current_test_case.name} passed")
