import logging
import uuid

import pytest
from _pytest.logging import LogCaptureFixture

from app.agent.skill_linking_ranking._relevance_classifier_llm import _RelevanceClassifierLLM
from app.vector_search.esco_entities import SkillEntity
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


def _get_skill_entity(preferred_label: str, score: float) -> SkillEntity:
    return SkillEntity(
        id=f"{uuid.uuid4().hex[:24]}",  # id is a random sting 24 character hex string
        UUID=f"{uuid.uuid4()}",
        preferredLabel=preferred_label,
        altLabels=[],  # AltLabels is interesting and can be used to improve the classifier
        description="",  # Description is interesting and can be used to improve the classifier
        skillType="skill/competence",  # We do not care about the skill type
        score=score
    )


class RelevanceClassifierLLMTestCase(CompassTestCase):
    given_experience_title: str
    given_contextual_title: str
    given_responsibility: str
    given_skills: list[SkillEntity]
    given_top_k: int = 5
    expected_relevant_skills: list[str]
    expected_remaining_skills: list[str]


test_cases = [
    RelevanceClassifierLLMTestCase(
        name="Baker",
        given_experience_title="Baker",
        given_contextual_title="Baker",
        given_responsibility="'I clean my work place'",
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
                                  "clean food and beverage machinery",
                                  "maintain a safe, hygienic and secure working environment",
                                  ],
        expected_remaining_skills=[
            "monitor operations of cleaning machines",
            "handover the food preparation area",
            "operate grain cleaning machine",
            "carry out checks of production plant equipment",
        ]
    ),
    RelevanceClassifierLLMTestCase(
        name="GDE Brigade member",
        given_experience_title="GDE Brigade member",
        given_contextual_title="School Safety Officer",
        given_responsibility="I check and record temperatures and other health signs.",
        given_skills=[
            _get_skill_entity(preferred_label="ensure compliance with policies", score=0.9),
            _get_skill_entity(preferred_label="adhere to organisational guidelines", score=0.8),
            _get_skill_entity(preferred_label="guarantee students' safety", score=0.7),
            _get_skill_entity(preferred_label="follow health and safety precautions in social care practices", score=0.6),
            _get_skill_entity(preferred_label="supervise hygiene procedures in agricultural settings", score=0.5),
            _get_skill_entity(preferred_label="adhere to standards of national and international safety programmes", score=0.4),
            _get_skill_entity(preferred_label="airport safety regulations", score=0.3),
            _get_skill_entity(preferred_label="follow standards for machinery safety", score=0.2),
            _get_skill_entity(preferred_label="follow industry codes of practice for aviation safety", score=0.1),
            _get_skill_entity(preferred_label="ensure compliance with safety legislation", score=0.0),
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
async def test_relevance_classifier_llm(test_case: RelevanceClassifierLLMTestCase, caplog: LogCaptureFixture):
    relevance_classifier = _RelevanceClassifierLLM()
    session_id = hash(test_case.name) % 10 ** 10

    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.DEBUG):
        # Guards to ensure that the loggers are correctly setup,
        # otherwise the tests cannot be trusted that they correctly assert the absence of errors and warnings.
        guard_warning_msg = logging.getLevelName(logging.WARNING) + str(session_id)  # some random string
        relevance_classifier._logger.warning(guard_warning_msg)
        assert guard_warning_msg in caplog.text
        guard_error_msg = logging.getLevelName(logging.ERROR) + str(session_id)  # some random string
        relevance_classifier._logger.warning(guard_error_msg)
        assert guard_error_msg in caplog.text
        caplog.records.clear()

        # GIVEN the occupation with it's associated skills

        # WHEN the skill linking tool is called with the given title and responsibilities and skills
        actual_result, _ = await relevance_classifier.execute(
            experience_title=test_case.given_experience_title,
            contextual_title=test_case.given_contextual_title,
            responsibility=test_case.given_responsibility,
            skills=test_case.given_skills,
            top_k=test_case.given_top_k
        )
        # THEN the result should contain top_k most relevant skills
        assert len(actual_result.most_relevant_skills) == test_case.given_top_k

        # AND the result should contain the expected relevant skills
        actual_most_relevant_skills_labels = [skill.preferredLabel for skill in actual_result.most_relevant_skills]
        assert set(actual_most_relevant_skills_labels) == set(test_case.expected_relevant_skills)
        # AND the result should contain the expected remaining skills
        actual_remaining_skills_labels = [skill.preferredLabel for skill in actual_result.remaining_skills]
        assert set(actual_remaining_skills_labels) == set(test_case.expected_remaining_skills)

        # Check that no errors and no warning were logged
        for record in caplog.records:
            assert record.levelname != 'ERROR'
            assert record.levelname != 'WARNING'
