import json
import logging
import os
import random
from typing import Awaitable

import pytest

from app.agent.linking_and_ranking_pipeline.infer_occupation_tool import InferOccupationTool
from app.i18n.translation_service import get_i18n_manager
from app.vector_search.vector_search_dependencies import SearchServices
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from evaluation_tests.linking_and_ranking_pipeline.infer_occupation_tool.test_occupation_inference_test_case import \
    InferOccupationToolTestCase
from .test_occupation_inference_test_case import test_cases, OccupationFound


@pytest.fixture(scope="function")
async def setup_agent_tool(setup_search_services: Awaitable[SearchServices]):
    search_services = await setup_search_services
    tool = InferOccupationTool(
        occupation_skill_search_service=search_services.occupation_skill_search_service,
        occupation_search_service=search_services.occupation_search_service
    )
    return tool


async def _test_occupation_inference_tool(test_case: InferOccupationToolTestCase, setup_agent_tool: Awaitable[InferOccupationTool],
                                          caplog: pytest.LogCaptureFixture) -> tuple[bool, list[OccupationFound], list[str]]:
    """
    Test the occupation inference tool with the given test case.
    :param test_case:
    :param setup_agent_tool:
    :param caplog:
    :return: tuple[bool, list[OccupationFound], list[str]]
             The first element is True if the test passed, False otherwise.
             The second element is the list of found occupations.
             The third element is the list of errors encountered during the test that caused the test to fail.
    """
    test_result: bool = False
    actual_occupations_found: list[OccupationFound] = []
    errors: list[str] = []

    tool = await setup_agent_tool
    # GIVEN an experience and a country of interest
    # shuffle the responsibilities to ensure the test is not dependent on the order of the responsibilities
    random.shuffle(test_case.given_responsibilities)
    # WHEN the tool is executed with the given experience and country
    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.INFO):
        get_i18n_manager().set_locale(test_case.locale)

        # Guards to ensure that the loggers are correctly set up,
        guard_caplog(logger=tool._logger, caplog=caplog)
        actual_tool_result = await tool.execute(
            experience_title=test_case.given_experience_title,
            company=test_case.given_company,
            work_type=test_case.given_work_type,
            responsibilities=test_case.given_responsibilities,
            country_of_interest=test_case.given_country_of_interest,
            top_k=test_case.given_top_k,
            top_p=test_case.given_top_p,
            number_of_titles=test_case.given_number_of_titles
        )
        logging.log(logging.INFO, "Given Title '%s' -> Contextual Titles: %s", test_case.given_experience_title,
                    json.dumps(actual_tool_result.contextual_titles))

        # THEN expect the expected occupations to be found

        actual_occupations_found = [OccupationFound(code=skill_occupation.occupation.code, preferred_label=skill_occupation.occupation.preferredLabel)
                                    for skill_occupation in actual_tool_result.esco_occupations]
        # sort by code to ensure the order is consistent
        actual_occupations_found.sort(key=lambda x: x.code)
        # sort expected occupations by code to ensure the order is consistent
        test_case.expected_occupations_found.sort(key=lambda x: x.code)
        formatted_actual = "\n • ".join(
            f"{occupation.code} - {occupation.preferred_label}" for occupation in actual_occupations_found
        )
        logging.info("Found ESCO Occupations:\n • %s", formatted_actual)
        formatted_expected = "\n • ".join(
            f"{occupation.code} - {occupation.preferred_label}" for occupation in test_case.expected_occupations_found
        )
        logging.info("Expected Occupations:\n • %s", formatted_expected)
        # expected_occupations_found should be a subset of the preferred labels of the occupations
        test_result = set(test_case.expected_occupations_found).issubset(actual_occupations_found)
        if not test_result:
            # find the actual occupations that are not in the expected occupations
            missing_occupations = set(actual_occupations_found) - set(test_case.expected_occupations_found)
            # format the missing occupations for logging
            missing_occupations = "\n • ".join(
                f"{occupation.code} - {occupation.preferred_label}" for occupation in missing_occupations
            )
            errors.append(f"Expected occupations not found in the actual occupations: {missing_occupations}.")

        # AND the number of contextual titles is equal to the number of titles
        if len(actual_tool_result.contextual_titles) != test_case.given_number_of_titles:
            errors.append(f"Expected {test_case.given_number_of_titles} contextual titles, but got {len(actual_tool_result.contextual_titles)}.")
            test_result = False

        # AND a list of ESCO occupations is given_top_k
        if len(actual_tool_result.esco_occupations) != test_case.given_top_k:
            errors.append(f"Expected {test_case.given_top_k} ESCO occupations, but got {len(actual_tool_result.esco_occupations)}.")
            test_result = False

        # AND no error or warning in the logs+
        try:
            assert_log_error_warnings(caplog=caplog, expect_errors_in_logs=False, expect_warnings_in_logs=True)
        except AssertionError as e:
            errors.append(f"Expected no errors in the logs, but got: {e}")
            test_result = False

    return test_result, actual_occupations_found, errors


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize(
    "test_case", get_test_cases_to_run(test_cases),
    ids=[f"{index} - {case.name} - {case.given_experience_title}" for index, case in enumerate(get_test_cases_to_run(test_cases))])
async def test_occupation_inference_tool_std(test_case: InferOccupationToolTestCase, setup_agent_tool: Awaitable[InferOccupationTool],
                                             caplog: pytest.LogCaptureFixture):
    actual_tool_result = await _test_occupation_inference_tool(test_case, setup_agent_tool, caplog)
    if not actual_tool_result[0]:
        pytest.fail(f"Test failed for {test_case.name} with errors: {actual_tool_result[2]}")
    else:
        logging.info(f"Test passed for {test_case.name}. Found occupations: {actual_tool_result[1]}")


#########################################################################
# Extended tests for the occupation inference tool using JSONL test cases
#########################################################################

def load_test_cases_from_jsonl() -> list[InferOccupationToolTestCase]:
    file_path: str = os.path.join(os.path.dirname(__file__), 'infer_occupation_tool_test_cases.jsonl')
    import json
    _test_cases = []
    with open(file_path, 'r', encoding='utf-8') as file:
        for line in file:
            data = json.loads(line)
            test_case = InferOccupationToolTestCase(**data)
            _test_cases.append(test_case)
    return _test_cases


jsonl_test_cases = load_test_cases_from_jsonl()


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize(
    "test_case", get_test_cases_to_run(jsonl_test_cases),
    ids=[f"{index} - {case.name} - {case.given_experience_title}" for index, case in enumerate(get_test_cases_to_run(jsonl_test_cases))])
async def test_occupation_inference_tool_extended(test_case: InferOccupationToolTestCase, setup_agent_tool: Awaitable[InferOccupationTool],
                                                  caplog: pytest.LogCaptureFixture):
    test_result = await _test_occupation_inference_tool(test_case, setup_agent_tool, caplog)
    # write the results to a jsonl
    result_file_path = os.path.join(os.path.dirname(__file__), 'infer_occupation_tool_test_results.jsonl')
    with open(result_file_path, 'a', encoding='utf-8') as result_file:
        result_data = {
            "test_case": test_case.name,
            "given_experience_title": test_case.given_experience_title,
            "test_passed": test_result[0],
            "errors": test_result[2],
            "expected_occupations_found": [{"code": occupation.code, "preferred_label":occupation.preferred_label} for occupation in test_case.expected_occupations_found],
            "actual_occupations_found": [{"code": occupation.code, "preferred_label":occupation.preferred_label} for occupation in test_result[1]],
        }
        result_file.write(json.dumps(result_data, ensure_ascii=False) + '\n')

    if not test_result[0]:
        pytest.fail(f"Test failed for {test_case.name} with errors: {test_result[2]}")
    else:
        logging.info(f"Test passed for {test_case.name}. Found occupations: {test_result[1]}")
