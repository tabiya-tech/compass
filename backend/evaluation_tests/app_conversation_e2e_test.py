import asyncio
import logging.config
from typing import Awaitable

import pytest
from tqdm import tqdm

from app.agent.linking_and_ranking_pipeline import ExperiencePipelineConfig
from app.context_vars import language_ctx_var
from app.store.json_application_state_store import JSONApplicationStateStore
from app.store.markdown_conversation_state_store import MarkdownConversationStateStore
from app.vector_search.vector_search_dependencies import SearchServices
from common_libs.test_utilities import get_random_session_id
from evaluation_tests.conversation_libs import conversation_generator
from evaluation_tests.conversation_libs.conversation_test_function import LLMSimulatedUser
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from evaluation_tests.conversation_libs.evaluators.evaluator_builder import create_evaluator
from evaluation_tests.conversation_libs.fake_conversation_context import save_conversation
from evaluation_tests.core_e2e_tests_cases import test_cases, E2ESpecificTestCase, E2ETestCase
from evaluation_tests.e2e_chat_executor import E2EChatExecutor
from evaluation_tests.experience_summarizer.experience_summarizer_evaluator import ExperienceSummarizerEvaluator
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


@pytest.fixture(scope="function")
def current_test_case(request) -> E2ETestCase:
    return request.param


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(2)
@pytest.mark.parametrize('current_test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_main_app_chat(
        max_iterations: int,
        current_test_case: E2ETestCase | E2ESpecificTestCase,
        common_folder_path: str,
        setup_search_services: Awaitable[SearchServices]
):
    # set the default language of the user
    if hasattr(current_test_case, "language"):
        language_ctx_var.set(current_test_case.language)

    """
    E2E conversation test, based on the test cases specified above. It calls the same endpoint as the frontend
    would call and does not mock any of the tested components.
    """
    logger = logging.getLogger()
    logger.info(f"Running test case {current_test_case.name}")
    session_id = get_random_session_id()
    search_services = await setup_search_services
    experience_pipeline_config = ExperiencePipelineConfig.model_validate(
        {"number_of_clusters": current_test_case.given_number_of_clusters,
         "number_of_top_skills_to_pick_per_cluster": current_test_case.given_number_of_top_skills_to_pick_per_cluster})
    logger.info(f"Experience pipeline config: {experience_pipeline_config}")
    chat_executor = E2EChatExecutor(session_id=session_id,
                                    default_country_of_user=current_test_case.country_of_user,
                                    search_services=search_services,
                                    experience_pipeline_config=experience_pipeline_config)

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
        actual_experiences_explored = chat_executor.get_experiences_explored()
        if isinstance(current_test_case, E2ESpecificTestCase):
            # Check if the actual discovered experiences match the expected ones
            _failures = await current_test_case.check_expectations(actual_experiences_explored)
            if _failures:
                failures.extend(_failures)
            else:
                logger.info(f"Test case {current_test_case.name} passed the experiences expectations check.")

        # Assert that at least one experience has been explored,
        if not chat_executor.get_experiences_explored():
            failures.append("No experiences were explored during the conversation.")
        else:
            logger.info(f"Experiences successfully explored: {len(actual_experiences_explored)}")

        # Assert that all experiences discovered have been explored
        actual_experiences_discovered = chat_executor.get_experiences_discovered()
        if not actual_experiences_discovered:
            failures.append("No experiences were discovered during the conversation.")
        else:
            logger.info(f"Experiences successfully discovered: {len(actual_experiences_discovered)}")

        # Assert that the discovered experiences match the explored ones
        uuids_discovered = {exp.uuid for exp in actual_experiences_discovered}
        uuids_explored = {exp.uuid for exp in actual_experiences_explored}
        diff = uuids_discovered.symmetric_difference(uuids_explored)
        if diff:
            failures.append(f"Discovered experiences {uuids_discovered} do not match explored experiences {uuids_explored}."
                            f" - Difference: {diff}")
        else:
            logger.info("Discovered experiences match explored experiences.")

        # Assert that all experiences explored have at least the expected number of top skills explored
        expected_top_skills_count = current_test_case.given_number_of_clusters * current_test_case.given_number_of_top_skills_to_pick_per_cluster
        _passed_top_skills_count = True
        # AND that all experiences explored have a summary
        # AND that all experiences explored pass the ExperienceSummarizerEvaluator
        _passed_has_summary = True
        experience_summarizer_evaluator = ExperienceSummarizerEvaluator(current_test_case.country_of_user)
        for experience in actual_experiences_explored:
            if not experience.summary:
                _passed_has_summary = False
                failures.append(f"Experience {experience.experience_title} has no summary.")
            if not experience.top_skills:
                _passed_top_skills_count = False
                failures.append(f"Experience {experience.experience_title} has no skills explored.")
            elif len(experience.top_skills) < expected_top_skills_count:
                _passed_top_skills_count = False
                failures.append(f"Experience {experience.experience_title} "
                                f"has less than {expected_top_skills_count} skills explored: {len(experience.top_skills)}")
            eval_result = await experience_summarizer_evaluator.evaluate(
                experience_title=experience.experience_title,
                company=experience.company,
                work_type=experience.work_type,
                responsibilities=experience.responsibilities.responsibilities,
                top_skills=experience.top_skills,
                questions_and_answers=experience.questions_and_answers,
                llm_summary=experience.summary
            )
            evaluation_result.add_evaluation_result(eval_result)
            logger.info(f'Evaluation for {eval_result.evaluator_name}: {eval_result.score} {eval_result.reasoning}')
            if not eval_result.meets_requirements:
                failures.append(f"Experience {experience.experience_title} failed the summarization evaluation: "
                                f"{eval_result.reasoning}")

        if _passed_has_summary:
            logger.info(f"All experiences explored have a summary.")

        if _passed_top_skills_count:
            logger.info(f"All experiences explored have at least {expected_top_skills_count} skills explored.")

        for evaluation in tqdm(current_test_case.evaluations, desc='Evaluating'):
            output = await create_evaluator(evaluation.type).evaluate(evaluation_result)
            evaluation_result.add_evaluation_result(output)
            logger.info(f'Evaluation for {output.evaluator_name}: {output.score} {output.reasoning}')
            if output.score < evaluation.expected:
                failures.append(f"{output.evaluator_name} expected "
                                f"{evaluation.expected} actual {output.score}")
    except Exception as e:
        logger.exception(f"Error in test case {current_test_case.name}: {e}", exc_info=True)
        failures.append(f"Error in test case {current_test_case.name}: {e}")
    finally:
        output_folder = common_folder_path + 'e2e_test_' + current_test_case.name
        evaluation_result.save_data(folder=output_folder, base_file_name='evaluation_record')
        context = await chat_executor.get_conversation_memory_manager().get_conversation_context()
        save_conversation(context, title=current_test_case.name, folder_path=output_folder)


        _savers = [
            # Save the conversation state in MD format to the output file path
            MarkdownConversationStateStore(output_folder),

            # Save the conversation state in JSON format to the output file path
            JSONApplicationStateStore(output_folder)
        ]

        application_state = chat_executor.get_application_state()
        await asyncio.gather(*[saver.save_state(application_state) for saver in _savers])

        if failures:
            failures = "\n  - ".join(failures)
            pytest.fail(f"Test case {current_test_case.name} failed with errors: {failures}")
        else:
            logger.info(f"Test case {current_test_case.name} passed")
