import logging
import random

import pytest

from app.agent.linking_and_ranking_pipeline.pick_top_skills_tool import PickTopSkillsTool
from app.vector_search.esco_entities import SkillEntity
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from evaluation_tests.linking_and_ranking_pipeline.get_test_skill_entity import get_skill_entity


class PickTopSkillToolTestCase(CompassTestCase):
    given_job_titles: list[str]
    given_responsibilities_group_name: str
    given_responsibilities: list[str]
    given_skills_to_rank: list[SkillEntity]
    given_top_k: int
    given_threshold: int
    expected_skills: list[str]
    expected_remaining_skills: list[str]


test_cases = [
    PickTopSkillToolTestCase(
        name="Special characters",
        given_job_titles=["Baker ✅"],
        given_responsibilities_group_name="Order in the kitchen ✨",
        given_responsibilities=["I clean my working area ✨", "Make sure everything is in place ✅"],
        given_skills_to_rank=[
            get_skill_entity(preferred_label="perform one's cleaning duties ✨", score=0.9),
            get_skill_entity(preferred_label="clean \t\n animals 🌭", score=0.8),
            get_skill_entity(preferred_label="let's not think about it 💩", score=0.7),
            get_skill_entity(preferred_label="*_@§\"$%\"':🤬", score=0.6),
        ],
        given_top_k=1,
        given_threshold=7,
        expected_skills=["perform one's cleaning duties ✨"],
        expected_remaining_skills=[
            "clean \t\n animals 🌭",
            "let's not think about it 💩",
            "*_@§\"$%\"':🤬"
        ]
    ),
    PickTopSkillToolTestCase(
        name="Duplicate preferred labels without altlabels",
        given_job_titles=["Baker"],
        given_responsibilities_group_name="Order in the kitchen",
        given_responsibilities=["I clean my working area", "Make sure everything is in place"],
        given_skills_to_rank=[
            get_skill_entity(preferred_label="perform one's cleaning duties", score=0.9),
            get_skill_entity(preferred_label="perform one's cleaning duties", score=0.9),
        ],
        given_top_k=1,
        given_threshold=7,
        expected_skills=["perform one's cleaning duties"],
        expected_remaining_skills=["perform one's cleaning duties"]
    ),
    PickTopSkillToolTestCase(
        name="Duplicate preferred labels with altlabels",
        given_job_titles=["Baker"],
        given_responsibilities_group_name="Order in the kitchen",
        given_responsibilities=["I clean my working area", "Make sure everything is in place"],
        given_skills_to_rank=[
            get_skill_entity(preferred_label="perform one's cleaning duties", altlabels=["perform cleaning duties"], score=0.9),
            get_skill_entity(preferred_label="perform one's cleaning duties", altlabels=["cope with bad weather"], score=0.9),
        ],
        given_top_k=1,
        given_threshold=7,
        expected_skills=["perform one's cleaning duties"],
        expected_remaining_skills=["perform one's cleaning duties"]
    ),
    PickTopSkillToolTestCase(
        skip_force="force",
        name="Mostly Irrelevant skills except one",
        given_job_titles=["Baker"],
        given_responsibilities_group_name="Baking",
        given_responsibilities=["I bake bread"],
        given_skills_to_rank=[
            get_skill_entity(preferred_label="baking", score=0.9),
            get_skill_entity(preferred_label="drive vehicles", score=0.1),
            get_skill_entity(preferred_label="talk endlessly", score=0.1),
        ],
        given_top_k=2,
        given_threshold=7,
        expected_skills=["baking"],
        expected_remaining_skills=["drive vehicles", "talk endlessly"]
    ),
    PickTopSkillToolTestCase(
        name="Baker",
        given_job_titles=["Baker"],
        given_responsibilities_group_name="Order in the kitchen",
        given_responsibilities=["I clean my working area ", "Make sure everything is in place"],
        given_skills_to_rank=[
            get_skill_entity(preferred_label="perform cleaning duties",
                             description="Perform cleaning duties such as waste removal, vacuuming, emptying bins, and general cleaning of the working area. "
                                         "Cleaning activities should follow health and safety regulations if required",
                             score=0.9),
            get_skill_entity(preferred_label="ensure sanitation",
                             description="Guarantee the continuous cleanliness of kitchen preparation, production and storage areas according to hygiene, "
                                         "safety and health regulations",
                             score=0.8),
            get_skill_entity(preferred_label="follow hygienic procedures during food processing", score=0.7),
            get_skill_entity(preferred_label="ensure cleanliness of food preparation area",
                             description="Guarantee the continuous cleanliness of kitchen preparation, production and storage areas according to hygiene, "
                                         "safety and health regulations.",
                             score=0.6),
            get_skill_entity(preferred_label="monitor operations of cleaning machines", score=0.5),
            get_skill_entity(preferred_label="clean food and beverage machinery", score=0.4),
            get_skill_entity(preferred_label="maintain a safe, hygienic and secure working environment",
                             description="Preserve health, hygiene, safety and security in the workplace in accordance with relevant regulations.",
                             score=0.3),
            get_skill_entity(preferred_label="handover the food preparation area",
                             description="Leave the kitchen area in conditions which follow safe and secure procedures, so that it is ready for the next shift",
                             score=0.2),
            get_skill_entity(preferred_label="operate grain cleaning machine", score=0.1),
            get_skill_entity(preferred_label="carry out checks of production plant equipment", score=0.0),
        ],
        given_top_k=5,
        given_threshold=8,
        expected_skills=["ensure cleanliness of food preparation area", "perform cleaning duties", "ensure sanitation",
                         "maintain a safe, hygienic and secure working environment", "follow hygienic procedures during food processing"],
        expected_remaining_skills=[
            "monitor operations of cleaning machines",
            "clean food and beverage machinery",
            "handover the food preparation area",
            "operate grain cleaning machine",
            "carry out checks of production plant equipment"
        ]
    )
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.5-flash-lite/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize("test_case", get_test_cases_to_run(test_cases), ids=[test_case.name for test_case in get_test_cases_to_run(test_cases)])
async def test_pick_top_skill_tool(test_case: PickTopSkillToolTestCase, caplog):
    # WHEN the pick top skills tool is called
    pick_top_skill_tool = PickTopSkillsTool()

    with caplog.at_level(logging.INFO):
        # Guards to ensure that the loggers are correctly set up,
        guard_caplog(pick_top_skill_tool._logger, caplog)
        # GIVEN the job titles, responsibilities group name, responsibilities and skills and top_k
        random.shuffle(test_case.given_job_titles)  # Shuffle the job titles to ensure the test is not dependent on the order of the job titles
        random.shuffle(
            test_case.given_responsibilities)  # Shuffle the responsibilities to ensure the test is not dependent on the order of the responsibilities
        random.shuffle(test_case.given_skills_to_rank)  # Shuffle the skills to ensure the test is not dependent on the order of the skills

        # WHEN the pick one skill tool is called
        actual_response = await pick_top_skill_tool.execute(
            job_titles=test_case.given_job_titles,
            responsibilities_group_name=test_case.given_responsibilities_group_name,
            responsibilities=test_case.given_responsibilities,
            skills_to_rank=test_case.given_skills_to_rank,
            top_k=test_case.given_top_k,
            threshold=test_case.given_threshold
        )

        # THEN it should return the expected skills
        actual_picked_skills_labels = [skill.preferredLabel for skill in actual_response.picked_skills]
        assert set(actual_picked_skills_labels) == set(test_case.expected_skills)
        # AND the remaining skills should be in the response
        actual_remaining_skills_labels = [skill.preferredLabel for skill in actual_response.remaining_skills]
        assert set(actual_remaining_skills_labels) == set(test_case.expected_remaining_skills)
        # AND the logs should not contain any errors
        assert_log_error_warnings(caplog=caplog, expect_errors_in_logs=False, expect_warnings_in_logs=True)
