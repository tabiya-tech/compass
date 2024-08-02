import logging
import pytest
import textwrap

from app.agent.agent_types import AgentInput
from app.agent.collect_experiences_agent import (
    CollectExperiencesAgent,
    CollectExperiencesAgentState,
)
from app.conversation_memory.conversation_memory_types import (
    ConversationContext,
    ConversationHistory,
)
from evaluation_tests.conversation_libs.utils import (
    _add_turn_to_context,
    EVALUATION_OUTRO_PROMPT,
)
from evaluation_tests.one_shot_test_case import (
    OneShotTestCase,
    write_one_shot_test_cases,
)
from evaluation_tests.conversation_libs.evaluators.full_history_evaluator import (
    FullHistoryEvaluator,
)
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run

FIXED_TURNS = [
    ("(silence)", "Welcome. Are you ready to start?"),
    (
        "Yes, I am ready to start.",
        "Great, let's dive in! I am here to help you explore your past experiences. This can also include work that was voluntary or unpaid, such as caring for family members. First of all, have you ever had a paid job?",
    ),
    (
        "Yes I did! Last year, I worked in a Bakery in Cape Town.",
        "Wonderful! What is the name of the Bakery you worked for?",
    ),
]
EVALUATION_INTRO_PROMPT = textwrap.dedent(
    """You are assessing a conversation between a human (SIMULATED_USER) and an
            agent (EVALUATED_AGENT) in charge of collecting past experiences from the user.
"""
)


test_cases_collect_experiences = write_one_shot_test_cases(
    FIXED_TURNS, EVALUATION_INTRO_PROMPT
) + [
    OneShotTestCase(
        name="date_consistency",
        summary="",
        turns=FIXED_TURNS
        + [
            (
                "The name was Fluffy Flour",
                "Great! When did you start working at Fluffy Flour?",
            ),
            ("I started in June 2020", "And when did you stop?"),
        ],
        user_input="I stopped in February 2018.",
        evaluator_prompt=textwrap.dedent(
            f"""{EVALUATION_INTRO_PROMPT}
            You need to evaluate whether the agent notices date inconsistency in the input of the SIMULATED_USER.
            In particular, the conversation should be evaluated negatively if the EVALUATED_AGENT fails to notice date inconsistencies, such as start dates being after end dates.
            Otherwise, if the EVALUATED_AGENT asks additional questions and notices date inconsistencies, it should be positively evaluated.
            {EVALUATION_OUTRO_PROMPT}"""
        ),
        expected_min_score=3,
    )
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize(
    "test_case",
    get_test_cases_to_run(test_cases_collect_experiences),
    ids=[
        case.name
        for case in get_test_cases_to_run(test_cases_collect_experiences)
    ],
)
async def test_collect_experiences(test_case):
    """Tests that the CollectExperiences agent will not give advice."""
    session_id = hash("focus") % 10**10
    collect_experience_agent = CollectExperiencesAgent()
    collect_experience_agent.set_state(
        CollectExperiencesAgentState(session_id=session_id)
    )
    context: ConversationContext = ConversationContext(
        all_history=ConversationHistory(turns=[]),
        history=ConversationHistory(turns=[]),
        summary="",
    )
    # GIVEN the previous conversation context
    for turn in test_case.turns:
        _add_turn_to_context(turn[0], turn[1], context)
    # AND the context summary
    context.summary = test_case.summary
    agent_output = await collect_experience_agent.execute(
        AgentInput(message=test_case.user_input), context=context
    )
    logging.info(f"Agent output: {agent_output.message_for_user}")
    evaluator = FullHistoryEvaluator(
        evaluation_prompt=test_case.evaluator_prompt
    )
    evaluation_output = await evaluator.evaluate(
        test_case.user_input, context, agent_output
    )
    logging.info(f"Evaluation reasoning: {evaluation_output.reason}")
    actual = evaluation_output.score
    assert actual >= test_case.expected_min_score
