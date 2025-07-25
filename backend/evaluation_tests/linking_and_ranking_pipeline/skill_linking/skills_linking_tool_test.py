import logging
from typing import Optional, Awaitable

import pytest

from app.agent.experience.work_type import WorkType
from app.agent.linking_and_ranking_pipeline.infer_occupation_tool import InferOccupationTool
from app.agent.linking_and_ranking_pipeline.skill_linking_tool import SkillLinkingTool
from app.countries import Country
from app.vector_search.esco_entities import OccupationSkillEntity
from app.vector_search.vector_search_dependencies import SearchServices
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


class SkillLinkingToolTestCase(CompassTestCase):
    given_occupation_code: Optional[str] = None
    given_occupation_title: Optional[str] = None
    given_responsibilities: list[str]
    given_work_type: WorkType
    expected_skills: list[str]


test_cases = [
    SkillLinkingToolTestCase(
        name="Baker by code",
        given_occupation_code="7512.1",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_responsibilities=["I bake bread", "I clean my work place", "I order supplies"],
        expected_skills=['bake goods', 'ensure sanitation']
    ),
    SkillLinkingToolTestCase(
        name="Baker by title",
        given_occupation_title="Baker",
        given_work_type=WorkType.SELF_EMPLOYMENT,
        given_responsibilities=["I bake bread", "I clean my work place", "I order supplies", "I sell bread", "I talk to customers"],
        expected_skills=['bake goods', 'prepare bakery products', 'order supplies', 'ensure sanitation', 'maintain relationship with customers']
    ),
    SkillLinkingToolTestCase(
        name="GDE Brigade member by title",
        given_occupation_title="GDE Brigade member",
        given_work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        given_responsibilities=["I make sure everyone follows the Covid-19 rules.",
                                "I keep an eye on the kids to make sure they stay apart from each other.",
                                "I check and record temperatures and other health signs.",
                                "I clean and disinfect students, teachers, and visitors.",
                                "I put together weekly and monthly reports."],
        expected_skills=['manage health and safety standards',
                         'health and safety regulations',
                         'undertake inspections',
                         'write work-related reports',
                         'communicate health and safety measures']
    ),
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize("test_case", get_test_cases_to_run(test_cases), ids=[test_case.name for test_case in get_test_cases_to_run(test_cases)])
async def test_skill_linking_tool(test_case: SkillLinkingToolTestCase, setup_search_services: Awaitable[SearchServices], caplog):

    search_services = await setup_search_services
    # Given the occupation with it's associated skills
    given_job_titles: list[str] = []
    given_occupations_with_skills: list[OccupationSkillEntity] = []
    if test_case.given_occupation_code:
        given_occupation_skills: OccupationSkillEntity = await search_services.occupation_skill_search_service.get_by_esco_code(
            code=test_case.given_occupation_code,
        )
        given_occupations_with_skills.append(given_occupation_skills)
        given_job_titles.append(given_occupation_skills.occupation.preferredLabel)

    if test_case.given_occupation_title:
        tool = InferOccupationTool(search_services.occupation_skill_search_service)
        result = await tool.execute(
            experience_title=test_case.given_occupation_title,
            work_type=test_case.given_work_type,
            company=None,
            responsibilities=test_case.given_responsibilities,
            country_of_interest=Country.SOUTH_AFRICA,
            number_of_titles=5,
            top_k=5,
            top_p=10
        )
        logging.getLogger().info(f"Contextual titles: {result.contextual_titles}")
        logging.getLogger().info(f"ESCO occupations: {[esco_occupation.occupation.preferredLabel for esco_occupation in result.esco_occupations]}")
        given_occupations_with_skills.extend(result.esco_occupations)
        given_job_titles.extend(result.contextual_titles)

    # When the skill linking tool is called with the given occupation and responsibilities
    skill_linking_tool = SkillLinkingTool(search_services.skill_search_service)

    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.INFO):
        # Guards to ensure that the loggers are correctly set up.
        guard_caplog(logger=skill_linking_tool._logger, caplog=caplog)

        response = await skill_linking_tool.execute(
            job_titles=given_job_titles,
            occupation_skills_entities=given_occupations_with_skills,
            responsibilities=test_case.given_responsibilities,
            top_k=5,
            top_p=5)
        # Then the expected skills are returned
        # get the preferred labels for the found skills
        actual_skills_labels = sorted([skill.preferredLabel.lower() for skill in response.top_skills])
        # assert the expected skills are in the actual skills
        # Find missing skills
        missing_skills = sorted([skill for skill in test_case.expected_skills if skill not in actual_skills_labels])

        # Assert all expected skills are in the actual skills list
        logging.getLogger().info(f"Found skills: {actual_skills_labels}")
        if missing_skills:
            logging.getLogger().info(f"Missing skills: {missing_skills}")
            # do the assertion in a way that the test fails, and the diff can be shown in the IDE
            assert actual_skills_labels == sorted(test_case.expected_skills)

        # AND the logs should not contain any errors
        assert_log_error_warnings(caplog=caplog, expect_errors_in_logs=False, expect_warnings_in_logs=True)
