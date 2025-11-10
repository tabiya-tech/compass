import logging.config
import asyncio
from pathlib import Path
from typing import Awaitable

import pytest
from tqdm import tqdm

from app.agent.linking_and_ranking_pipeline import ExperiencePipelineConfig
from app.application_state import ApplicationStateManager, ApplicationState
from app.store.database_application_state_store import DatabaseApplicationStateStore
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.cv.service import CVUploadService
from app.users.cv.repository import UserCVRepository
from app.users.cv.test_service import MockCVCloudStorageService
from app.users.cv.utils.cv_structured_extractor import CVStructuredExperienceExtractor
from app.users.cv.utils.cv_responsibilities_extractor import CVResponsibilitiesExtractor
from app.agent.skill_explorer_agent._responsibilities_extraction_tool import _ResponsibilitiesExtractionTool
from app.vector_search.vector_search_dependencies import SearchServices
from common_libs.test_utilities import get_random_session_id
from evaluation_tests.conversation_libs import conversation_generator
from evaluation_tests.conversation_libs.conversation_test_function import LLMSimulatedUser
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from evaluation_tests.conversation_libs.evaluators.evaluator_builder import create_evaluator
from evaluation_tests.conversation_libs.fake_conversation_context import save_conversation
from evaluation_tests.core_e2e_tests_cases import cv_upload_test_cases, CVUploadE2ETestCase
from evaluation_tests.e2e_chat_executor import E2EChatExecutor
from evaluation_tests.experience_summarizer.experience_summarizer_evaluator import ExperienceSummarizerEvaluator
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


@pytest.fixture(scope="function")
def current_cv_upload_test_case(request) -> CVUploadE2ETestCase:
    return request.param


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize('current_cv_upload_test_case', get_test_cases_to_run(cv_upload_test_cases),
                         ids=[case.name for case in get_test_cases_to_run(cv_upload_test_cases)])
async def test_cv_upload_app_chat(
        max_iterations: int,
        current_cv_upload_test_case: CVUploadE2ETestCase,
        common_folder_path: str,
        setup_search_services: Awaitable[SearchServices],
        setup_application_config
):
    """
    E2E conversation test with CV upload, based on the test cases specified above. 
    It uploads a CV first (which injects state), then runs the conversation.
    It calls the same endpoint as the frontend would call and does not mock any of the tested components.
    """
    logger = logging.getLogger()
    logger.info(f"Running CV upload test case {current_cv_upload_test_case.name}")
    
    # Skip if no CV file specified
    if not current_cv_upload_test_case.cv_file_path:
        pytest.skip(f"Test case {current_cv_upload_test_case.name} has no CV file specified")
    
    session_id = get_random_session_id()
    user_id = f"test-user-{session_id}"
    
    # Load CV file
    cv_base_dir = Path(__file__).parent / "cv_parser" / "test_inputs"
    cv_file_path = cv_base_dir / current_cv_upload_test_case.cv_file_path
    if not cv_file_path.exists():
        pytest.skip(f"CV file not found: {cv_file_path}")
    
    file_bytes = cv_file_path.read_bytes()
    filename = cv_file_path.name
    
    # Setup search services
    search_services = await setup_search_services
    experience_pipeline_config = ExperiencePipelineConfig.model_validate(
        {"number_of_clusters": current_cv_upload_test_case.given_number_of_clusters,
         "number_of_top_skills_to_pick_per_cluster": current_cv_upload_test_case.given_number_of_top_skills_to_pick_per_cluster})
    logger.info(f"Experience pipeline config: {experience_pipeline_config}")
    
    # Setup ApplicationStateManager for CV upload (uses same DB as conversation will use)
    db = await CompassDBProvider.get_application_db()
    application_state_manager = ApplicationStateManager(
        store=DatabaseApplicationStateStore(db),
        default_country_of_user=current_cv_upload_test_case.country_of_user
    )
    
    # Ensure state exists for this session before CV upload
    initial_state = ApplicationState.new_state(
        session_id=session_id,
        country_of_user=current_cv_upload_test_case.country_of_user
    )
    await application_state_manager.save_state(initial_state)
    
    # Setup CV upload service with real extractors (e2e test uses real LLMs)
    user_db = await CompassDBProvider.get_userdata_db()
    cv_repository = UserCVRepository(user_db)
    cv_storage_service = MockCVCloudStorageService()
    cv_logger = logging.getLogger("CVUploadService")
    # Wire dependencies explicitly for e2e test
    tool = _ResponsibilitiesExtractionTool(cv_logger)
    resp_extractor = CVResponsibilitiesExtractor(cv_logger, tool)
    structured_extractor = CVStructuredExperienceExtractor(cv_logger, resp_extractor)
    cv_upload_service = CVUploadService(
        repository=cv_repository,
        cv_cloud_storage_service=cv_storage_service,
        application_state_manager=application_state_manager,
        structured_extractor=structured_extractor
    )
    
    # Upload CV (this will inject state)
    logger.info(f"Uploading CV: {filename}")
    upload_id = await cv_upload_service.parse_cv(
        user_id=user_id,
        file_bytes=file_bytes,
        filename=filename,
        session_id=session_id  # Use same session_id for injection
    )
    
    # Wait for CV processing pipeline to complete (including state injection)
    logger.info(f"Waiting for CV processing to complete (upload_id: {upload_id})")
    max_wait_time = 60  # seconds
    wait_interval = 0.5  # seconds
    waited = 0
    while waited < max_wait_time:
        status = await cv_upload_service.get_upload_status(user_id=user_id, upload_id=upload_id)
        if status and status.get("upload_process_state") in ["COMPLETED", "FAILED"]:
            break
        await asyncio.sleep(wait_interval)
        waited += wait_interval
    
    if status and status.get("upload_process_state") == "FAILED":
        logger.warning(f"CV upload failed: {status.get('error_detail')}")
    
    # Now create chat executor - it will create new state, so we need to load injected state
    # Load state from manager (which has injected CV data)
    injected_state = await application_state_manager.get_state(session_id)
    
    chat_executor = E2EChatExecutor(session_id=session_id,
                                    default_country_of_user=current_cv_upload_test_case.country_of_user,
                                    search_services=search_services,
                                    experience_pipeline_config=experience_pipeline_config)
    
    # Replace executor's state with injected state (sync all agent states)
    chat_executor._state = injected_state
    chat_executor._conversation_memory_manager.set_state(injected_state.conversation_memory_manager_state)
    chat_executor._agent_director.set_state(injected_state.agent_director_state)
    chat_executor._agent_director.get_welcome_agent().set_state(injected_state.welcome_agent_state)
    chat_executor._agent_director.get_explore_experiences_agent().set_state(injected_state.explore_experiences_director_state)
    chat_executor._agent_director.get_explore_experiences_agent().get_collect_experiences_agent().set_state(
        injected_state.collect_experience_state)
    chat_executor._agent_director.get_explore_experiences_agent().get_exploring_skills_agent().set_state(
        injected_state.skills_explorer_agent_state)

    evaluation_result = ConversationEvaluationRecord(simulated_user_prompt=current_cv_upload_test_case.simulated_user_prompt,
                                                     test_case=current_cv_upload_test_case.name)
    failures = []
    try:
        evaluation_result.add_conversation_records(
            await conversation_generator.generate(
                max_iterations=current_cv_upload_test_case.conversation_rounds if current_cv_upload_test_case.conversation_rounds else max_iterations,
                execute_simulated_user=LLMSimulatedUser(
                    system_instructions=current_cv_upload_test_case.simulated_user_prompt),
                execute_evaluated_agent=lambda agent_input: chat_executor.send_message(agent_input=agent_input),
                is_finished=lambda agent_output: chat_executor.conversation_is_complete(agent_output=agent_output),
            ))
        actual_experiences_explored = chat_executor.get_experiences_explored()
        
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
        expected_top_skills_count = current_cv_upload_test_case.given_number_of_clusters * current_cv_upload_test_case.given_number_of_top_skills_to_pick_per_cluster
        _passed_top_skills_count = True
        # AND that all experiences explored have a summary
        # AND that all experiences explored pass the ExperienceSummarizerEvaluator
        _passed_has_summary = True
        experience_summarizer_evaluator = ExperienceSummarizerEvaluator(current_cv_upload_test_case.country_of_user)
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

        for evaluation in tqdm(current_cv_upload_test_case.evaluations, desc='Evaluating'):
            output = await create_evaluator(evaluation.type).evaluate(evaluation_result)
            evaluation_result.add_evaluation_result(output)
            logger.info(f'Evaluation for {output.evaluator_name}: {output.score} {output.reasoning}')
            if output.score < evaluation.expected:
                failures.append(f"{output.evaluator_name} expected "
                                f"{evaluation.expected} actual {output.score}")
    except Exception as e:
        logger.exception(f"Error in test case {current_cv_upload_test_case.name}: {e}", exc_info=True)
        failures.append(f"Error in test case {current_cv_upload_test_case.name}: {e}")
    finally:
        output_folder = common_folder_path + 'e2e_test_cv_upload_' + current_cv_upload_test_case.name
        evaluation_result.save_data(folder=output_folder, base_file_name='evaluation_record')
        context = await chat_executor.get_conversation_memory_manager().get_conversation_context()
        save_conversation(context, title=current_cv_upload_test_case.name, folder_path=output_folder)

        if failures:
            failures = "\n  - ".join(failures)
            pytest.fail(f"Test case {current_cv_upload_test_case.name} failed with errors: {failures}")
        else:
            logger.info(f"Test case {current_cv_upload_test_case.name} passed")

