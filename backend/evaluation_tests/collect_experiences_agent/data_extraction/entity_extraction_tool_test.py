import logging

import pytest

from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.collect_experiences_agent.data_extraction_llm import EntityExtractionTool
from app.conversation_memory.conversation_memory_types import ConversationTurn, ConversationContext, ConversationHistory
from app.i18n.translation_service import get_i18n_manager
from common_libs.test_utilities.guard_caplog import guard_caplog
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from evaluation_tests.matcher import check_actual_data_matches_expected, ContainsString, AnyOf


class EntityExtractionToolTestCase(CompassTestCase):
    # GIVENs
    turns: list[tuple[str, str]]
    """
    The conversation history.
    First element is what the user said, second element is what the agent said.
    """

    users_input: str
    """
    Users Last input related to this operation.
    """

    # EXPECTED
    expected_extracted_data: dict


SILENCE_MESSAGE = "(silence)"

test_cases: list[EntityExtractionToolTestCase] = [
    # BASIC Tests.

    EntityExtractionToolTestCase(
        name="update_entity_extractor_simple_test_case_company",
        turns=[
            (SILENCE_MESSAGE, "What was the company name")
        ],
        users_input="Acme Inc",
        expected_extracted_data={
            "company": "Acme Inc",
            "location": None,
            "experience_title": None
        }
    ),
    EntityExtractionToolTestCase(
        name="update_entity_extractor_simple_test_case_location",
        turns=[
            (SILENCE_MESSAGE,
             "Have you ever run your own business, or done any freelance or contract work?")
        ],
        users_input="Yes, in Kigali, Rwanda.",
        expected_extracted_data={
            "company": AnyOf(None, ContainsString("Self")),  # Self since it is working for own
            "location": "Kigali, Rwanda",
            "experience_title": AnyOf(None, ContainsString("freelance"), ContainsString("contract"))
        }
    ),
    EntityExtractionToolTestCase(
        name="update_entity_extractor_simple_test_case_experience_title",
        turns=[
            (SILENCE_MESSAGE,
             "Have you ever worked as an unpaid trainee for a company or organization?")
        ],
        users_input="Yes, as a kindergarten mentor.",
        expected_extracted_data={
            "company": AnyOf(None, ContainsString("kindergarten")),
            "location": None,
            "experience_title": ContainsString("kindergarten mentor")
        }
    ),
    EntityExtractionToolTestCase(
        name="update_entity_extractor_simple_all_fields",
        turns=[
            (SILENCE_MESSAGE,
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?")
        ],
        users_input="I worked for a company named Tabiya Located in New York, as a Software Engineer.",
        expected_extracted_data={
            "company": "Tabiya",
            "location": "New York",
            "experience_title": "Software Engineer"
        }
    ),
    EntityExtractionToolTestCase(
        name="company_only_casual_response",
        turns=[
            (SILENCE_MESSAGE, "What company did you work for?")
        ],
        users_input="Microsoft",
        expected_extracted_data={
            "company": "Microsoft",
            "location": None,
            "experience_title": None
        }
    ),
    EntityExtractionToolTestCase(
        name="location_only_volunteer_context",
        turns=[
            (SILENCE_MESSAGE, "Tell me about your work experience")
        ],
        users_input="I did some work in Lagos",
        expected_extracted_data={
            "company": None,
            "location": "Lagos",
            "experience_title": None
        }
    ),
    EntityExtractionToolTestCase(
        name="informal_casual_speech",
        turns=[
            (SILENCE_MESSAGE, "Where have you worked?")
        ],
        users_input="I was doing sales stuff at this place called TechHub in Nairobi",
        expected_extracted_data={
            "company": "TechHub",
            "location": "Nairobi",
            "experience_title": AnyOf(ContainsString("sales"), ContainsString("sell"))
        }
    ),
    EntityExtractionToolTestCase(
        name="job_title_with_seniority",
        turns=[
            (SILENCE_MESSAGE, "What was your position?")
        ],
        users_input="I was a Senior Data Analyst at Andela in Lagos, Nigeria",
        expected_extracted_data={
            "company": "Andela",
            "location": "Lagos, Nigeria",
            "experience_title": "Senior Data Analyst"
        }
    ),

    EntityExtractionToolTestCase(
        name="non_standard_job_description",
        turns=[
            (SILENCE_MESSAGE, "What kind of work did you do?")
        ],
        users_input="I helped people with their computers at a shop in Mombasa",
        expected_extracted_data={
            "company": AnyOf(None, ContainsString("shop")),
            "location": "Mombasa",
            "experience_title": ContainsString("computer")
        }
    ),

    EntityExtractionToolTestCase(
        name="vague_company_reference",
        turns=[
            (SILENCE_MESSAGE,
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?")
        ],
        users_input="Yes, I worked at a hotel in Kigali as a receptionist",
        expected_extracted_data={
            "company": ContainsString("hotel"),
            "location": "Kigali",
            "experience_title": ContainsString("receptionist")
        }
    ),

    EntityExtractionToolTestCase(
        name="unseen_economy",
        turns=[
            (SILENCE_MESSAGE, "Tell me about your work experience")
        ],
        users_input="I sell clothes at the market in Kampala",
        expected_extracted_data={
            "company": ContainsString("market"),
            "location": "Kampala",
            "experience_title": AnyOf(ContainsString("clothe"), ContainsString("sell"))
        }
    ),

    EntityExtractionToolTestCase(
        name="multiple_title_variations",
        turns=[
            (SILENCE_MESSAGE, "What was your role?")
        ],
        users_input="I was a waiter, basically a server, at Java House in Nairobi",
        expected_extracted_data={
            "company": "Java House",
            "location": "Nairobi",
            "experience_title": ContainsString("waiter")
        }
    ),

    EntityExtractionToolTestCase(
        name="complex_natural_sentence_all_entities",
        turns=[
            (SILENCE_MESSAGE, "Can you tell me about your most recent work experience?")
        ],
        users_input="So basically, for the past two years I've been working as a Marketing Coordinator at Equity Bank, "
                    "which is located in Nairobi, and I really enjoyed it",
        expected_extracted_data={
            "company": "Equity Bank",
            "location": "Nairobi",
            "experience_title": "Marketing Coordinator"
        }
    ),

    EntityExtractionToolTestCase(
        name="story_nairobi_weather_to_equity_bank",
        turns=[
            (SILENCE_MESSAGE, "Tell me about your experience with banking services.")
        ],
        users_input="You know, I moved to Nairobi about three years ago and I have to say the weather here is just "
                    "amazing - it's sunny and pleasant almost year-round, not too hot, not too cold. Perfect for "
                    "getting things done! Speaking of getting things done, that's actually when I opened an account "
                    "with Equity Bank. "
                    "Later, I found a job in Nairobi as a Marketing Coordinator at Equity Bank. Back to my account"
                    "I needed a reliable financial partner and honestly, Equity has been fantastic. "
                    "Their customer service is top-notch, the mobile banking app works seamlessly, and they really "
                    "understand the local market. I've been banking with them for three years now and couldn't be happier.",
        expected_extracted_data={
            "company": "Equity Bank",
            "location": "Nairobi",
            "experience_title": "Marketing Coordinator"
        }
    ),

    # Test cases related to updating fields.

    EntityExtractionToolTestCase(
        name="location_update",
        turns=[
            (SILENCE_MESSAGE, "What was your position?"),
            ("I was a Senior Data Analyst at Andela in Lagos, Nigeria",
             "Cool, Just to confirm Andela is located in Lagos, Nigeria.")
        ],
        users_input="No Andela is located in New York, USA, so I was in New York, USA.",
        expected_extracted_data={
            "location": "New York, USA",
        }
    ),

    EntityExtractionToolTestCase(
        name="title_correction",
        turns=[
            (SILENCE_MESSAGE, "What was your role?"),
            ("I was a Software Engineer at Microsoft",
             "Got it, you were a Software Engineer at Microsoft.")
        ],
        users_input="Actually, I was a Senior Software Engineer, not just Software Engineer.",
        expected_extracted_data={
            "experience_title": "Senior Software Engineer"
        }
    ),

    EntityExtractionToolTestCase(
        name="company_name_correction",
        turns=[
            (SILENCE_MESSAGE, "Where did you work?"),
            ("I worked at Google as a Product Manager",
             "Great! So you were a Product Manager at Google.")
        ],
        users_input="No, sorry, it was actually Alphabet, not Google specifically.",
        expected_extracted_data={
            "company": "Alphabet",
            "experience_title": "Product Manager"
        }
    ),

    EntityExtractionToolTestCase(
        name="multiple_corrections",
        turns=[
            (SILENCE_MESSAGE, "Tell me about your last job"),
            ("I was a Junior Developer at Tesla in Austin from 2021 to 2023",
             "So you were a Junior Developer at Tesla in Austin from 2021 to 2023?")
        ],
        users_input="Wait, let me correct that - I was a Mid-level Developer, and it was in Fremont, not Austin.",
        expected_extracted_data={
            "company": "Tesla",
            "experience_title": "Mid-level Developer",
            "location": "Fremont"
        }
    ),
    EntityExtractionToolTestCase(
        name="incremental_update",
        turns=[
            (SILENCE_MESSAGE, "Where did you work?"),
            ("I was at Apple", "Great! What was your role at Apple?"),
            ("I was a Designer", "So you were a Designer at Apple?")
        ],
        users_input="Well, more specifically a UX Designer, and it was at Apple Park in Cupertino.",
        expected_extracted_data={
            "company": AnyOf(ContainsString("Apple"), ContainsString("Apple Park")),
            "experience_title": "UX Designer",
            "location": AnyOf(ContainsString("Cupertino"), ContainsString("Apple Park"))
        }
    ),

    EntityExtractionToolTestCase(
        name="spelling_correction",
        turns=[
            (SILENCE_MESSAGE, "Where did you work?"),
            ("I was at Apllle as a Consultant",
             "You were a Consultant at Apllle?")
        ],
        users_input="No its Apple.",
        expected_extracted_data={
            "company": "Apple",
            "experience_title": "Consultant"
        }
    ),

    EntityExtractionToolTestCase(
        name="correction_with_reasoning",
        turns=[
            (SILENCE_MESSAGE, "Tell me about your role"),
            ("I was a Teacher at Stanford University",
             "You were a Teacher at Stanford University?")
        ],
        users_input="Well, technically I was a Lecturer, not a Teacher. Teacher is more for K-12.",
        expected_extracted_data={
            "company": "Stanford University",
            "experience_title": "Lecturer"
        }
    ),

    # Test cases related to removing fields.

    EntityExtractionToolTestCase(
        name="remove_basic",
        turns=[
            (SILENCE_MESSAGE,
             "Let's start by exploring your work experiences. Have you ever worked for a company or someone else's business for money?"),
            ("I worked for a company named Tabiya Located in New York, as a Software Engineer.",
             "So you worked at Tabiya in New York as a Software Engineer?")
        ],
        users_input="Yes, that's true, Actually let's not say about the company name and location.",
        expected_extracted_data={
            "company": "",
            "location": "",
            "experience_title": "Software Engineer"
        }
    ),

    EntityExtractionToolTestCase(
        name="forget_all",
        turns=[
            (SILENCE_MESSAGE, "What was your last job?"),
            ("I was CTO at a startup called TechFlow in Austin raising Series A",
             "You were CTO at TechFlow in Austin during Series A?")
        ],
        users_input="Actually, forget I said any of that. I can't discuss it publicly.",
        expected_extracted_data={
            "company": "",
            "experience_title": "",
            "location": "",
        },
    )
    ,
    EntityExtractionToolTestCase(
        name="argentina_asistente_ventas",
        turns=[
            (SILENCE_MESSAGE, "Contame de tu laburo más reciente")
        ],
        users_input="Laburé como asistente de ventas en el local de mi viejo en Buenos Aires",
        expected_extracted_data={
            "company": AnyOf(ContainsString("local"), ContainsString("viejo")),
            "location": "Buenos Aires",
            "experience_title": AnyOf(ContainsString("asistente"), ContainsString("ventas"))
        }
    ),
    EntityExtractionToolTestCase(
        name="argentina_casa_madre",
        turns=[
            (SILENCE_MESSAGE, "¿Hiciste algún laburo no pago en casa?")
        ],
        users_input="Sí, estuve laburando en la casa de mi madre, me encargaba de la limpieza y la comida",
        expected_extracted_data={
            "company": AnyOf(ContainsString("casa"), ContainsString("madre")),
            "location": None,
            "experience_title": AnyOf(ContainsString("limpieza"), ContainsString("comida"), ContainsString("casa"))
        }
]


@pytest.mark.asyncio
@pytest.mark.repeat(3)
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_entity_extraction_tool(test_case: EntityExtractionToolTestCase, caplog):
    logger = logging.getLogger()
    with caplog.at_level(logging.DEBUG):
        guard_caplog(logger=logger, caplog=caplog)
        get_i18n_manager().set_locale(test_case.locale)

        # GIVEN users last input
        given_user_input = AgentInput(message=test_case.users_input)

        # AND the conversation context
        context: ConversationContext = ConversationContext(
            all_history=ConversationHistory(turns=[]),
            history=ConversationHistory(turns=[]),
            summary="")
        for turn in test_case.turns:
            _add_turn_to_context(turn[0], turn[1], context)

        # WHEN the entity data extraction LLM is executed
        entity_extraction_tool = EntityExtractionTool(logger)
        extracted_data, _ = await entity_extraction_tool.execute(users_last_input=given_user_input.message,
                                                                 conversation_context=context)

        if not extracted_data:
            pytest.fail("The LLM did not return any output.")

        # THEN the extracted data should match the expected data
        failures = check_actual_data_matches_expected(actual_data=[extracted_data],
                                                      expected_data=[test_case.expected_extracted_data])

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
