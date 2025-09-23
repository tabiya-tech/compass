import logging
from copy import deepcopy
from textwrap import dedent
from typing import Optional

import pytest
from pydantic import ConfigDict

from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.collect_experiences_agent import CollectedData
from app.agent.collect_experiences_agent._dataextraction_llm import _DataExtractionLLM
from app.agent.experience import WorkType
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationHistory, ConversationTurn
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.matcher import check_actual_data_matches_expected, ContainsString, AnyOf, Matcher, match_expected
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
    expected_last_referenced_experience_index: int | Matcher
    """
    The index of the last referenced experience.
    -1 means no experience was referenced.
    """

    expected_collected_data_count: int
    """
    The expected number of collected data.
    This is used to check if the data extraction LLM added new experiences or not.
    """

    expected_collected_data: Optional[list[dict]] = None
    """
    The expected collected data.
    Optionally assert how the llm should update the collected data.
    If not provided, the test will not assert on the collected data.
    """

    # arbitrary_types_allowed=True
    model_config = ConfigDict(
        arbitrary_types_allowed=True,
        extra="forbid",
    )


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
        expected_collected_data_count=1,
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": ContainsString("selling shoes"),
             "location": AnyOf(None, ContainsString("local market")),
             "company": AnyOf(None, ContainsString("local market")),
             "paid_work": AnyOf(True, False),
             "start_date": AnyOf('', None),
             "end_date": AnyOf('', None, ContainsString("Present")),
             "work_type":
                 AnyOf(*WorkType.__members__.keys())
             },
        ]
    ),
    # Add two experiences at once
    _TestCaseDataExtraction(
        name="add_two_experiences_at_once",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
        ],
        user_input=dedent("""Ja, I have.
        * Software Architect at ProUbis GmbH in Berlin (2010-2018) - Full-time.
        * Project Manager at the University of Oxford (2018-2020) - Remote, paid job.
        """),
        collected_data_so_far=[
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=2,
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": ContainsString("Software Architect"),
             "location": ContainsString("Berlin"),
             "company": ContainsString("ProUbis GmbH"),
             "paid_work": True,
             "start_date": '2010',
             "end_date": '2018',
             "work_type":
                 AnyOf(None, WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name)
             },
            {"index": 1,
                "defined_at_turn_number": 1,
                "experience_title": ContainsString("Project Manager"),
                "location": AnyOf(ContainsString("Oxford"), ContainsString("remote")),
                "company": ContainsString("University of Oxford"),
                "paid_work": True,
                "start_date": '2018',
                "end_date": '2020',
                "work_type":
                    AnyOf(None, WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name)
                },
        ]

    ),
    _TestCaseDataExtraction(name="associate_with_previous_experience",
        summary="",
        turns=[
            ("(silence)",
             "Alright, cool. Have you ever run your own business, or done any freelance or contract work?"),
            ("Yes, I freelanced since June 2020",
             "Nice one! What kind of freelancing work have you been doing?"),
        ],
        user_input="Graphic design teacher working online",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Freelancing', company=None,
                          location=None, start_date='2020/06',
                          end_date=None,
                          paid_work=True, work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=1,
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": ContainsString("Graphic design teacher"),
             "location": AnyOf(None, ContainsString("online"), ContainsString("remote")),
             "company": None,
             "paid_work": AnyOf("True", True),
             "start_date": ContainsString("2020/06"),
             "end_date": None,
             "work_type":
                 AnyOf(WorkType.SELF_EMPLOYMENT.name)
             },
        ]
    ),
    _TestCaseDataExtraction(
        name="associate_with_previous_experience_long_conversation",
        summary="",
        turns=[
            ("(silence)",
             "Alright, cool. Have you ever run your own business, or done any freelance or contract work?"),
            ("Yes, I freelanced since June 2020",
             "Nice one! What kind of freelancing work have you been doing?"),
            ("before i answer, this can you tell me what you mean by freelance?",
             "Yes, freelance work is when you work for yourself or for different clients without being employed by a single company. "),
            ("Sure, so it's like being self-employed?",
             "Exactly! Freelancers often take on short-term projects or contracts for various clients."),
        ],
        user_input="OK, so it was Graphic design teacher and i was working online",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Freelancing', company=None,
                          location=None, start_date='2020/06',
                          end_date=None,
                          paid_work=True, work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=1,
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": ContainsString("Graphic design teacher"),
             "location": AnyOf(ContainsString("online"), ContainsString("remote")),
             "company": None,
             "paid_work": AnyOf("True", True),
             "start_date": ContainsString("2020/06"),
             "end_date": None,
             "work_type":
                 AnyOf(WorkType.SELF_EMPLOYMENT.name)
             },
        ]
    ),
    _TestCaseDataExtraction(name="associate_with_previous_experience_long_conversation_texts",
        summary="",
        turns=[
            ("(silence)",
             "Alright, cool. Have you ever run your own business, or done any freelance or contract work?"),
            ("Yes, I freelanced since June 2020, this was one of the most important experiences in my life."
             "And it i will never forget it because it was the first time i started working and it was a great experience."
             "It made me feel like i was doing something important and it was a great way to learn new skills. "
             "I remember i was so excited to start working and i was really nervous too. "
             "I was worried that i wouldn't be good enough or that i would mess up. "
             "But it turned out to be a great experience and i learned a lot. "
             "I was really proud of myself for taking that step and starting to work.",
             "Nice one! What kind of freelancing work have you been doing?"),
            ("before i answer, this can you tell me what you mean by freelance?",
             "Yes, freelance work is when you work for yourself or for different clients without being employed by a single company. "),
            ("Sure, so it's like being self-employed?",
             "Exactly! Freelancers often take on short-term projects or contracts for various clients."),
        ],
        user_input="During the experience I mentioned, I worked as a graphic design teacher remotely."
                   "I really enjoyed it and would love to do it again. "
                   "Especially because it was fulfilling and I learned a lot.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Freelancing', company=None,
                          location=None, start_date='2020/06',
                          end_date=None,
                          paid_work=True, work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=1,
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": ContainsString("Graphic design teacher"),
             "location": AnyOf(ContainsString("online"), ContainsString("remote")),
             "company": None,
             "paid_work": AnyOf("True", True),
             "start_date": ContainsString("2020/06"),
             "end_date": None,
             "work_type":
                 AnyOf(WorkType.SELF_EMPLOYMENT.name)
             },
        ]
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
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Selling Shoes', company='Local Market',
                          location=None, start_date=None,
                          end_date=None,
                          paid_work=None, work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=AnyOf(0, -1),
        expected_collected_data_count=1,
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": ContainsString("selling shoes"),
             "location": AnyOf(None, ContainsString("local market")),
             "company": AnyOf(None, ContainsString("local market")),
             "paid_work": AnyOf('', None, "True", "False", True, False),
             "start_date": AnyOf('', None),
             "end_date": AnyOf('', None),
             "work_type":
                 AnyOf(WorkType.SELF_EMPLOYMENT.name)
             },
        ]
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
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Selling Shoes', company='Local Market',
                          location=None, start_date=None,
                          end_date=None,
                          paid_work=None, work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=1,
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": "Selling Shoes",
             "location": None,
             "company": "Local Market",
             "paid_work": AnyOf(None, True),
             "start_date": ContainsString("2019"),
             "end_date": AnyOf('', None),
             "work_type": 'SELF_EMPLOYMENT'
             },
        ]
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
            CollectedData(index=0, experience_title='Selling Shoes', company='Local Market', location=None,
                          start_date=None, end_date=None,
                          paid_work=None, work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=-1,  # The experience should be deleted
        expected_collected_data_count=0

    ),
    # Delete an experience from two similar experiences
    _TestCaseDataExtraction(
        name="delete_experience_from_two_similar",
        summary="I provided the names of the organizations I volunteered for: Mombasa Youth Empowerment Network, the Kenya Red Cross Society, "
                "and the Mombasa County Government. "
                "You acknowledged the information and summarized my volunteer experience from 2016 to 2022 in Mombasa. "
                "You then asked if I wanted to add or change anything.",
        turns=[
            ("No.",
             dedent("""
             Let's recap the information we have collected so far:
             • Volunteer Peer mentor, Educator and a mentor manager, 2016 - 2022, Mombasa Youth Empowerment Network, the Kenya Red Cross Society, and the Mombasa County Government, Mombasa

             • Volunteering (Volunteer/Unpaid)

            Is there anything you would like to add or change?
            """)),
        ],
        user_input="You got it wrong, I only have one experience. Figure out which one should be deleted.",
        collected_data_so_far=[CollectedData(index=0, defined_at_turn_number=3,
                                             experience_title='Volunteer Peer mentor, Educator and a mentor manager',
                                             company='Mombasa Youth Empowerment Network, the Kenya Red Cross Society, and the Mombasa County Government',
                                             location='Mombasa', start_date='2016', end_date='2022', paid_work=False,
                                             work_type='None'),
                               CollectedData(index=1, defined_at_turn_number=9, experience_title='Volunteering',
                                             company=None, location=None, start_date='',
                                             end_date='', paid_work=False, work_type='UNSEEN_UNPAID')],
        expected_last_referenced_experience_index=-1,  # The experience should be deleted
        expected_collected_data_count=1,
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 3,
             "experience_title": ContainsString("Volunteer Peer mentor, Educator and a mentor manager"),
             "location": ContainsString("Mombasa"),
             "company": ContainsString(
                 "Mombasa Youth Empowerment Network, the Kenya Red Cross Society, and the Mombasa County Government"),
             "paid_work": False,
             "start_date": '2016',
             "end_date": '2022',
             "work_type":
                 AnyOf(None, 'None')
             },
        ]
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
             "Okay, so they live in the same neighborhood as you in Nairobi. "
             "So, you've been helping your neighbors with their gardens in Nairobi since Form 2.  "
             "Is there anything else you'd like to add or change about this experience?"),
            (" I think that covers it. I really enjoy helping them out.  It's a good way to get some exercise and learn more about gardening.",
             " I'm glad you enjoy it!  So, tell me, have you done any other unpaid work, like helping out your family or friends?"),
            ("Yes, I help my grandmother with transportation. I drive her to appointments and errands.",
             "Got it, you help your grandmother with transportation.  Can you tell me if you get paid for that?")
        ],
        user_input="No, I don't get paid for that. It's just something I do to help her out",
        collected_data_so_far=[
            CollectedData(index=0, experience_title='Helping Neighbors with their gardens', company='Neighbors',
                          location='Nairobi', start_date=None,
                          end_date=None,
                          paid_work=False, work_type='UNSEEN_UNPAID'),
            CollectedData(index=1, experience_title='Helping Grandmother with Transportation', company='Grandmother',
                          location=None, start_date=None,
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
            CollectedData(index=0, experience_title='delivery job', company='Uber Eats', location='Paris',
                          start_date='2021/01', end_date='2023/03',
                          paid_work=True,
                          work_type='FORMAL_SECTOR_WAGED_EMPLOYMENT'),
            CollectedData(index=1, experience_title='Selling old furniture',
                          company='Flea Market of rue Jean Henri Fabre',
                          location='15th arrondissement, near the Eiffel Tower', start_date='2019', end_date='Present',
                          paid_work=True,
                          work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=-1,
        expected_collected_data_count=2
    ),
    _TestCaseDataExtraction(name="refer_to_previous_experience_(withholding_student_e2e)",
        summary="",
        turns=[
            (
                "(silence)",
                "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"
            ),
            (
                "Nope, never. I've only done freelance stuff.",
                "Okay, so you've only done freelance work. Can you tell me about the first time you started doing freelance work?"
            )
        ],
        user_input="June 2020. Started teaching graphic design online. Still doing it.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Freelance Work', company=None,
                          location=None, start_date=None, end_date=None,
                          paid_work=True, work_type='SELF_EMPLOYMENT'),
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=1,
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": ContainsString("teaching graphic design"),
             "location": AnyOf(None,ContainsString("online"), ContainsString("remote")),
             "company": AnyOf(None, ContainsString("self")),
             "paid_work": True,
             "start_date": '2020/06',
             "end_date": ContainsString('present'),
             "work_type":
                 AnyOf(WorkType.SELF_EMPLOYMENT.name)
             },
        ]

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
            )
        ],
        user_input="No, that's all the information I have about that experience.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=2, experience_title='Project Manager',
                          company='University of Oxford', location='Remote',
                          start_date='2018', end_date='2020', paid_work=True,
                          work_type='FORMAL_SECTOR_WAGED_EMPLOYMENT'),
            CollectedData(index=1, defined_at_turn_number=6, experience_title='Software Architect',
                          company='ProUbis GmbH', location='Berlin',
                          start_date='2010', end_date='2018', paid_work=True,
                          work_type='FORMAL_SECTOR_WAGED_EMPLOYMENT'),
            CollectedData(index=2, defined_at_turn_number=9, experience_title='Software Developer', company='Ubis GmbH',
                          location='Berlin', start_date='1998',
                          end_date='', paid_work=False, work_type='FORMAL_SECTOR_UNPAID_TRAINEE_WORK')
        ],
        expected_last_referenced_experience_index=-1,
        expected_collected_data_count=3
    ),
    _TestCaseDataExtraction(
        name="empty_experience_not_added",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("I've worked for a company as a paid employee before.",
             "What is the title of this experience?"),
            ("I prefer not to say.",
             "Thanks! To help me track it, I can tentatively label the title as 'Employee' at 'Company' for now. Does that look right, or would you prefer to provide specifics later")
        ],
        user_input="No, that's not the title, and 'Company' isn't my employer. I don't want to add this yet.",
        collected_data_so_far=[],
        expected_last_referenced_experience_index=-1,
        expected_collected_data_count=0
    ),
    _TestCaseDataExtraction(
        name="update_title_removed_results_in_empty_then_deleted",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("Earlier you set my title; I actually don't want to provide a title.",
             "Okay, would you like me to remove the title for this experience?"),
        ],
        user_input="Yes, remove the title. I don't want to provide one.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='TitleOnly', company=None, location=None,
                          start_date=None,
                          end_date=None,
                          paid_work=None, work_type='UNSEEN_UNPAID')
        ],
        expected_last_referenced_experience_index=-1,
        expected_collected_data_count=0
    ),
    _TestCaseDataExtraction(
        # TODO: this case can fail if the llm decides to set empty as None instead of ''
        name="update_company_removed_results_in_empty_then_deleted",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("Earlier you set my company; I actually don't want to provide a company.",
             "Okay, would you like me to remove the company for this experience?"),
        ],
        user_input="Yes, remove the company. I don't want to provide one.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='', company='Company', location=None,
                          start_date=None,
                          end_date=None,
                          paid_work=None, work_type='UNSEEN_UNPAID')
        ],
        expected_last_referenced_experience_index=-1,
        expected_collected_data_count=0
    ),
    _TestCaseDataExtraction(
        name="update_location_removed_results_in_empty_then_deleted",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("Earlier you set my location; I actually don't want to provide a location.",
             "Okay, would you like me to remove the location for this experience?"),
        ],
        user_input="Yes, remove the location. I don't want to provide one.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='', company=None, location='Location',
                          start_date=None,
                          end_date=None,
                          paid_work=None, work_type='UNSEEN_UNPAID')
        ],
        expected_last_referenced_experience_index=-1,
        expected_collected_data_count=0
    ),
    _TestCaseDataExtraction(
        # TODO: this case can fail if the llm decides to set empty as None instead of ''
        name="update_start_date_removed_results_in_empty_then_deleted",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("Earlier you set my start date; I actually don't want to provide a start date.",
             "Okay, would you like me to remove the start date for this experience?"),
        ],
        user_input="Yes, remove the start date. I don't want to provide one.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='', company=None, location=None,
                          start_date='Start Date', end_date=None,
                          paid_work=None, work_type='UNSEEN_UNPAID')
        ],
        expected_last_referenced_experience_index=-1,
        expected_collected_data_count=0
    ),
    _TestCaseDataExtraction(
        name="update_end_date_removed_results_in_empty_then_deleted",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("Earlier you set my end date; I actually don't want to provide an end date.",
             "Okay, would you like me to remove the end date for this experience?"),
        ],
        user_input="Yes, remove the end date. I don't want to provide one.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='', company=None, location=None,
                          start_date=None,
                          end_date='End Date',
                          paid_work=None, work_type='UNSEEN_UNPAID')
        ],
        expected_last_referenced_experience_index=-1,
        expected_collected_data_count=0
    ),
    _TestCaseDataExtraction(
        name="update_paid_work_removed_results_in_empty_then_deleted",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("Earlier you set my paid work; I actually don't want to provide a paid work.",
             "Okay, would you like me to remove the paid work for this experience?"),
        ],
        user_input="Yes, remove the paid work. I don't want to provide one.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='', company=None, location=None,
                          start_date=None,
                          end_date=None,
                          paid_work=True, work_type='UNSEEN_UNPAID')
        ],
        expected_last_referenced_experience_index=-1,
        expected_collected_data_count=0
    ),
    
    _TestCaseDataExtraction(
        name="multi_experience_simple_two_new",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
        ],
        user_input="I worked as a software developer at Google from 2020-2022, and also did freelance web design for local businesses since 2021.",
        collected_data_so_far=[],
        expected_last_referenced_experience_index=0,  # Should reference first experience
        expected_collected_data_count=2,  # Should collect BOTH experiences
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": ContainsString("software developer"),
             "location": AnyOf(None, ContainsString("Google")),
             "company": ContainsString("Google"),
             "paid_work": True,
             "start_date": '2020',
             "end_date": '2022',
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
             },
            {"index": 1,
             "defined_at_turn_number": 1,
             "experience_title": ContainsString("web design"),
             "location": AnyOf(None, ContainsString("local")),
             "company": AnyOf(None, ContainsString("local businesses")),
             "paid_work": True,
             "start_date": '2021',
             "end_date": "Present",
             "work_type": WorkType.SELF_EMPLOYMENT.name
             }
        ]
    ),
    
    # Mixed case: One new, one update
    _TestCaseDataExtraction(
        name="multi_experience_mixed_new_and_update",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("I worked as a cashier at Walmart last year.",
             "Got it, you worked as a cashier at Walmart last year. Is there anything else you'd like to add or change about this experience?"),
        ],
        user_input="Actually, I worked at Walmart from 2022-2023, and I also did volunteer work at the local food bank during the same time.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Cashier', company='Walmart',
                          location=None, start_date='2023',
                          end_date=None,
                          paid_work=True, work_type='FORMAL_SECTOR_WAGED_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=0,  # Should reference the updated experience
        expected_collected_data_count=2,  # Should have both experiences
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": ContainsString("cashier"),
             "location": AnyOf(None, ContainsString("Walmart")),
             "company": ContainsString("Walmart"),
             "paid_work": True,
             "start_date": '2022',
             "end_date": '2023',
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
             },
            {"index": 1,
             "defined_at_turn_number": 2,  # New experience gets current turn number
             "experience_title": ContainsString("volunteer"),
             "location": AnyOf(None, ContainsString("food bank")),
             "company": AnyOf(None, ContainsString("food bank")),
             "paid_work": False,
             "start_date": '2022',
             "end_date": '2023',
             "work_type": WorkType.UNSEEN_UNPAID.name
             }
        ]
    ),
    
    # Complex case: Three experiences with different operations
    _TestCaseDataExtraction(name="multi_experience_complex_three_operations",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("I worked as a waiter at a restaurant and also did some freelance writing.",
             "Got it, you worked as a waiter at a restaurant and also did some freelance writing. Is there anything else you'd like to add or change about this experience?"),
        ],
        user_input="Actually, I worked as a waiter at Mario's Restaurant from 2021-2022, I still do freelance writing since 2020, and I also want to remove the waiter job - I don't want to include it anymore.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Waiter', company='Restaurant',
                          location=None, start_date=None,
                          end_date=None,
                          paid_work=True, work_type='FORMAL_SECTOR_WAGED_EMPLOYMENT'),
            CollectedData(index=1, defined_at_turn_number=1, experience_title='Freelance Writing', company=None,
                          location=None, start_date='2020',
                          end_date=None,
                          paid_work=True, work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=0,  # Should reference the updated writing experience
        expected_collected_data_count=1,  # Should have only the writing experience (waiter deleted)
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,  # Updated experience keeps original turn number
             "experience_title": ContainsString("freelance writing"),
             "location": AnyOf(None, ContainsString("writing")),
             "company": None,
             "paid_work": True,
             "start_date": '2020',
             "end_date": AnyOf(None, ContainsString('Present')),
             "work_type": WorkType.SELF_EMPLOYMENT.name
             }
        ]
    ),
    
    # Partial information case: Multiple experiences with incomplete data
    _TestCaseDataExtraction(
        name="multi_experience_partial_information",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
        ],
        user_input="I worked at Microsoft and also did some volunteer work, but I can't remember the exact dates for either.",
        collected_data_so_far=[],
        expected_last_referenced_experience_index=0,  # Should reference first experience
        expected_collected_data_count=2,  # Should collect both experiences with partial data
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": AnyOf(None, ContainsString("Microsoft"), ContainsString("Employee")),
             "location": AnyOf(None, ContainsString("Microsoft")),
             "company": ContainsString("Microsoft"),
             "paid_work": True,
             "start_date": AnyOf(None, ''),
             "end_date": AnyOf(None, ''),
             "work_type": WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
             },
            {"index": 1,
             "defined_at_turn_number": 1,
             "experience_title": ContainsString("volunteer"),
             "location": AnyOf(None, ''),
             "company": AnyOf(None, ''),
             "paid_work": False,
             "start_date": AnyOf(None, ''),
             "end_date": AnyOf(None, ''),
             "work_type": WorkType.UNSEEN_UNPAID.name
             }
        ]
    ),
    
    # Edge case: Single message with ADD -> UPDATE -> DELETE (should be no-op)
    _TestCaseDataExtraction(
        name="single_message_add_update_delete_noop",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
        ],
        user_input="I worked at McDonald's. Actually, update that experience - it was at Wendy's. Actually, never mind, delete this experience.",
        collected_data_so_far=[],
        expected_last_referenced_experience_index=-1,  # Should be no-op, no experience referenced
        expected_collected_data_count=0,  # Should result in no experiences
        expected_collected_data=[]  # Empty list - no experiences should remain
    ),
    
    # All operations at once: ADD, UPDATE, DELETE
    _TestCaseDataExtraction(
        name="multi_experience_all_operations",
        summary="",
        turns=[
            ("(silence)",
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("I worked as a teacher and also did some consulting work.",
             "Got it, you worked as a teacher and also did some consulting work. Is there anything else you'd like to add or change about this experience?"),
        ],
        user_input="I taught at Lincoln High School from 2019-2021, I updated my consulting - it was for tech startups from 2020-2022, and I want to remove the teaching job. Also, I did some freelance photography since 2021.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Teacher', company='School',
                          location=None, start_date=None,
                          end_date=None,
                          paid_work=True, work_type='FORMAL_SECTOR_WAGED_EMPLOYMENT'),
            CollectedData(index=1, defined_at_turn_number=1, experience_title='Consulting', company=None,
                          location=None, start_date=None,
                          end_date=None,
                          paid_work=True, work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=0,  # Should reference the updated consulting experience
        expected_collected_data_count=2,  # Should have consulting (updated) and photography (new), teaching deleted
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,  # Updated experience keeps original turn number
             "experience_title": ContainsString("consulting"),
             "location": AnyOf(None, ContainsString("tech")),
             "company": AnyOf(None, ContainsString("tech startups")),
             "paid_work": True,
             "start_date": AnyOf(None, ContainsString('2020')),
             "end_date": AnyOf(None, ContainsString('2022')),
             "work_type": WorkType.SELF_EMPLOYMENT.name
             },
            {"index": 1,
             "defined_at_turn_number": 2,  # New experience gets current turn number
             "experience_title": ContainsString("photography"),
             "location": AnyOf(None, ''),
             "company": AnyOf(None, ContainsString("Self")),
             "paid_work": AnyOf(None, True),
             "start_date": '2021',
             "end_date": AnyOf(None, ContainsString('Present')),
             "work_type": WorkType.SELF_EMPLOYMENT.name
             }
        ]
    ),
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases_data_extraction),
                         ids=[case.name for case in get_test_cases_to_run(test_cases_data_extraction)])
async def test_data_extraction(test_case: _TestCaseDataExtraction, caplog: pytest.LogCaptureFixture):
    logger = logging.getLogger()
    with caplog.at_level(logging.DEBUG):
        guard_caplog(logger=logger, caplog=caplog)

        # GIVEN the previous conversation context
        context: ConversationContext = ConversationContext(
            all_history=ConversationHistory(turns=[]),
            history=ConversationHistory(turns=[]),
            summary="")
        for turn in test_case.turns:
            _add_turn_to_context(turn[0], turn[1], context)
        # AND the context summary
        context.summary = test_case.summary

        # AND the user input
        user_input = AgentInput(message=test_case.user_input)
        # AND the collected data so far
        # Make a deep copy of the collected data to avoid modifying the original test case,
        # since it is passed to the data extraction agent, which mutates it.
        collected_data: list[CollectedData] = deepcopy(test_case.collected_data_so_far)

        # WHEN the data extraction LLM is executed
        data_extraction_llm = _DataExtractionLLM(logger)
        last_referenced_experience_index, _ = await data_extraction_llm.execute(user_input=user_input,
                                                                                context=context,
                                                                                collected_experience_data_so_far=collected_data)

        failures = []
        # THEN the last referenced experience index should be the expected one
        if not match_expected(
                actual=last_referenced_experience_index,
                expected=test_case.expected_last_referenced_experience_index
        ):
            failures.append(
                f"Expected last referenced experience index {test_case.expected_last_referenced_experience_index}, but got {last_referenced_experience_index}"
            )
        # AND the collected data should be the expected one
        if len(collected_data) != test_case.expected_collected_data_count:
            failures.append(
                f"Expected {test_case.expected_collected_data_count} collected data, but got {len(collected_data)}"
            )
        if test_case.expected_collected_data is not None:
            _failures = check_actual_data_matches_expected(actual_data=collected_data,
                                                           expected_data=test_case.expected_collected_data,
                                                           preserve_order=True)
            failures.extend(_failures)

        if len(failures) > 0:
            pytest.fail(
                '\n'.join(failures)
            )
        # AND the log messages should not contain any errors
        assert_log_error_warnings(caplog=caplog, expect_errors_in_logs=False, expect_warnings_in_logs=True)


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
