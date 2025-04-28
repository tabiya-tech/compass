import json
import logging
import random
from typing import Awaitable

import pytest

from app.agent.linking_and_ranking_pipeline.infer_occupation_tool import InferOccupationTool
from app.vector_search.vector_search_dependencies import SearchServices
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from .test_occupation_inference_test_case import test_cases
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from evaluation_tests.linking_and_ranking_pipeline.infer_occupation_tool.test_occupation_inference_test_case import InferOccupationToolTestCase


@pytest.fixture(scope="function")
async def setup_agent_tool(setup_search_services: Awaitable[SearchServices]):
    search_services = await setup_search_services
    tool = InferOccupationTool(search_services.occupation_skill_search_service)
    return tool


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize(
    "test_case", get_test_cases_to_run(test_cases),
    ids=[f"{index} - {case.name} - {case.given_experience_title}" for index, case in enumerate(get_test_cases_to_run(test_cases))])
async def test_occupation_inference_tool(test_case: InferOccupationToolTestCase, setup_agent_tool: Awaitable[InferOccupationTool],
                                         caplog: pytest.LogCaptureFixture):
    tool = await setup_agent_tool
    # GIVEN an experience and a country of interest
    # shuffle the responsibilities to ensure the test is not dependent on the order of the responsibilities
    random.shuffle(test_case.given_responsibilities)
    # WHEN the tool is executed with the given experience and country
    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.INFO):
        # Guards to ensure that the loggers are correctly set up,
        guard_caplog(logger=tool._logger, caplog=caplog)
        result = await tool.execute(
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
                    json.dumps(result.contextual_titles))

        # THEN expect the expected occupations to be found

        occupations = [{"title": skill_occupation.occupation.preferredLabel, "description": skill_occupation.occupation.description} for skill_occupation in
                       result.esco_occupations]
        logging.log(logging.INFO, "Found ESCO Occupations(preferredLabel,description): \n -%s", json.dumps(occupations))
        # expected_occupations_found should be a subset of the preferred labels of the occupations
        labels = [skill_occupation.occupation.preferredLabel for skill_occupation in result.esco_occupations]
        logging.log(logging.INFO, "Found ESCO Occupations (labels): \n -%s", "\n -".join(sorted(labels)))
        logging.log(logging.INFO, "Expected Occupations (labels): \n -%s", "\n -".join(sorted(test_case.expected_occupations_found)))
        if not set(test_case.expected_occupations_found).issubset(labels):
            # do the assertion in a way that the test fails and the diff can be shown in the IDE
            assert sorted(labels) == sorted(test_case.expected_occupations_found)

        # AND the number of contextual titles is equal to the number of titles
        assert len(result.contextual_titles) == test_case.given_number_of_titles

        # AND a list of ESCO occupations is given_top_k
        assert len(result.esco_occupations) == test_case.given_top_k

        # ADN no error or warning in the logs
        assert_log_error_warnings(caplog=caplog, expect_errors_in_logs=False, expect_warnings_in_logs=True)
