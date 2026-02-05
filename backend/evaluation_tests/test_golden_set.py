"""
Golden Test Set Runner

This module contains the pytest test runner for the golden test set.
It runs the 7 representative test cases and validates quality/performance metrics.

Usage:
    # Run all golden tests
    pytest -m "golden_test" evaluation_tests/test_golden_set.py
    
    # Run with repetitions
    pytest -m "golden_test" --repeat 3 evaluation_tests/test_golden_set.py
    
    # Run specific test
    pytest -k "golden_simple_formal_employment" evaluation_tests/test_golden_set.py
    
    # Run and generate report
    pytest -m "golden_test" --html=golden_test_report.html evaluation_tests/test_golden_set.py
"""

import logging
from pathlib import Path
import pytest
from typing import Awaitable

from app.agent.linking_and_ranking_pipeline import ExperiencePipelineConfig
from app.i18n.translation_service import get_i18n_manager
from app.vector_search.vector_search_dependencies import SearchServices
from common_libs.test_utilities import get_random_session_id
from evaluation_tests.baseline_metrics_collector import BaselineMetricsCollector
from evaluation_tests.conversation_libs import conversation_generator
from evaluation_tests.conversation_libs.conversation_test_function import LLMSimulatedUser
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from evaluation_tests.conversation_libs.evaluators.evaluator_builder import create_evaluator
from evaluation_tests.conversation_libs.fake_conversation_context import save_conversation
from evaluation_tests.e2e_chat_executor import E2EChatExecutor
from evaluation_tests.golden_test_cases import golden_test_cases, GOLDEN_SET_METADATA, GoldenTestCase


@pytest.mark.asyncio
@pytest.mark.evaluation_test    
@pytest.mark.golden_test
@pytest.mark.parametrize("test_case", golden_test_cases, ids=[tc.name for tc in golden_test_cases])
async def test_golden_set(
    test_case: GoldenTestCase,
    max_iterations: int,
    setup_search_services: Awaitable[SearchServices],
    setup_multi_locale_app_config,
    common_folder_path: str
):
    """
    Run a single golden test case.
    
    This test validates that the conversational flow maintains quality and performance
    standards for a representative user persona.
    
    Args:
        test_case: The golden test case to run
        max_iterations: Maximum conversation rounds
        setup_search_services: Fixture providing search services
        setup_multi_locale_app_config: Fixture providing app config
        common_folder_path: Fixture providing output path
    """
    logger = logging.getLogger()
    logger.info(f"Running golden test case {test_case.name}")
    
    session_id = get_random_session_id()
    get_i18n_manager().set_locale(test_case.locale)
    search_services = await setup_search_services
    
    experience_pipeline_config = ExperiencePipelineConfig.model_validate(
        {"number_of_clusters": test_case.given_number_of_clusters,
         "number_of_top_skills_to_pick_per_cluster": test_case.given_number_of_top_skills_to_pick_per_cluster})
    
    # Initialize baseline metrics collector
    metrics_collector = BaselineMetricsCollector(
        test_case_name=test_case.name,
        session_id=str(session_id)
    )
    
    chat_executor = E2EChatExecutor(
        session_id=session_id,
        default_country_of_user=test_case.country_of_user,
        search_services=search_services,
        experience_pipeline_config=experience_pipeline_config,
        metrics_collector=metrics_collector
    )

    evaluation_result = ConversationEvaluationRecord(
        simulated_user_prompt=test_case.simulated_user_prompt,
        test_case=test_case.name
    )
    
    failures = []
    try:
        evaluation_result.add_conversation_records(
            await conversation_generator.generate(
                max_iterations=test_case.conversation_rounds if test_case.conversation_rounds else max_iterations,
                execute_simulated_user=LLMSimulatedUser(
                    system_instructions=test_case.simulated_user_prompt),
                execute_evaluated_agent=lambda agent_input: chat_executor.send_message(agent_input=agent_input),
                is_finished=lambda agent_output: chat_executor.conversation_is_complete(agent_output=agent_output),
            ))
        
        actual_experiences_explored = chat_executor.get_experiences_explored()
        
        # Check if the actual discovered experiences match the expected ones
        _failures = await test_case.check_expectations(actual_experiences_explored)
        if _failures:
            failures.extend(_failures)
        else:
            logger.info(f"Golden test case {test_case.name} passed the experiences expectations check.")

        # Assert that at least one experience has been explored
        if not chat_executor.get_experiences_explored():
            failures.append("No experiences were explored during the conversation.")
        else:
            logger.info(f"Experiences successfully explored: {len(actual_experiences_explored)}")

        # Run evaluations
        for evaluation in test_case.evaluations:
            evaluator = create_evaluator(evaluation.type)
            output = await evaluator.evaluate(evaluation_result)
            evaluation_result.add_evaluation_result(output)
            logger.info(f'Evaluation for {output.evaluator_name}: {output.score} {output.reasoning}')
            if output.score < evaluation.expected:
                failures.append(f"{output.evaluator_name} expected "
                               f"{evaluation.expected} actual {output.score}")

    except Exception as e:
        logger.error(f"Golden test case {test_case.name} failed with exception: {e}", exc_info=True)
        failures.append(f"Exception during test: {str(e)}")
    finally:
        # Save test outputs
        output_folder = common_folder_path + 'e2e_test_' + test_case.name
        evaluation_result.save_data(folder=output_folder, base_file_name='evaluation_record')
        
        # Save conversation context if chat_executor was initialized
        if 'chat_executor' in locals():
            try:
                context = await chat_executor.get_conversation_memory_manager().get_conversation_context()
                save_conversation(context, title=test_case.name, folder_path=output_folder)
            except Exception as e:
                logger.warning(f"Failed to save conversation context: {e}")
        
        # Save baseline metrics if metrics_collector was initialized
        if 'metrics_collector' in locals():
            try:
                output_path = Path(output_folder)
                metrics_path = metrics_collector.save_metrics(output_path)
                logger.info(f"Baseline metrics saved to: {metrics_path}")
                
                # Log summary
                summary = metrics_collector.get_summary()
                logger.info(f"Baseline metrics summary: {summary}")
            except Exception as e:
                logger.warning(f"Failed to save baseline metrics: {e}")

    # Assert no failures
    if failures:
        failure_msg = "\n".join(failures)
        pytest.fail(f"Golden test case {test_case.name} failed:\n{failure_msg}")


@pytest.mark.golden_test_summary
def test_golden_set_metadata():
    """
    Validate golden test set metadata and configuration.
    
    This test ensures the golden set is properly configured and documented.
    """
    # Validate metadata structure
    assert "version" in GOLDEN_SET_METADATA
    assert "created_date" in GOLDEN_SET_METADATA
    assert "total_tests" in GOLDEN_SET_METADATA
    assert "coverage" in GOLDEN_SET_METADATA
    assert "quality_thresholds" in GOLDEN_SET_METADATA
    
    # Validate test count matches
    assert GOLDEN_SET_METADATA["total_tests"] == len(golden_test_cases)
    assert len(golden_test_cases) == 7, "Golden set should contain exactly 7 tests"
    
    # Validate coverage
    coverage = GOLDEN_SET_METADATA["coverage"]
    assert "work_types" in coverage
    assert "conversation_styles" in coverage
    assert "complexity" in coverage
    assert "countries" in coverage
    
    # Validate quality thresholds
    thresholds = GOLDEN_SET_METADATA["quality_thresholds"]
    assert thresholds["skill_overlap_min"] >= 0.85
    assert thresholds["turn_count_max_deviation"] <= 0.30
    assert thresholds["conversation_time_max_deviation"] <= 0.30
    
    print("\n" + "="*80)
    print("GOLDEN TEST SET METADATA")
    print("="*80)
    print(f"Version: {GOLDEN_SET_METADATA['version']}")
    print(f"Created: {GOLDEN_SET_METADATA['created_date']}")
    print(f"Total Tests: {GOLDEN_SET_METADATA['total_tests']}")
    print(f"Expected Runtime: {GOLDEN_SET_METADATA['expected_runtime_minutes']} minutes")
    print("\nCoverage:")
    print(f"  Work Types: {coverage['work_types']}")
    print(f"  Conversation Styles: {coverage['conversation_styles']}")
    print(f"  Complexity: {coverage['complexity']}")
    print(f"  Countries: {coverage['countries']}")
    print("\nQuality Thresholds:")
    print(f"  Min Skill Overlap: {thresholds['skill_overlap_min']*100}%")
    print(f"  Max Turn Count Deviation: {thresholds['turn_count_max_deviation']*100}%")
    print(f"  Max Time Deviation: {thresholds['conversation_time_max_deviation']*100}%")
    print("="*80)


# Pytest configuration for golden tests
def pytest_configure(config):
    """Register golden_test marker."""
    config.addinivalue_line(
        "markers", 
        "golden_test: mark test as part of the golden regression test set"
    )
    config.addinivalue_line(
        "markers",
        "golden_test_summary: mark test as golden set metadata validation"
    )

