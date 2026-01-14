import logging
from textwrap import dedent

import pytest

from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.collect_experiences_agent import CollectedData
from app.agent.collect_experiences_agent.data_extraction_llm import IntentAnalyzerTool
from app.agent.experience import WorkType
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationHistory, ConversationTurn
from app.i18n.translation_service import get_i18n_manager
from app.i18n.types import Locale
from common_libs.test_utilities.guard_caplog import guard_caplog
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from evaluation_tests.matcher import ContainsString, check_actual_data_matches_expected, AnyOf

SILENCE_MESSAGE = "(silence)"


class IntentAnalyzerToolTestCase(CompassTestCase):
    # GIVENs
    turns: list[tuple[str, str]]
    users_last_input: str
    collected_data_so_far: list[CollectedData]

    # EXPECTED
    expected_operations: list[dict]


test_cases: list[IntentAnalyzerToolTestCase] = [
    IntentAnalyzerToolTestCase(
        name="user_adds_new_experience",
        turns=[
            (SILENCE_MESSAGE,
             "Have you done unpaid work such as community volunteering, caregiving for your own or another family, or helping in a household?"),
        ],
        collected_data_so_far=[],
        users_last_input="I worked as a Software Engineer at Acme Inc",
        expected_operations=[
            {
                "data_operation": ContainsString("add"),
                "potential_new_experience_title": ContainsString("software engineer"),
                "users_statement": ContainsString("I worked as a Software Engineer at Acme Inc")
            }
        ]
    ),
    IntentAnalyzerToolTestCase(
        name="user_adds_two_experiences_at_a_time",
        turns=[
            (SILENCE_MESSAGE,
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
        ],
        collected_data_so_far=[],
        users_last_input=dedent("""Ja, I have.
        * Software Architect at ProUbis GmbH in Berlin (2010-2018) - Full-time.
        * Project Manager at the University of Oxford (2018-2020) - Remote, paid job.
        """),
        expected_operations=[
            {
                "data_operation": ContainsString("add"),
                "potential_new_experience_title": ContainsString("Software Architect"),
                "users_statement": ContainsString("Software Architect at ProUbis GmbH in Berlin (2010-2018) - Full-time")
            },
            {
                "data_operation": ContainsString("add"),
                "potential_new_experience_title": ContainsString("Project Manager"),
                "users_statement": ContainsString("Project Manager at the University of Oxford (2018-2020) - Remote, paid job")
            }
        ]
    ),
    IntentAnalyzerToolTestCase(
        name="user_adds_two_experiences_at_a_time_in_one_sentence",
        turns=[
            (SILENCE_MESSAGE,
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
        ],
        users_last_input="I worked as a software developer at Google from 2020-2022, and also did freelance web design for local businesses since 2023.",
        collected_data_so_far=[],
        expected_operations=[
            {
                "data_operation": ContainsString("add"),
                "potential_new_experience_title": ContainsString("software developer"),
                "users_statement": "I worked as a software developer at Google from 2020-2022"
            },
            {
                "data_operation": ContainsString("add"),
                "potential_new_experience_title": AnyOf(ContainsString("freelance web"), ContainsString("Web Designer")),
                "users_statement": ContainsString("freelance web design for local businesses since 2023")
            }
        ]
    ),
    IntentAnalyzerToolTestCase(
        name="update_an_existing_experience",
        collected_data_so_far=[
            CollectedData(
                index=0,
                uuid="test-uuid-1",
                company="Acme Inc",
                experience_title="Software Engineer",
                location="New York",
                start_date=None,
                end_date=None,
                paid_work=True,
                work_type=WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK.name
            )
        ],
        turns=[
            (SILENCE_MESSAGE,
             "Tell me about your work experience"),
            ("I worked as a Marketing Manager at Acme Inc", "Great! What was your role at Acme Inc?")
        ],
        users_last_input="Sorry, I was actually a Cleaner at Acme Inc",
        expected_operations=[
            {
                "data_operation": ContainsString("update"),
                "index": 0,
                "potential_new_experience_title": ContainsString("cleaner"),
                "users_statement": ContainsString("I was actually a Cleaner at Acme Inc")
            }
        ]
    ),
    IntentAnalyzerToolTestCase(
        name="intent_analyzer_tool_many_operations",
        collected_data_so_far=[],
        turns=[
            (SILENCE_MESSAGE,
             "Tell me about your work experience")
        ],
        users_last_input=dedent("""
        These are my experiences:
        
        - Software Engineer at TechVision Ltd in Kigali, Rwanda from January 2022 to March 2024
        - Waitress at Fame Lounge Chicken Mignone Ltd in Addis, Ethiopia from July 2023 to March 2024
        - Research Assistant at African Leadership University – Cool Lab in Tokyo, Japan from September 2021 to December 2021
        - Sales Associate at SmartMart Supermarket in Berlin, Germany from June 2020 to August 2021
        - Waitress at 2plus Restaurant & Bar in Kigali, Rwanda from February 2023 to June 2023
        - Customer Service Intern at MTN Rwanda in Kigali, Rwanda from May 2021 to August 2021
        - Administrative Assistant at Bright Future NGO in Kigali, Rwanda from January 2020 to May 2020
        - Data Entry Clerk at Rwanda Revenue Authority in Kigali, Rwanda from September 2019 to December 2019
        - Teaching Assistant at GS Kimironko 1 in Kigali, Rwanda from January 2019 to August 2022
        - Volunteer Event Coordinator at Kigali Youth Innovation Summit in Kigali, Rwanda from November 2022 to November 2022
        """),
        expected_operations=[
            {
                "data_operation": ContainsString("add"),
                "index": None,
                "potential_new_experience_title": ContainsString("Software Engineer"),
                "users_statement": ContainsString(
                    "Software Engineer at TechVision Ltd in Kigali, Rwanda from January 2022 to March 2024")
            },
            {
                "data_operation": ContainsString("add"),
                "index": None,
                "potential_new_experience_title": ContainsString("Waitress"),
                "users_statement": ContainsString(
                    "Waitress at Fame Lounge Chicken Mignone Ltd in Addis, Ethiopia from July 2023 to March 2024")
            },
            {
                "data_operation": ContainsString("add"),
                "index": None,
                "potential_new_experience_title": ContainsString("Research Assistant"),
                "users_statement": ContainsString(
                    "Research Assistant at African Leadership University – Cool Lab in Tokyo, Japan from September 2021 to December 2021")
            },
            {
                "data_operation": ContainsString("add"),
                "index": None,
                "potential_new_experience_title": ContainsString("Sales Associate"),
                "users_statement": ContainsString(
                    "Sales Associate at SmartMart Supermarket in Berlin, Germany from June 2020 to August 2021")
            },
            {
                "data_operation": ContainsString("add"),
                "index": None,
                "potential_new_experience_title": ContainsString("Waitress"),
                "users_statement": ContainsString(
                    "Waitress at 2plus Restaurant & Bar in Kigali, Rwanda from February 2023 to June 2023")
            },
            {
                "data_operation": ContainsString("add"),
                "index": None,
                "potential_new_experience_title": ContainsString("Customer Service Intern"),
                "users_statement": ContainsString(
                    "Customer Service Intern at MTN Rwanda in Kigali, Rwanda from May 2021 to August 2021")
            },
            {
                "data_operation": ContainsString("add"),
                "index": None,
                "potential_new_experience_title": ContainsString("Administrative Assistant"),
                "users_statement": ContainsString(
                    "Administrative Assistant at Bright Future NGO in Kigali, Rwanda from January 2020 to May 2020")
            },
            {
                "data_operation": ContainsString("add"),
                "index": None,
                "potential_new_experience_title": ContainsString("Data Entry Clerk"),
                "users_statement": ContainsString(
                    "Data Entry Clerk at Rwanda Revenue Authority in Kigali, Rwanda from September 2019 to December 2019")
            },
            {
                "data_operation": ContainsString("add"),
                "index": None,
                "potential_new_experience_title": ContainsString("Teaching Assistant"),
                "users_statement": ContainsString(
                    "Teaching Assistant at GS Kimironko 1 in Kigali, Rwanda from January 2019 to August 2022")
            },
            {
                "data_operation": ContainsString("add"),
                "index": None,
                "potential_new_experience_title": ContainsString("Volunteer Event Coordinator"),
                "users_statement": ContainsString(
                    "Volunteer Event Coordinator at Kigali Youth Innovation Summit in Kigali, Rwanda from November 2022 to November 2022")
            }
        ]
    ),
    IntentAnalyzerToolTestCase(
        name="user_says_irrelevant_statements",
        turns=[
            (SILENCE_MESSAGE,
             "Have you done unpaid work such as community volunteering, caregiving for your own or another family, or helping in a household?"),
        ],
        collected_data_so_far=[],
        users_last_input="I like Nigerian Food",
        expected_operations=[]
    ),
    IntentAnalyzerToolTestCase(
        name="argentina_multiple_experiences",
        locale=Locale.ES_AR,
        turns=[
            (SILENCE_MESSAGE, "Contame sobre tus experiencias laborales o proyectos.")
        ],
        collected_data_so_far=[],
        users_last_input=dedent("""
            Che, te cuento mis laburos:
            - Asistente de ventas en el local de mi viejo (2015-2022).
            - Laburando en la casa de mi vieja ayudando con todo (2022-2025).
            """),
        expected_operations=[
            {
                "data_operation": ContainsString("add"),
                "potential_new_experience_title": AnyOf(ContainsString("asistente"), ContainsString("ventas")),
                "users_statement": ContainsString("Asistente de ventas en el local de mi viejo")
            },
            {
                "data_operation": ContainsString("add"),
                "potential_new_experience_title": AnyOf(ContainsString("casa"), ContainsString("vieja")),
                "users_statement": ContainsString("Laburando en la casa de mi vieja")
            }
        ]
    ),
]


@pytest.mark.asyncio
@pytest.mark.repeat(3)
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_intent_analyzer_tool(test_case: IntentAnalyzerToolTestCase, caplog):
    logger = logging.getLogger()
    with caplog.at_level(logging.DEBUG):
        guard_caplog(logger=logger, caplog=caplog)
        get_i18n_manager().set_locale(test_case.locale)

        # GIVEN the previous conversation context
        context: ConversationContext = ConversationContext(
            all_history=ConversationHistory(turns=[]),
            history=ConversationHistory(turns=[]),
            summary="")
        for turn in test_case.turns:
            _add_turn_to_context(turn[0], turn[1], context)

        # AND users last input
        given_user_input = AgentInput(message=test_case.users_last_input)

        # WHEN the intent analyzer tool is executed
        intent_analyzer_tool = IntentAnalyzerTool(logger)
        operations, _ = await intent_analyzer_tool.execute(
            collected_experience_data_so_far=test_case.collected_data_so_far,
            conversation_context=context,
            users_last_input=given_user_input)

        # THEN the extracted data should match the expected data
        failures = check_actual_data_matches_expected(actual_data=operations,
                                                      expected_data=test_case.expected_operations)

        if len(failures) > 0:
            pytest.fail(
                '\n'.join(failures)
            )


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
