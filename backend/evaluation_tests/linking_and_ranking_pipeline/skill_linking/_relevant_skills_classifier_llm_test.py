import logging
import uuid
from typing import Optional

import pytest
from _pytest.logging import LogCaptureFixture
from bson import ObjectId

from app.agent.linking_and_ranking_pipeline.skill_linking_tool._relevant_skills_classifier_llm import _RelevantSkillsClassifierLLM
from app.vector_search.esco_entities import SkillEntity
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


def _get_skill_entity(*, preferred_label: str, description: Optional[str] = "", score: Optional[float] = 0) -> SkillEntity:
    return SkillEntity(
        id=f"{uuid.uuid4().hex[:24]}",  # id is a random sting 24 character hex string
        UUID=f"{uuid.uuid4()}",
        modelId=f"{str(ObjectId())}",
        preferredLabel=preferred_label,
        altLabels=[],  # AltLabels is interesting and can be used to improve the classifier
        description=description,
        skillType="skill/competence",  # We do not care about the skill type
        score=score
    )


class RelevantSkillsClassifierLLMTestCase(CompassTestCase):
    given_job_titles: list[str]
    given_responsibility: str
    given_skills: list[SkillEntity]
    given_top_k: int = 5
    expected_relevant_skills: list[str]
    expected_remaining_skills: list[str]


test_cases = [
    RelevantSkillsClassifierLLMTestCase(
        name="Special characters",
        given_job_titles=["Baker ✅"],
        given_responsibility="I clean my work place ✨",
        given_skills=[
            _get_skill_entity(preferred_label="perform one's cleaning duties ✨", score=0.9),
            _get_skill_entity(preferred_label="ensure \"sanitation\" 🛁", score=0.8),
            _get_skill_entity(preferred_label="clean \t\n animals 🌭", score=0.8),
            _get_skill_entity(preferred_label="let's not think about it 💩", score=0.7),
            _get_skill_entity(preferred_label="*_@§\"$%\"':🤬", score=0.6),
        ],
        given_top_k=2,
        expected_relevant_skills=["perform one's cleaning duties ✨",
                                  "ensure \"sanitation\" 🛁",
                                  ],
        expected_remaining_skills=[
            "clean \t\n animals 🌭",
            "let's not think about it 💩",
            "*_@§\"$%\"':🤬",
        ]
    ),

    RelevantSkillsClassifierLLMTestCase(
        name="Baker",
        given_job_titles=["Baker"],
        given_responsibility="I clean my work place",
        given_skills=[
            _get_skill_entity(preferred_label="perform cleaning duties", score=0.9),
            _get_skill_entity(preferred_label="ensure sanitation", score=0.8),
            _get_skill_entity(preferred_label="follow hygienic procedures during food processing", score=0.7),
            _get_skill_entity(preferred_label="ensure cleanliness of food preparation area", score=0.6),
            _get_skill_entity(preferred_label="monitor operations of cleaning machines", score=0.5),
            _get_skill_entity(preferred_label="clean food and beverage machinery", score=0.4),
            _get_skill_entity(preferred_label="maintain a safe, hygienic and secure working environment", score=0.3),
            _get_skill_entity(preferred_label="handover the food preparation area", score=0.2),
            _get_skill_entity(preferred_label="operate grain cleaning machine", score=0.1),
            _get_skill_entity(preferred_label="carry out checks of production plant equipment", score=0.0),
        ],
        given_top_k=6,
        expected_relevant_skills=["perform cleaning duties",
                                  "ensure sanitation",
                                  "follow hygienic procedures during food processing",
                                  "ensure cleanliness of food preparation area",
                                  "handover the food preparation area",
                                  "maintain a safe, hygienic and secure working environment",
                                  ],
        expected_remaining_skills=[
            "clean food and beverage machinery",
            "monitor operations of cleaning machines",
            "operate grain cleaning machine",
            "carry out checks of production plant equipment",
        ]
    ),
    RelevantSkillsClassifierLLMTestCase(
        name="GDE Brigade member",
        given_job_titles=["GDE Brigade member", "School Safety Officer"],
        given_responsibility="I check and record temperatures and other health signs.",
        given_skills=[
            _get_skill_entity(preferred_label="ensure compliance with policies",
                              description="To ensure compliance with legislation and company procedures in respect of "
                                          "Health and Safety in the workplace and public areas, at all times. "
                                          "To ensure awareness of and compliance with all Company Policies in relation to "
                                          "Health and Safety and Equal Opportunities in the workplace. "
                                          "To carry out any other duties which may reasonably be required."),
            _get_skill_entity(preferred_label="adhere to organisational guidelines",
                              description="Adhere to organisational or department specific standards and guidelines. "
                                          "Understand the motives of the organisation and the common agreements and act accordingly"),
            _get_skill_entity(preferred_label="guarantee students' safety",
                              description="Ensure all students falling under an instructor or other person’s supervision are safe and accounted for. "
                                          "Follow safety precautions in the learning situation."),
            _get_skill_entity(preferred_label="follow health and safety precautions in social care practices",
                              description="Ensure hygienic work practice, respecting the safety of the environment at day care, "
                                          "residential care settings and care at home."),
            _get_skill_entity(preferred_label="supervise hygiene procedures in agricultural settings",
                              description="Ensure that hygiene procedures in agricultural settings are followed, "
                                          "taking into account the regulations of specific areas of action "
                                          "e.q. livestock, plants, local farm products, etc."),
            _get_skill_entity(preferred_label="adhere to standards of national and international safety programmes",
                              description="Comply with national and international safety standards, e.g. in aviation. "
                                          "Adhere to standards of national and international safety programmes."),
            _get_skill_entity(preferred_label="airport safety regulations",
                              description="The applicable airport safety regulations and instructions."),
            _get_skill_entity(preferred_label="follow standards for machinery safety",
                              description="Apply basic safety standards and machine-specific technical standards "
                                          "to prevent risks connected with the use of machines in the workplace."),
            _get_skill_entity(preferred_label="follow industry codes of practice for aviation safety",
                              description="Follows industry codes of practice relating to aviation safety. "
                                          "Follow guidance material to adhere to the requirements of the "
                                          "International Civil Aviation Organization’s Standards (ICAO), "
                                          "other aviation safety requirements, and the identified best practices."),
            _get_skill_entity(preferred_label="ensure compliance with safety legislation",
                              description="Implement safety programmes to comply with national laws and legislation. "
                                          "Ensure that equipment and processes are compliant with safety regulations."),
        ],
        given_top_k=6,
        expected_relevant_skills=["ensure compliance with policies",
                                  "adhere to organisational guidelines",
                                  "guarantee students' safety",
                                  "follow health and safety precautions in social care practices",
                                  "adhere to standards of national and international safety programmes",
                                  "ensure compliance with safety legislation"
                                  ],
        expected_remaining_skills=["supervise hygiene procedures in agricultural settings",
                                   "airport safety regulations",
                                   "follow industry codes of practice for aviation safety",
                                   "follow standards for machinery safety"
                                   ]
    ),
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize("test_case", get_test_cases_to_run(test_cases), ids=[test_case.name for test_case in get_test_cases_to_run(test_cases)])
async def test_relevance_classifier_llm(test_case: RelevantSkillsClassifierLLMTestCase, caplog: LogCaptureFixture):
    relevant_skills_classifier = _RelevantSkillsClassifierLLM()
    session_id = hash(test_case.name) % 10 ** 10

    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.DEBUG):
        # Guards to ensure that the loggers are correctly setup,
        # otherwise the tests cannot be trusted that they correctly assert the absence of errors and warnings.
        guard_warning_msg = logging.getLevelName(logging.WARNING) + str(session_id)  # some random string
        relevant_skills_classifier._logger.warning(guard_warning_msg)
        assert guard_warning_msg in caplog.text
        guard_error_msg = logging.getLevelName(logging.ERROR) + str(session_id)  # some random string
        relevant_skills_classifier._logger.warning(guard_error_msg)
        assert guard_error_msg in caplog.text
        caplog.records.clear()

        # GIVEN the occupation with it's associated skills

        # WHEN the skill linking tool is called with the given title and responsibilities and skills
        actual_result = await relevant_skills_classifier.execute(
            job_titles=test_case.given_job_titles,
            responsibilities=[test_case.given_responsibility],
            skills=test_case.given_skills,
            top_k=test_case.given_top_k
        )
        # THEN the result should contain top_k most relevant skills
        assert len(actual_result.most_relevant) == test_case.given_top_k

        # AND the result should contain the expected relevant skills
        actual_most_relevant_skills_labels = [skill.preferredLabel for skill in actual_result.most_relevant]
        assert set(actual_most_relevant_skills_labels) == set(test_case.expected_relevant_skills)
        # AND the result should contain the expected remaining skills
        actual_remaining_skills_labels = [skill.preferredLabel for skill in actual_result.remaining]
        assert set(actual_remaining_skills_labels) == set(test_case.expected_remaining_skills)

        # Check that no errors and no warning were logged
        for record in caplog.records:
            assert record.levelname != 'ERROR'
            assert record.levelname != 'WARNING'
