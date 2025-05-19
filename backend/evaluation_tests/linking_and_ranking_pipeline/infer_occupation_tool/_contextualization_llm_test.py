import logging
import random
from typing import Optional

import pytest
from _pytest.logging import LogCaptureFixture

from app.agent.experience import WorkType
from app.agent.linking_and_ranking_pipeline.infer_occupation_tool._contextualization_llm import _ContextualizationLLM
from app.countries import Country
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


class ContextualizationTestCase(CompassTestCase):
    given_experience_title: str
    given_company: Optional[str] = None
    given_work_type: WorkType
    given_responsibilities: list[str]
    given_country_of_interest: Country
    given_number_of_titles: int = 5
    expect_warnings_in_logs: bool = True  # May generate warnings if the underlying LLM fails, but will be retried and expected to succeed without errors


test_cases = [
    ContextualizationTestCase(
        name="Self-employed baker with responsibilities",
        given_experience_title="Baker",
        given_company="Bread Co.",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_responsibilities=["I bake bread", "I clean my work place", "I order supplies", "I sell bread"],
        given_country_of_interest=Country.UNSPECIFIED,
        given_number_of_titles=5
    ),
    ContextualizationTestCase(
        name="Foo clarified by responsibilities",
        given_experience_title="Foo",
        given_company=None,
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_responsibilities=["I bake bread", "I clean my work place", "I order supplies", "I sell bread"],
        given_country_of_interest=Country.UNSPECIFIED,
        given_number_of_titles=5
    ),
    ContextualizationTestCase(
        name="Baker clarified by Job Title and not responsibilities",
        given_experience_title="Baker",
        given_company=None,
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_responsibilities=[],
        given_country_of_interest=Country.UNSPECIFIED,
        given_number_of_titles=5
    ),
    ContextualizationTestCase(
        name="Baker contradicting responsibilities",
        given_experience_title="Baker",
        given_company=None,
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_responsibilities=["I develop software", "I develop websites", "I build for the web", "I write code", "I bake bread"],
        given_country_of_interest=Country.UNSPECIFIED,
        given_number_of_titles=5
    ),
    ContextualizationTestCase(
        name="Matatu conductor",
        given_experience_title="Matatu conductor",
        given_company=None,
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_responsibilities=["I collect fares", "I assist passengers", "I maintain the vehicle", "I ensure safety"],
        given_country_of_interest=Country.KENYA,
        given_number_of_titles=5
    )
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.parametrize("test_case", get_test_cases_to_run(test_cases), ids=[test_case.name for test_case in get_test_cases_to_run(test_cases)])
async def test_relevant_occupations_classifier_llm(test_case: ContextualizationTestCase, caplog: LogCaptureFixture):
    logger = logging.getLogger(__name__)
    contextualization_llm = _ContextualizationLLM(country_of_interest=test_case.given_country_of_interest, logger=logger)

    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.DEBUG):
        # Guards to ensure that the loggers are correctly setup,
        guard_caplog(logger=contextualization_llm._logger, caplog=caplog)

        # GIVEN responsibilities and occupations
        random.shuffle(test_case.given_responsibilities)  # shuffle the responsibilities to be certain that the order does not matter

        # WHEN the relevance classifier is called with the given title and responsibilities and occupations
        actual_result = await contextualization_llm.execute(
            experience_title=test_case.given_experience_title,
            company=test_case.given_company,
            work_type=test_case.given_work_type,
            responsibilities=test_case.given_responsibilities,
            number_of_titles=test_case.given_number_of_titles
        )

        # THEN the result should contain the expected number of contextual titles
        assert len(actual_result.contextual_titles) == test_case.given_number_of_titles

        # AND the logs should not contain any errors or warnings (depending on the test case)
        assert_log_error_warnings(caplog=caplog,
                                  expect_errors_in_logs=test_case.expect_errors_in_logs,
                                  expect_warnings_in_logs=test_case.expect_warnings_in_logs)
