import logging

import pytest
from pydantic import ConfigDict

from app.agent.agent_director._llm_router import LLMRouter
from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationHistory, ConversationTurn
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


class RouterTestCase(CompassTestCase):
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

    conversation_phase: ConversationPhase
    """
    The conversation phase to be used for the test.
    """

    # The THEN (expected)
    expected_agent_type: AgentType

    # arbitrary_types_allowed=True
    model_config = ConfigDict(
        extra="forbid",
    )


test_cases_router = [
    RouterTestCase(
        name="let_s_start",
        summary="",
        turns=[
            ("(silence)",
             "Welcome to brujula! We will start by exploring your work experiences. When you are ready, let me know by saying 'start'."),
        ],
        user_input="Let's start.",
        conversation_phase=ConversationPhase.INTRO,
        expected_agent_type=AgentType.WELCOME_AGENT
    ),
    RouterTestCase(
        name="route_to_welcome_agent",
        summary="",
        turns=[
            ("(silence)",
             "Welcome to brujula! We will start by exploring your work experiences. When you are ready, let me know by saying 'start'."),
            ("Let's start.",
                "Great! Let's start by exploring your work experiences. Please tell me about your first work experience."),
        ],
        user_input="can you please explain what we will do?",
        conversation_phase=ConversationPhase.COUNSELING,
        expected_agent_type=AgentType.WELCOME_AGENT
    ),
    RouterTestCase(
        name="route_to_default_agent_for_welcome_agent",
        summary="",
        turns=[
            ("(silence)",
             "Welcome to brujula! We will start by exploring your work experiences. When you are ready, let me know by saying 'start'."),
        ],
        user_input="the weather is nice today",
        conversation_phase=ConversationPhase.INTRO,
        expected_agent_type=AgentType.WELCOME_AGENT
    ),
    RouterTestCase(
        name="route_to_explore_experiences_agent",
        summary="",
        turns=[
            ("(silence)",
             "Welcome to brujula! We will start by exploring your work experiences. When you are ready, let me know by saying 'start'."),
            ("Let's start.",
             "Great! Let's start by exploring your work experiences. Please tell me about your first work experience."),
        ],
        user_input="i worked as a baker",
        conversation_phase=ConversationPhase.COUNSELING,
        expected_agent_type=AgentType.EXPLORE_EXPERIENCES_AGENT
    ),
    RouterTestCase(
        name="route_to_default_agent_for_counseling_phase",
        summary="",
        turns=[
            ("(silence)",
             "Welcome to brujula! We will start by exploring your work experiences. When you are ready, let me know by saying 'start'."),
            ("Let's start.",
             "Great! Let's start by exploring your work experiences. Please tell me about your first work experience."),
        ],
        user_input="let's finish this conversation",
        conversation_phase=ConversationPhase.COUNSELING,
        expected_agent_type=AgentType.EXPLORE_EXPERIENCES_AGENT
    ),
    RouterTestCase(
        name="understand_last_question_from_context",
        summary="",
        turns=[
            ("(silence)",
             "Welcome to brujula! We will start by exploring your work experiences. When you are ready, let me know by saying 'start'."),
            ("Let's start.",
             "Great! Let's start by exploring your work experiences. Please tell me about your first work experience."),
            ("i worked as a baker", "When did you start working as a baker?"),
            ("I have a question about the process",
                "Sure, I can explain the process. Please tell me what you would like to know."),
            ("i started in 2012 and ended in 2021",
             "What skills did you acquire during your time as a baker?"),
        ],
        user_input="please explain what you mean with your question?",
        conversation_phase=ConversationPhase.COUNSELING,
        expected_agent_type=AgentType.EXPLORE_EXPERIENCES_AGENT
    ),
    RouterTestCase(
        name="understand_older_question_from_context",
        summary="",
        turns=[
            ("(silence)",
             "Welcome to brujula! We will start by exploring your work experiences. When you are ready, let me know by saying 'start'."),
            ("Let's start.",
             "Great! Let's start by exploring your work experiences. Please tell me about your first work experience."),
            ("i worked as a baker", "When did you start working as a baker?"),
            ("I have a question about the process",
             "Sure, I can explain the process. Please tell me what you would like to know."),
            ("i started in 2012 and ended in 2021",
             "What skills did you acquire during your time as a baker?"),
        ],
        user_input="please explain what you mean the question before your last question?",
        conversation_phase=ConversationPhase.COUNSELING,
        expected_agent_type=AgentType.WELCOME_AGENT
    ),
    RouterTestCase(
        name="open_sesame_from_context",
        summary="",
        turns=[
            ("(silence)",
             "Welcome to brujula! We will start by exploring your work experiences. When you are ready, let me know by saying 'start'."),
            ("Let's start.",
             "Great! Let's start by exploring your work experiences. Please tell me about your first work experience."),
            ("i worked as a baker", "When did you start working as a baker?"),
            ("I have a question about the process",
             "Sure, I can explain the process. Please say 'Open sesame' and i will tell you everything you would like to know."),
            ("i started in 2012 and ended in 2021",
             "What skills did you acquire during your time as a baker?"),
        ],
        user_input="Open sesame, i bake bread and pastry",
        conversation_phase=ConversationPhase.COUNSELING,
        expected_agent_type=AgentType.WELCOME_AGENT
    ),
    RouterTestCase(
        name="argentina_route_to_explore",
        summary="",
        turns=[
            ("(silence)", "¡Hola! Bienvenid@ a Brújula. Vamos a arrancar explorando tus experiencias. Decime 'empezar' cuando estés listo/a."),
            ("Empezar", "¡Genial! Contame sobre tu primer laburo.")
        ],
        user_input="Laburé como asistente de ventas",
        conversation_phase=ConversationPhase.COUNSELING,
        expected_agent_type=AgentType.EXPLORE_EXPERIENCES_AGENT
    ),
    RouterTestCase(
        name="argentina_route_to_welcome",
        summary="",
        turns=[
            ("(silence)", "¡Hola! Bienvenid@ a Brújula. Vamos a arrancar explorando tus experiencias. Decime 'empezar' cuando estés listo/a."),
            ("Empezar", "¡Genial! Contame sobre tu primer laburo."),
            ("Laburé como asistente de ventas", "¿Qué hacías ahí?")
        ],
        user_input="Che, ¿me explicás de nuevo qué estamos haciendo?",
        conversation_phase=ConversationPhase.COUNSELING,
        expected_agent_type=AgentType.WELCOME_AGENT
    ),
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases_router),
                         ids=[case.name for case in get_test_cases_to_run(test_cases_router)])
async def test_router_extraction(test_case: RouterTestCase, caplog: pytest.LogCaptureFixture):
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

        # WHEN the data extraction LLM is executed
        llm_router = LLMRouter(logger)
        actual_agent_type = await llm_router.execute(user_input=user_input,
                                                     phase=test_case.conversation_phase,
                                                     context=context)

        # THEN the agent type should be the expected one
        assert actual_agent_type == test_case.expected_agent_type, \
            f"Expected agent type {test_case.expected_agent_type}, but got {actual_agent_type}"

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
