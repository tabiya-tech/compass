import logging
from typing import Optional

import pytest

from app.agent.collect_experiences_agent.data_extraction_llm._temporal_classifier_tool import \
    TemporalAndWorkTypeClassifierTool
from app.agent.experience import WorkType
from common_libs.test_utilities.guard_caplog import guard_caplog
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from evaluation_tests.matcher import check_actual_data_matches_expected, AnyOf


class TemporalAndWorkTypeClassifierToolTestCase(CompassTestCase):
    # GIVENS
    turns: list[tuple[str, str]]
    """
    The conversation history.
    First element is what the user said, second element is what the agent said.
    """

    given_experience_title: Optional[str] = None

    users_input: str
    """
    Users Last input related to this operation.
    """

    # EXPECTED
    expected_extracted_data: dict


SILENCE_MESSAGE = "(silence)"

test_cases: list[TemporalAndWorkTypeClassifierToolTestCase] = [
    # BASIC Tests.

    TemporalAndWorkTypeClassifierToolTestCase(
        name="provide_start_date",
        turns=[
            (SILENCE_MESSAGE, "When did you start working at Acme Inc?"),
        ],
        given_experience_title="Software Engineer",
        users_input="May 2021",
        expected_extracted_data={
            "start_date": "2021/05",
            "end_date": None,
            "paid_work": AnyOf(None, True),
            "work_type": AnyOf(None, WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name),
        }
    ),
    TemporalAndWorkTypeClassifierToolTestCase(
        name="provide_end_date",
        turns=[
            (SILENCE_MESSAGE, "When did you stop working at Acme Inc?"),
        ],
        users_input="June 2020",
        expected_extracted_data={
            "end_date": "2020/06",
            "start_date": None,
            "work_type": AnyOf(None, "None"),
            "paid_work": None,
        }
    ),
    TemporalAndWorkTypeClassifierToolTestCase(
        name="provide_is_paid",
        turns=[
            (SILENCE_MESSAGE, "Was your work experience at Github paid?"),
        ],
        users_input="Yes",
        expected_extracted_data={
            "paid_work": True
        }
    ),

    # Test cases related to work types.
    TemporalAndWorkTypeClassifierToolTestCase(
        name="waged_employment_work_type",
        turns=[
            (SILENCE_MESSAGE, "Let's start by exploring your work experiences. "
                              "Have you ever worked for a company or someone else's business for money?"),
        ],
        users_input="Yes, as a baker at a local restaurant.",
        expected_extracted_data={
            "paid_work": True,
            "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
        }
    ),
    TemporalAndWorkTypeClassifierToolTestCase(
        name="formal_sector_unpaid_trainee_work_work_type",
        turns=[
            (SILENCE_MESSAGE, "Have you ever worked as an unpaid trainee for a company or organization?"),
        ],
        users_input="Yes, I was an intern at a local tech startup.",
        expected_extracted_data={
            "paid_work": False,
            "work_type": WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK.name
        }
    ),
    TemporalAndWorkTypeClassifierToolTestCase(
        name="self_employment_work_type",
        turns=[
            (SILENCE_MESSAGE, "Have you ever run your own business, or done any freelance or contract work?"),
        ],
        users_input="Yes, selling tomatoes in local market.",
        expected_extracted_data={
            "paid_work": True,
            "work_type": WorkType.SELF_EMPLOYMENT.name
        }
    ),
    TemporalAndWorkTypeClassifierToolTestCase(
        name="unseen_unpaid_work_type_1",
        turns=[
            (SILENCE_MESSAGE,
             "Have you done unpaid work such as community volunteering, caregiving for your own or another family, or helping in a household?"),
        ],
        users_input="Yes, I do some domestic services at home",
        expected_extracted_data={
            "paid_work": AnyOf(None, False),
            "work_type": WorkType.UNSEEN_UNPAID.name
        }
    ),
    TemporalAndWorkTypeClassifierToolTestCase(
        name="unseen_unpaid_work_type_2",
        turns=[
            (SILENCE_MESSAGE,
             "Have you done unpaid work such as community volunteering, caregiving for your own or another family, or helping in a household?"),
        ],
        users_input="Yes, I do some domestic services at my grandmother's house",
        expected_extracted_data={
            "paid_work": AnyOf(None, False),
            "work_type": WorkType.UNSEEN_UNPAID.name
        }
    ),
    TemporalAndWorkTypeClassifierToolTestCase(
        name="unseen_unpaid_work_type_3",
        turns=[
            (SILENCE_MESSAGE,
             "Have you done unpaid work such as community volunteering, caregiving for your own or another family, or helping in a household?"),
        ],
        users_input="Yes, I do cook at school, when there are parties.",
        expected_extracted_data={
            "paid_work": AnyOf(False, None),
            "work_type": WorkType.UNSEEN_UNPAID.name
        }
    ),
    TemporalAndWorkTypeClassifierToolTestCase(
        name="unseen_unpaid_work_type_4",
        turns=[
            (SILENCE_MESSAGE,
             "Have you done unpaid work such as community volunteering, caregiving for your own or another family, or helping in a household?"),
        ],
        users_input="Yes, I participate in community work on the last Saturday of the month since I was 18 years old.",
        expected_extracted_data={
            "paid_work": False,
            "work_type": WorkType.UNSEEN_UNPAID.name
        }
    ),

    # REVIEW: Add more test cases, for example where the user is updating or removing some fields.
]


@pytest.mark.asyncio
@pytest.mark.repeat(2)
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_temporal_and_work_type_classification(test_case: TemporalAndWorkTypeClassifierToolTestCase, caplog):
    logger = logging.getLogger()
    with caplog.at_level(logging.DEBUG):
        guard_caplog(logger=logger, caplog=caplog)

        # GIVEN users last input
        given_user_input = test_case.users_input

        # AND the conversation turns
        conversation_turns = test_case.turns

        # WHEN the times and work type data extraction LLM is executed
        data_extraction_llm = TemporalAndWorkTypeClassifierTool(logger)
        extracted_data, _ = await data_extraction_llm.execute(users_last_input=given_user_input,
                                                              experience_title=test_case.given_experience_title,
                                                              conversation_history=conversation_turns)

        if not extracted_data:
            pytest.fail("The LLM did not return any output.")

        # THEN the extracted data should match the expected data
        failures = check_actual_data_matches_expected(actual_data=[extracted_data],
                                                      expected_data=[test_case.expected_extracted_data])

        if len(failures) > 0:
            pytest.fail(
                '\n'.join(failures))
