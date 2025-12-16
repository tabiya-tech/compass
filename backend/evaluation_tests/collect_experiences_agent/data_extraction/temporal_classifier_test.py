import logging
from typing import Optional

import pytest

from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.collect_experiences_agent.data_extraction_llm._temporal_classifier_tool import \
    TemporalAndWorkTypeClassifierTool
from app.agent.experience import WorkType
from app.conversation_memory.conversation_memory_types import ConversationTurn, ConversationContext, ConversationHistory
from app.i18n.translation_service import get_i18n_manager
from app.i18n.types import Locale
from common_libs.test_utilities.guard_caplog import guard_caplog
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from evaluation_tests.matcher import check_actual_data_matches_expected, AnyOf, ContainsString


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
            "start_date": "05/2021",
            "end_date": AnyOf(None, ContainsString("present")),
            "paid_work": True,
            "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name,
        }
    ),
    TemporalAndWorkTypeClassifierToolTestCase(
        name="provide_end_date",
        turns=[
            (SILENCE_MESSAGE, "When did you stop working at Acme Inc?"),
        ],
        users_input="June 2020",
        expected_extracted_data={
            "end_date": "06/2020",
            "start_date": None,
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
        name="wage_employment_work_type",
        turns=[
            (SILENCE_MESSAGE, "Have you ever worked for a company or someone else's business for money?"),
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
            "paid_work": False,
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
            "paid_work": False,
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
            "paid_work": False,
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

    # Updating fields.
    TemporalAndWorkTypeClassifierToolTestCase(
        name="user_is_updating_the_fields_simple",
        turns=[
            (SILENCE_MESSAGE, "Let's start by exploring your work experiences. "
                              "Have you ever worked for a company or someone else's business for money?"),
            ("Yes, I worked as a paid Software Engineer intern at Acme for starting in Jan 2021 to June 2025",
             "Cool, thanks. Where is Acme Located?")
        ],
        users_input="It is located in Berlin Germany. Wrong information, sorry, "
                    "I was a Unpaid Personal assistant intern (not paid) From Feb 2020 to Jan 2025",
        expected_extracted_data={
            "paid_work": False,
            "work_type": ContainsString("unpaid"),
            "start_date": "02/2020",
            "end_date": "01/2025"
        }
    ),

    TemporalAndWorkTypeClassifierToolTestCase(
        name="user_is_updating_the_fields_complex_dates",
        turns=[
            (SILENCE_MESSAGE, "Let's start by exploring your work experiences. "
                              "Have you ever worked for a company or someone else's business for money?"),
            ("Yes, I worked as a paid Software Engineer intern at GCC2 for 3 months since January 2021.",
             "Cool, thanks. Where is GCC2 Located?")
        ],
        users_input="It is located in Mombasa Kenya. Wrong information, sorry, I was a UI & UX Designer intern (not paid), and it was for four months.",
        expected_extracted_data={
            "paid_work": False,
            "work_type": ContainsString("unpaid"),
            "start_date": "01/2021",
            "end_date": AnyOf("04/2021", "05/2021")  # Sometime, the LLM might do addition to the end date.
        }
    ),

    # Removing the fields.
    TemporalAndWorkTypeClassifierToolTestCase(
        name="user_is_removing_the_fields",
        turns=[
            (SILENCE_MESSAGE, "Let's start by exploring your work experiences. "
                              "Have you ever worked for a company or someone else's business for money?"),
            ("Yes, I worked as a paid Software Engineer intern at GCC2 for 3 months since January 2021.",
             "Cool, thanks. Where is GCC2 Located?"),
            ("It is located in Mombasa Kenya. Wrong information, sorry, I was a UI & UX Designer intern (not paid), and it was for four months.",
             "Cool, thanks for the update")
        ],
        users_input="Sorry, this should be confidential, would you remove everything?. I don't want you to store anything.",
        expected_extracted_data={
            "paid_work": "",
            "work_type": AnyOf(None, ""),
            "start_date": "",
            "end_date": ""
        }
    ),

    # Irrelevant message
    TemporalAndWorkTypeClassifierToolTestCase(
        name="irrelevant_message",
        turns=[
            (SILENCE_MESSAGE, "Let's start by exploring your work experiences. "
                              "Have you ever worked for a company or someone else's business for money?")
        ],
        users_input="My girlfriend’s been really sick lately, and it’s breaking my heart to see her like this. "
                    "She’s usually so full of energy, but now she barely has the strength to get out of bed. "
                    "I’ve been trying to take care of her the best I can, hoping she gets better soon because I just want to see her smile again.",
        expected_extracted_data={
            "paid_work": None,
            "work_type": None,
            "start_date": None,
            "end_date": None
        }
    ),

    # only start date.
    TemporalAndWorkTypeClassifierToolTestCase(
        name="irrelevant_message",
        turns=[
            (SILENCE_MESSAGE, "Have you run any other businesses, done freelance or contract work?"),
            ("yes, I didi freelance work", "Okay, I understand."
                                           "Can you tell me when you started doing freelance work?"),
        ],
        users_input="in 2018",
        expected_extracted_data={
            "start_date": "2018",
            "end_date": None
        }
    ),

    # The user doesn't remember
    TemporalAndWorkTypeClassifierToolTestCase(
        name="user_doesnt_remember",
        turns=[
            (SILENCE_MESSAGE, "Have you run any other businesses, done freelance or contract work?"),
            ("yes, I didi freelance work", "Okay, I understand."
                                           "Can you tell me when you started doing freelance work?"),
        ],
        users_input="I don't remember.",
        expected_extracted_data={
            "start_date": '',  # The user doesn't remember.
            "end_date": AnyOf(None, '')
        }
    ),

    # Different date formats
    # Look at these default configurations for reference: -
    # backend/app/i18n/locale_date_format.py#_DEFAULT_LOCALE_DATE_FORMAT
    TemporalAndWorkTypeClassifierToolTestCase(
        name="date_format_en_gb",
        locale=Locale.EN_GB,
        turns=[
            (SILENCE_MESSAGE, "Have you run any other businesses, done freelance or contract work?"),
            ("yes, I didi freelance work", "Okay, I understand."
                                           "Can you tell me when you started doing freelance work?"),
        ],
        users_input="on the second of January 2018",
        expected_extracted_data={
            "start_date": "02/01/2018",  # DD/MM/YYYY
            "end_date": None
        }
    ),
    TemporalAndWorkTypeClassifierToolTestCase(
        name="date_format_en_us",
        locale=Locale.EN_US,
        turns=[
            (SILENCE_MESSAGE, "Have you run any other businesses, done freelance or contract work?"),
            ("yes, I didi freelance work", "Okay, I understand."
                                           "Can you tell me when you started doing freelance work?"),
        ],
        users_input="on the second of January 2018",
        expected_extracted_data={
            "start_date": "01/02/2018",  # MM/DD/YYYY
            "end_date": None
        }
    ),
]


@pytest.mark.asyncio
@pytest.mark.repeat(3)
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_temporal_and_work_type_classification(test_case: TemporalAndWorkTypeClassifierToolTestCase, caplog,
                                                     setup_multi_locale_app_config):
    logger = logging.getLogger()
    with caplog.at_level(logging.DEBUG):
        guard_caplog(logger=logger, caplog=caplog)
        get_i18n_manager().set_locale(test_case.locale)

        # GIVEN users last input
        given_user_input = test_case.users_input

        # AND the conversation turns
        # AND the conversation context
        context: ConversationContext = ConversationContext(
            all_history=ConversationHistory(turns=[]),
            history=ConversationHistory(turns=[]),
            summary="")

        for turn in test_case.turns:
            _add_turn_to_context(turn[0], turn[1], context)

        # WHEN the times and work type data extraction LLM is executed
        data_extraction_llm = TemporalAndWorkTypeClassifierTool(logger)
        extracted_data, _ = await data_extraction_llm.execute(users_last_input=given_user_input,
                                                              experience_title=test_case.given_experience_title,
                                                              conversation_context=context)

        if not extracted_data:
            pytest.fail("The LLM did not return any output.")

        # THEN the extracted data should match the expected data
        failures = check_actual_data_matches_expected(actual_data=[extracted_data],
                                                      expected_data=[test_case.expected_extracted_data])

        if len(failures) > 0:
            pytest.fail(
                '\n'.join(failures))


def _add_turn_to_context(user_input: str, agent_output: str, context: ConversationContext):
    turn: ConversationTurn = ConversationTurn(
        index=len(context.history.turns),
        input=AgentInput(message=user_input),
        output=AgentOutput(message_for_user=agent_output,
                           finished=False,
                           agent_response_time_in_sec=0.0,
                           llm_stats=[]
                           )
    )
    context.history.turns.append(turn)
    context.all_history.turns.append(turn)
