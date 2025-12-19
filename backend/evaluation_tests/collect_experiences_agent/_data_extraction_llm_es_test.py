import logging
from copy import deepcopy
from textwrap import dedent
from typing import Optional, Awaitable

import pytest
from pydantic import ConfigDict

from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.collect_experiences_agent import CollectedData
from app.agent.collect_experiences_agent._dataextraction_llm import _DataExtractionLLM
from app.agent.experience import WorkType
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationHistory, ConversationTurn
from app.i18n.translation_service import get_i18n_manager
from app.i18n.types import Locale
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from evaluation_tests.matcher import check_actual_data_matches_expected, ContainsString, AnyOf, Matcher, match_expected


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
        name="it_is_not_an_experience_es",
        locale=Locale.ES_ES,
        summary="",
        turns=[
            ("(silence)",
             "Empecemos explorando tus experiencias laborales. ¿Alguna vez has trabajado para una empresa o el negocio de otra persona a cambio de dinero?"),
        ],
        user_input="No estoy seguro de qué quieres decir. Todavía estoy en la escuela secundaria y no he tenido ninguna experiencia laboral profesional.",
        collected_data_so_far=[
        ],
        expected_last_referenced_experience_index=-1,
        expected_collected_data_count=0
    ),
    # Add new experience
    _TestCaseDataExtraction(
        name="add_new_experience_es",
        locale=Locale.ES_ES,
        summary="",
        turns=[
            ("(silence)",
             "Empecemos explorando tus experiencias laborales. ¿Alguna vez has trabajado para una empresa o el negocio de otra persona a cambio de dinero?"),
        ],
        user_input="Vendo zapatos en el mercado local los fines de semana.",
        collected_data_so_far=[
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=1,
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": ContainsString("zapatos"),
             "location": AnyOf(None, ContainsString("mercado local")),
             "company": AnyOf(None, ContainsString("mercado local")),
             "paid_work": AnyOf(True, False),
             "start_date": AnyOf('', None),
             "end_date": AnyOf('', None, ContainsString("Present")),
             "work_type":
                 AnyOf(*WorkType.__members__.keys())
             },
        ]
    ),
    # Update an experience
    _TestCaseDataExtraction(
        name="update_experience_es", # TODO: Failing frequently 2/3
        locale=Locale.ES_ES,
        skip_force="force",
        summary="",
        turns=[
            ("(silence)",
             "Empecemos explorando tus experiencias laborales. ¿Alguna vez has trabajado para una empresa o el negocio de otra persona a cambio de dinero?"),
            ("Vendo zapatos en el mercado local los fines de semana.",
             "Entendido, vendes zapatos en el mercado local los fines de semana. ¿Hay algo más que te gustaría agregar o cambiar sobre esta experiencia?"),
        ],
        user_input="Empecé a vender zapatos en el mercado local los fines de semana en 2019.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Venta de Zapatos', company='Mercado Local',
                          location=None, start_date=None,
                          end_date=None,
                          paid_work=None, work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=1,
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": ContainsString("Zapatos"),
             "location": AnyOf(None, ContainsString("mercado local")),
             "company": ContainsString("Mercado Local"),
             "paid_work": AnyOf(None, True),
             "start_date": ContainsString("2019"),
             "end_date": AnyOf('', None, "Present"),
             "work_type": 'SELF_EMPLOYMENT'
             },
        ]
    ),
    # Delete an experience
    _TestCaseDataExtraction(
        name="delete_experience_es",
        locale=Locale.ES_ES,
        summary="",
        turns=[
            ("(silence)",
             "Empecemos explorando tus experiencias laborales. ¿Alguna vez has trabajado para una empresa o el negocio de otra persona a cambio de dinero?"),
            ("Vendo zapatos en el mercado local los fines de semana.",
             "Entendido, vendes zapatos en el mercado local los fines de semana. ¿Hay algo más que te gustaría agregar o cambiar sobre esta experiencia?"),
        ],
        user_input="Sabes, me equivoqué, no vendo zapatos en el mercado local los fines de semana.",
        collected_data_so_far=[
            CollectedData(index=0, experience_title='Venta de Zapatos', company='Mercado Local', location=None,
                          start_date=None, end_date=None,
                          paid_work=None, work_type='SELF_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=-1,  # The experience should be deleted
        expected_collected_data_count=0
    ),

     # Add new experience AR
    _TestCaseDataExtraction(
        name="add_new_experience_ar",
        locale=Locale.ES_AR,
        summary="",
        turns=[
            ("(silence)",
             "Contame sobre tus laburos. ¿Alguna vez laburaste para alguien?"),
        ],
        user_input="Sí, laburé de asistente de ventas en el local de mi viejo.",
        collected_data_so_far=[
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=1,
        expected_collected_data=[
            {"index": 0,
             "defined_at_turn_number": 1,
             "experience_title": AnyOf(ContainsString("asistente"), ContainsString("venta")),
             "company": AnyOf(ContainsString("viejo"), ContainsString("padre")),
             }
        ]
    ),
    # Update experience AR
    _TestCaseDataExtraction(
        name="update_experience_ar",
        locale=Locale.ES_AR,
        summary="",
        turns=[
            ("(silence)",
             "Contame sobre tus laburos. ¿Alguna vez laburaste para alguien?"),
            ("Laburé de asistente de ventas en el local de mi viejo.",
             "¡Buenísimo! ¿Y qué hacías ahí?"),
        ],
        user_input="Manejaba la guita y atendía a los clientes. Estuve desde 2015 hasta 2022.",
        collected_data_so_far=[
            CollectedData(index=0, defined_at_turn_number=1, experience_title='Asistente de ventas', company='Local de mi viejo',
                          start_date=None,
                          end_date=None,
                          paid_work=None, work_type='FORMAL_SECTOR_WAGED_EMPLOYMENT')
        ],
        expected_last_referenced_experience_index=0,
        expected_collected_data_count=1,
        expected_collected_data=[
            {"index": 0,
             "start_date": ContainsString("2015"),
             "end_date": ContainsString("2022"),
             "experience_title": AnyOf(ContainsString("asistente"), ContainsString("venta")),
             }
        ]
    ),
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases_data_extraction),
                         ids=[case.name for case in get_test_cases_to_run(test_cases_data_extraction)])
async def test_data_extraction(test_case: _TestCaseDataExtraction, caplog: pytest.LogCaptureFixture,
                               setup_multi_locale_app_config):
    logger = logging.getLogger()
    get_i18n_manager().set_locale(test_case.locale)

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
