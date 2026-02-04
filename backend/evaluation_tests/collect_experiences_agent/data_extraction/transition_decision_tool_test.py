import logging
from typing import Optional

import pytest

from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.collect_experiences_agent import CollectedData
from app.agent.collect_experiences_agent._transition_decision_tool import TransitionDecisionTool, TransitionDecision
from app.agent.experience import WorkType
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationHistory, ConversationTurn
from app.i18n.translation_service import get_i18n_manager
from common_libs.test_utilities.guard_caplog import guard_caplog
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run

SILENCE_MESSAGE = "(silence)"


class TransitionDecisionToolTestCase(CompassTestCase):
    # GIVENs
    turns: list[tuple[str, str]]
    """
    The conversation history.
    First element is what the user said, second element is what the agent said.
    """
    users_last_input: str
    """
    User's last input.
    """
    collected_data: list[CollectedData]
    """
    Collected experience data so far.
    """
    exploring_type: Optional[WorkType]
    """
    Current work type being explored.
    """
    unexplored_types: list[WorkType]
    """
    Work types that haven't been explored yet.
    """
    explored_types: list[WorkType]
    """
    Work types that have been explored.
    """

    # EXPECTED
    expected_transition_decision: TransitionDecision
    """
    Expected transition decision.
    """


test_cases: list[TransitionDecisionToolTestCase] = [
    TransitionDecisionToolTestCase(
        name="incomplete_experience_should_continue",
        turns=[
            (SILENCE_MESSAGE, "What was the company name?"),
            ("Acme Inc", "Great! What was your role at Acme Inc?")
        ],
        users_last_input="Software Engineer",
        collected_data=[
            CollectedData(
                index=0,
                uuid="test-uuid-1",
                experience_title="Software Engineer",
                company="Acme Inc",
                location=None,
                start_date=None,
                end_date=None,
                paid_work=None,
                work_type=None
            )
        ],
        exploring_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        unexplored_types=[WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WorkType.SELF_EMPLOYMENT],
        explored_types=[],
        expected_transition_decision=TransitionDecision.CONTINUE
    ),
    TransitionDecisionToolTestCase(
        name="complete_experience_with_more_types_should_continue",
        turns=[
            (SILENCE_MESSAGE, "Tell me about your work experience"),
            ("I worked as a Software Engineer at Acme Inc in New York from 2020 to 2022",
             "Great! So you worked as a Software Engineer at Acme Inc in New York from 2020 to 2022.")
        ],
        users_last_input="Yes, that's correct",
        collected_data=[
            CollectedData(
                index=0,
                uuid="test-uuid-1",
                experience_title="Software Engineer",
                company="Acme Inc",
                location="New York",
                start_date="2020",
                end_date="2022",
                paid_work=True,
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
            )
        ],
        exploring_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        unexplored_types=[WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WorkType.SELF_EMPLOYMENT],
        explored_types=[],
        expected_transition_decision=TransitionDecision.CONTINUE
    ),
    TransitionDecisionToolTestCase(
        name="user_says_no_more_experiences_current_type_should_end_worktype",
        turns=[
            (SILENCE_MESSAGE, "Have you ever worked for a company or someone else's business for money?"),
            ("Yes, I worked as a Software Engineer at Acme Inc",
             "Great! Do you have any other paid employment experiences?"),
        ],
        users_last_input="No, that's all I have for paid work",
        collected_data=[
            CollectedData(
                index=0,
                uuid="test-uuid-1",
                experience_title="Software Engineer",
                company="Acme Inc",
                location="New York",
                start_date="2020",
                end_date="2022",
                paid_work=True,
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
            )
        ],
        exploring_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        unexplored_types=[WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WorkType.SELF_EMPLOYMENT],
        explored_types=[],
        expected_transition_decision=TransitionDecision.END_WORKTYPE
    ),
    TransitionDecisionToolTestCase(
        name="all_types_explored_recap_asked_user_confirms_should_end_conversation",
        turns=[
            (SILENCE_MESSAGE, "Let's recap the information we have collected so far"),
            ("Let's recap the information we have collected so far: \n• Software Engineer at Acme Inc in New York (2020-2022)\nIs there anything you would like to add or change?",
             "Let's recap the information we have collected so far: \n• Software Engineer at Acme Inc in New York (2020-2022)\nIs there anything you would like to add or change?")
        ],
        users_last_input="No, that looks good to me",
        collected_data=[
            CollectedData(
                index=0,
                uuid="test-uuid-1",
                experience_title="Software Engineer",
                company="Acme Inc",
                location="New York",
                start_date="2020",
                end_date="2022",
                paid_work=True,
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
            )
        ],
        exploring_type=None,
        unexplored_types=[],
        explored_types=[
            WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
            WorkType.SELF_EMPLOYMENT,
            WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK,
            WorkType.UNSEEN_UNPAID
        ],
        expected_transition_decision=TransitionDecision.END_CONVERSATION
    ),
    TransitionDecisionToolTestCase(
        name="all_types_explored_recap_asked_user_wants_changes_should_continue",
        turns=[
            (SILENCE_MESSAGE, "Let's recap the information we have collected so far"),
            ("Let's recap the information we have collected so far: \n• Software Engineer at Acme Inc in New York (2020-2022)\nIs there anything you would like to add or change?",
             "Let's recap the information we have collected so far: \n• Software Engineer at Acme Inc in New York (2020-2022)\nIs there anything you would like to add or change?")
        ],
        users_last_input="Actually, the location should be Brooklyn, not New York",
        collected_data=[
            CollectedData(
                index=0,
                uuid="test-uuid-1",
                experience_title="Software Engineer",
                company="Acme Inc",
                location="New York",
                start_date="2020",
                end_date="2022",
                paid_work=True,
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
            )
        ],
        exploring_type=None,
        unexplored_types=[],
        explored_types=[
            WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
            WorkType.SELF_EMPLOYMENT,
            WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK,
            WorkType.UNSEEN_UNPAID
        ],
        expected_transition_decision=TransitionDecision.CONTINUE
    ),
    TransitionDecisionToolTestCase(
        name="multiple_complete_experiences_should_continue_if_more_types",
        turns=[
            (SILENCE_MESSAGE, "Do you have any other paid work experiences?"),
            ("Yes, I also worked at Google", "Great! Tell me about that.")
        ],
        users_last_input="I was a Product Manager at Google in San Francisco from 2022 to 2024",
        collected_data=[
            CollectedData(
                index=0,
                uuid="test-uuid-1",
                experience_title="Software Engineer",
                company="Acme Inc",
                location="New York",
                start_date="2020",
                end_date="2022",
                paid_work=True,
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
            ),
            CollectedData(
                index=1,
                uuid="test-uuid-2",
                experience_title="Product Manager",
                company="Google",
                location="San Francisco",
                start_date="2022",
                end_date="2024",
                paid_work=True,
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
            )
        ],
        exploring_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        unexplored_types=[WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WorkType.SELF_EMPLOYMENT],
        explored_types=[],
        expected_transition_decision=TransitionDecision.CONTINUE
    ),
    TransitionDecisionToolTestCase(
        name="user_ambiguous_response_about_more_experiences",
        turns=[
            (SILENCE_MESSAGE, "Do you have any other paid work experiences?"),
        ],
        users_last_input="Maybe, I'm not sure",
        collected_data=[
            CollectedData(
                index=0,
                uuid="test-uuid-1",
                experience_title="Software Engineer",
                company="Acme Inc",
                location="New York",
                start_date="2020",
                end_date="2022",
                paid_work=True,
                work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name
            )
        ],
        exploring_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        unexplored_types=[WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT, WorkType.SELF_EMPLOYMENT],
        explored_types=[],
        expected_transition_decision=TransitionDecision.CONTINUE
    ),
]


@pytest.mark.asyncio
@pytest.mark.repeat(3)
@pytest.mark.evaluation_test("gemini-2.5-flash-lite/")
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_transition_decision_tool(test_case: TransitionDecisionToolTestCase, caplog):
    logger = logging.getLogger()
    with caplog.at_level(logging.DEBUG):
        guard_caplog(logger=logger, caplog=caplog)
        get_i18n_manager().set_locale(test_case.locale)

        # GIVEN user's last input
        given_user_input = AgentInput(message=test_case.users_last_input)

        # AND the conversation context
        context: ConversationContext = ConversationContext(
            all_history=ConversationHistory(turns=[]),
            history=ConversationHistory(turns=[]),
            summary="")
        for turn in test_case.turns:
            _add_turn_to_context(turn[0], turn[1], context)

        # WHEN the transition decision tool is executed
        transition_decision_tool = TransitionDecisionTool(logger)
        transition_decision, transition_reasoning, _ = await transition_decision_tool.execute(
            collected_data=test_case.collected_data,
            exploring_type=test_case.exploring_type,
            unexplored_types=test_case.unexplored_types,
            explored_types=test_case.explored_types,
            conversation_context=context,
            user_input=given_user_input
        )

        # THEN the transition decision should match the expected decision
        if transition_decision != test_case.expected_transition_decision:
            pytest.fail(
                f"Expected transition decision: {test_case.expected_transition_decision.value}, "
                f"but got: {transition_decision.value}"
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
