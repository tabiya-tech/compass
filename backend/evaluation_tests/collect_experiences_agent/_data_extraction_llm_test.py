import logging

import pytest

from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.collect_experiences_agent import CollectedData
from app.agent.collect_experiences_agent._dataextraction_llm import _DataExtractionLLM
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationHistory, ConversationTurn
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


class _TestCaseDataExtraction(CompassTestCase):
    # The GIVEN
    turns: list[tuple[str, str]]
    """
    The conversation history.
    First element is what the user said, second element is what the agent said.
    """

    summary: str
    """
    The context summary. Can be empty.
    """

    user_input: str
    """
    The last user input.
    """

    collected_data_so_far: list[CollectedData]
    """
    The collected data so far.
    """

    # The THEN (expected)
    expected_last_referenced_experience_index: int
    expected_collected_data_count: int


test_cases_data_extraction = [
    # No experience
    _TestCaseDataExtraction(
        name="it_is_not_an_experience",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
        ],
        user_input="I am not sure what you mean by that. I am still in high school and haven't had any professional work experience.",
        collected_data_so_far=[
        ],
        expected_last_referenced_experience_index=-1,
        expected_collected_data_count=0
    ),
    # Add new experience
    _TestCaseDataExtraction(
        name="add_new_experience",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
        ],
        user_input="I sell shoes at the local market on weekends.",
        collected_data_so_far=[
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=1
    ),
    # Do not add twice
    _TestCaseDataExtraction(
        name="do_not_add_twice",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("I sell shoes at the local market on weekends.",
             "Got it, you sell shoes at the local market on weekends. Is there anything else you'd like to add or change about this experience?"),
        ],
        user_input="I sell shoes at the local market on weekends?",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Selling Shoes', company='Local Market', location=None, start_date=None,
                          end_date=None,
                          paid_work=None, work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=1
    ),
    # Update an experience
    _TestCaseDataExtraction(
        name="update_experience",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("I sell shoes at the local market on weekends.",
             "Got it, you sell shoes at the local market on weekends. Is there anything else you'd like to add or change about this experience?"),
        ],
        user_input="I started selling shoes at the local market on weekends in 2019.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Selling Shoes', company='Local Market', location=None, start_date=None,
                          end_date=None,
                          paid_work=None, work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=1
    ),

    # Delete an experience
    _TestCaseDataExtraction(
        name="delete_experience",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("I sell shoes at the local market on weekends.",
             "Got it, you sell shoes at the local market on weekends. Is there anything else you'd like to add or change about this experience?"),
        ],
        user_input="you know, i was wrong i don't sell shoes at the local market on weekends.",
        collected_data_so_far=[
            CollectedData(index=0, experience_title='Selling Shoes', company='Local Market', location=None, start_date=None, end_date=None,
                          paid_work=None, work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=-1,  # The experience should be deleted
        expected_collected_data_count=0
    ),
    # Complex Test cases based on failing e2e tests of the collect experiences agent
    _TestCaseDataExtraction(
        name="helping_grandmother_found_once_(un_experienced_student_e2e)",
        summary="You asked me about my work experiences. I told you I'm still in high school and haven't had any professional work experience. "
                "You then asked if I've ever done any unpaid work, like running my own business, freelancing, or being a trainee. "
                "I told you I haven't done any of that either. You then asked if I've ever done any community volunteering work. "
                "I told you I help my neighbors with their gardens sometimes. You asked if that is paid work and I told you it's not. "
                "I do it because I enjoy gardening and want to help out. You then asked me when I started doing this. "
                "I told you I started helping my neighbors with their gardens a few years ago, maybe when I was in Form 2. "
                "You then asked if I still help them now. I told you I still help them out whenever I have time. You then asked me what area I help them in. "
                "I told you I mostly help them with weeding, watering, and sometimes planting new things. You then asked me where my neighbors live.",
        turns=[
            ("Mostly weeding, watering, and sometimes planting new things.",
             "Cool, so you help them with weeding, watering, and sometimes planting.  I see, you've been helping your neighbors with their gardens "
             "for a few years now.  Can you tell me where they live?"),
            ("They live in the same neighborhood as me, in Nairobi.",
             "Okay, so they live in the same neighborhood as you in Nairobi.  So, you've been helping your neighbors with their gardens in Nairobi since Form 2.  "
             "Is there anything else you'd like to add or change about this experience?"),
            (" I think that covers it. I really enjoy helping them out.  It's a good way to get some exercise and learn more about gardening.",
             " I'm glad you enjoy it!  So, tell me, have you done any other unpaid work, like helping out your family or friends?"),
            ("Yes, I help my grandmother with transportation. I drive her to appointments and errands.",
             "Got it, you help your grandmother with transportation.  Can you tell me if you get paid for that?")
        ],
        user_input="No, I don't get paid for that. It's just something I do to help her out",
        collected_data_so_far=[
            CollectedData(index=0, experience_title='Helping Neighbors with their gardens', company='Neighbors', location='Nairobi', start_date=None,
                          end_date=None,
                          paid_work=False, work_type='UNSEEN_UNPAID'),
            CollectedData(index=1, experience_title='Helping Grandmother with Transportation', company='Grandmother', location=None, start_date=None,
                          end_date=None,
                          paid_work=None, work_type='UNSEEN_UNPAID')
        ],
        expected_last_referenced_experience_index=1,
        expected_collected_data_count=2
    ),

    _TestCaseDataExtraction(
        name="unpaid trainee_not_an_experience_(french_worker_typos_e2e)",
        summary="I told you I work as a delivery driver for Uber Eats in Paris and also sell old furniture at the Flea Market of rue "
                "Jean Henri Fabre with my brother. You asked me if this is paid work and I confirmed that we get paid 100 euros at the end of the day. "
                "You then asked me when I started doing this and I told you it was in 2019. You are now curious about if I have an end date for this and "
                "I told you I'm still doing it. You are now curious about the location of the Flea Market of rue Jean Henri Fabre and I told you it's "
                "in the 15th arrondissement, near the Eiffel Tower",
        turns=[
            (
                "No, that's all.",
                "Cool,  Do you have any other experiences working for a company or someone else's business for money?"
            ),
            (
                "Nope, that's it.",
                "Okay,  Do you have any other experiences running your own business, doing freelance or contract work?"
            ), (
                "I don't have any other experience.",
                "Tell me, have you ever worked as an unpaid trainee for a company or organization?"
            )
        ],
        user_input="No, I haven't.",
        collected_data_so_far=[
            CollectedData(index=0, experience_title='delivery job', company='Uber Eats', location='Paris', start_date='2021/01', end_date='2023/03',
                          paid_work=True,
                          work_type='FORMAL_SECTOR_WAGED_EMPLOYMENT'),
            CollectedData(index=1, experience_title='Selling old furniture', company='Flea Market of rue Jean Henri Fabre',
                          location='15th arrondissement, near the Eiffel Tower', start_date='2019', end_date='Present', paid_work=True,
                          work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=-1,
        expected_collected_data_count=2
    ),
    _TestCaseDataExtraction(
        name="refer_to_previous_experience_(withholding_student_e2e)",
        summary="",
        turns=[
            (
                "(silence)",
                "Let's start by exploring your work experiences.  Have you ever worked for a company or someone else's business for money?"
            ),
            (
                "Nope, never.  I've only done freelance stuff.",
                "Okay, so you've only done freelance work. Can you tell me about the first time you started doing freelance work?"
            )
        ],
        user_input="June 2020.  Started teaching graphic design online.  Still doing it.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Freelance Work', company=None, location=None, start_date=None, end_date=None,
                          paid_work=True, work_type='SELF_EMPLOYMENT'),
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=1
    ),
    _TestCaseDataExtraction(
        name="no_more_info_is_not_delete(experiences_of_all_kinds_all_at_once)",
        summary="You asked me about my work experiences and I told you about my work as a project manager at the University of Oxford, "
                "a software architect at ProUbis GmbH, and an unpaid internship as a Software Developer for Ubis GmbH. "
                "You then asked me to tell you more about my work at the University of Oxford and ProUbis GmbH. "
                "I told you about the details of those experiences. You then asked me to tell you more about my internship at Ubis GmbH. "
                "I told you that it was an unpaid internship in Berlin in 1998. You then asked me if it was a full-time internship "
                "and I told you I don't have information about whether it was full-time or part-time. "
                "You then asked me if I have any more information about this experience. I told you that's all the information I have. "
                "You then summarized the information about my internship and asked if I would like to add or change anything. "
                "I told you that's all the information I have",
        turns=[
            (
                "No, that's all the information I have about that experience.",
                "Okay, so we have: \n\nYou did an unpaid internship as a Software Developer for Ubis GmbH in Berlin in 1998.\n\n"
                "Would you like to add or change anything?"
            ),
            (
                "No, that's all the information I have about that experience.",
                "Okay, so we have: \n\nYou did an unpaid internship as a Software Developer for Ubis GmbH in Berlin in 1998.\n\n"
                "Would you like to add or change anything?"
            ),
            (
                "No, that's all the information I have about that experience.",
                "Okay, so we have: \n\nYou did an unpaid internship as a Software Developer for Ubis GmbH in Berlin in 1998.\n\n"
                "Would you like to add or change anything?"
            )
        ],
        user_input="No, that's all the information I have about that experience.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=2, experience_title='Project Manager', company='University of Oxford', location='Remote',
                          start_date='2018', end_date='2020', paid_work=True, work_type='FORMAL_SECTOR_WAGED_EMPLOYMENT'),
            CollectedData(index=1, defined_at_turn_number=6, experience_title='Software Architect', company='ProUbis GmbH', location='Berlin',
                          start_date='2010', end_date='2018', paid_work=True, work_type='FORMAL_SECTOR_WAGED_EMPLOYMENT'),
            CollectedData(index=2, defined_at_turn_number=9, experience_title='Software Developer', company='Ubis GmbH', location='Berlin', start_date='1998',
                          end_date='', paid_work=False, work_type='FORMAL_SECTOR_UNPAID_TRAINEE_WORK')
        ],
        expected_last_referenced_experience_index=2,
        expected_collected_data_count=3
    )
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases_data_extraction),
                         ids=[case.name for case in get_test_cases_to_run(test_cases_data_extraction)])
async def test_data_extraction(test_case: _TestCaseDataExtraction):
    context: ConversationContext = ConversationContext(
        all_history=ConversationHistory(turns=[]),
        history=ConversationHistory(turns=[]),
        summary="")
    # GIVEN the previous conversation context
    for turn in test_case.turns:
        _add_turn_to_context(turn[0], turn[1], context)
    # AND the context summary
    context.summary = test_case.summary

    # AND the user input
    user_input = AgentInput(message=test_case.user_input)
    # AND the collected data so far
    collected_data: list[CollectedData] = test_case.collected_data_so_far

    # WHEN the data extraction LLM is executed
    data_extraction_llm = _DataExtractionLLM(logging.getLogger())
    last_referenced_experience_index, _ = await data_extraction_llm.execute(user_input=user_input,
                                                                            context=context,
                                                                            collected_experience_data_so_far=collected_data)
    # THEN the last referenced experience index should be the expected one
    assert last_referenced_experience_index == test_case.expected_last_referenced_experience_index

    # AND the collected data should be the expected one
    assert len(collected_data) == test_case.expected_collected_data_count


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
