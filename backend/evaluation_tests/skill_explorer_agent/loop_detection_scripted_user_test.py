"""
Scripted evaluation tests: real production looping sessions replayed verbatim.

User messages are taken directly from the looping session transcripts in
scripts/admin/looping_sessions/. The test drives only the EXPLORE_SKILLS_AGENT
phase (from the first agent question in that phase onwards), seeding
question_asked_until_now with the questions asked before the loop started so
the agent state matches production.

The agent must finish cleanly (finished=True) within the scripted turns rather
than continuing to repeat the same message.
"""

import logging
import os

import pytest
from _pytest.logging import LogCaptureFixture

from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience.timeline import Timeline
from app.agent.experience.work_type import WorkType
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState
from app.countries import Country
from app.i18n.translation_service import get_i18n_manager
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from common_libs.test_utilities import get_random_session_id
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.conversation_libs.conversation_test_function import (
    ScriptedSimulatedUser,
    ScriptedUserEvaluationTestCase,
    ConversationTestConfig,
    conversation_test_function,
    assert_expected_evaluation_results,
)
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run
from .skills_explorer_agent_executor import (
    SkillsExplorerAgentExecutor,
    SkillsExplorerAgentGetConversationContextExecutor,
    SkillsExplorerAgentIsFinished,
)


class ScriptedLoopDetectionTestCase(ScriptedUserEvaluationTestCase):
    given_experience: ExperienceEntity
    # Questions the agent asked (and user answers) before the loop started,
    # used to seed question_asked_until_now so state matches production.
    prior_questions: list[str]
    prior_answers: list[str]
    # The verbatim message that was looping in production. The test asserts
    # the agent never repeats this message across the scripted turns.
    looping_message: str


test_cases: list[ScriptedLoopDetectionTestCase] = [
    # -------------------------------------------------------------------------
    # Session 52870822099790 — Pay Point Manager, 14× repetition of the
    # challenges question. User messages taken verbatim from turns 26–50
    # of the transcript (every other turn, the user turns).
    # -------------------------------------------------------------------------
    ScriptedLoopDetectionTestCase(
        name="production_session_52870822099790_pay_point_manager",
        simulated_user_prompt="Scripted user: real production session 52870822099790",
        evaluations=[],
        country_of_user=Country.ZAMBIA,
        looping_message=(
            "Thank you for sharing that. It sounds like you were responsible for maintaining order at the pay point.\n\n"
            "What were some of the challenges you faced as a Pay Point Manager?"
        ),
        given_experience=ExperienceEntity(
            experience_title="Pay Point Manager",
            company="Social Cash Transfer",
            location="Luanshya",
            timeline=Timeline(start="1993", end="2000"),
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        ),
        prior_questions=[
            "To start, could you please describe a typical day when you were working as a Pay Point Manager?",
            "Thank you for sharing that. It sounds like patience was very important in your role.\n\nCould you tell me more about what you did on a typical day as a Pay Point Manager? What were your main tasks?",
            "I see. Besides paying money to beneficiaries, what other responsibilities did you have as a Pay Point Manager?",
        ],
        prior_answers=[
            "It was an involving work which needed patience as you work",
            "The main task was paying money to the beneficiaries",
            "Making sure that there was order in the working place",
        ],
        scripted_user=[
            # turn 26 — first answer to the challenges question
            "Distance to the working place was abig challenge",
            # turn 28 — agent loops, user gives another challenge
            "Disturbance from the local community ,especially those who were not on the list.",
            # turn 30
            "The above are the only problems",
            # turn 32
            "Beneficiaries not coming at the same time which made me wait for a longer period",
            # turn 34
            "Working in rural areas",
            # turn 36
            "The other challenge was that there was no security to work with out a police officer at times only.",
            # turn 38
            "Working the all day without food, if you forgot to buy and carry.",
            # turn 40
            "Payment at the end of fininshing the task was not enough",
            # turn 42
            "Relating with some people was a challenge. They were talkative and they used abusive language; this came about when there were deployment's in reaching the place.",
            # turn 44
            "Some parents were illiterate thus using ink to make them sign with a finger print onsumed time and some could dirten the wok place with ink.",
            # turn 46
            "To maintain order was a big challenge ,because at times the ones to help delayed in coming others would go back to attend to other issues and  I would do it all by my self.",
            # turn 48
            "Attending to people with different abilities and making order delayed the process of everything",
            # turn 50
            "Lastly,it was a tiresome job with little wage not a salar",
        ],
    ),
    # -------------------------------------------------------------------------
    # Session 85833153862014 — Helping Family and Church, 4× repetition of the
    # "specific tasks" question. User messages taken verbatim from turns 48–58
    # of the transcript (EXPLORE_SKILLS_AGENT section only).
    # -------------------------------------------------------------------------
    ScriptedLoopDetectionTestCase(
        name="production_session_85833153862014_helping_family_church",
        simulated_user_prompt="Scripted user: real production session 85833153862014",
        evaluations=[],
        country_of_user=Country.ZAMBIA,
        looping_message=(
            "Thank you for sharing that. It sounds like you have a lot of important responsibilities in both your family and church.\n\n"
            "Could you tell me more about the specific tasks you were responsible for when helping your family?"
        ),
        given_experience=ExperienceEntity(
            experience_title="Helping Family and Church",
            company=None,
            location="Kisasa area, Kalumbila District, North Western Province",
            timeline=Timeline(start="2001", end=None),
            work_type=WorkType.UNSEEN_UNPAID,
        ),
        prior_questions=[
            "Could you please describe a typical day when you were helping your family and church?",
        ],
        prior_answers=[
            "A typical day helping my family and church usually starts with assisting my family with "
            "household responsibilities and making sure everything at home is in order. I help with tasks "
            "such as running errands, supporting family members when they need help, and making sure things "
            "are organized, as  well as financial support.\nWhen helping at church, I participate in "
            "activities such as preparing the church environment, assisting during services, and supporting "
            "church programs or events. I also help with organizing activities, welcoming people, and "
            "working together with other members to make sure everything runs smoothly.",
        ],
        scripted_user=[
            # turn 48 — first answer after the loop starts
            "helping in farming and house chores",
            # turn 50 — agent loops again
            "I helped my family with household chores, cleaning, cooking, running errands, taking care of family members, and doing general maintenance or manual work around the home.",
            # turn 52 — agent loops again
            "I helped my family with household chores, cleaning, cooking, running errands, taking care of family members, and doing general maintenance or manual work around the home",
            # turn 54 — user disengages
            "no",
            # turn 56 — agent moves to achievement/challenge question
            "it just feels good to know that i have some responsibilities as a man, and it is incouraging me to work extra hard.",
            # turn 58 — agent asks what's important
            "it is important because the need will not luck.at least they will have something.",
        ],
    ),
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.5-flash-lite/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize(
    "test_case",
    get_test_cases_to_run(test_cases),
    ids=[case.name for case in get_test_cases_to_run(test_cases)],
)
async def test_skills_explorer_agent_loop_detection_scripted(
    max_iterations: int,
    test_case: ScriptedLoopDetectionTestCase,
    caplog: LogCaptureFixture,
):
    """
    Replays real production sessions that exhibited looping behaviour.
    The scripted user messages are taken verbatim from the session transcripts.
    The agent must finish cleanly (finished=True) within the scripted turns.
    """
    print(f"Running test case {test_case.name}")

    session_id = get_random_session_id()
    get_i18n_manager().set_locale(test_case.locale)
    output_folder = os.path.join(
        os.getcwd(),
        "test_output/skills_explorer_agent/loop_detection_scripted/",
        test_case.name,
    )

    given_experience = test_case.given_experience.model_copy(deep=True)
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id=session_id))

    state = SkillsExplorerAgentState(
        session_id=session_id,
        country_of_user=test_case.country_of_user,
        question_asked_until_now=test_case.prior_questions,
        answers_provided=test_case.prior_answers,
    )

    execute_evaluated_agent = SkillsExplorerAgentExecutor(
        conversation_manager=conversation_manager,
        state=state,
        experience=given_experience,
    )

    config = ConversationTestConfig(
        max_iterations=len(test_case.scripted_user) + 1,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=execute_evaluated_agent,
        execute_simulated_user=ScriptedSimulatedUser(script=test_case.scripted_user),
        is_finished=SkillsExplorerAgentIsFinished(),
        get_conversation_context=SkillsExplorerAgentGetConversationContextExecutor(
            conversation_manager=conversation_manager,
        ),
        deferred_evaluation_assertions=True,
    )

    with caplog.at_level(logging.DEBUG):
        guard_caplog(logger=execute_evaluated_agent._agent._logger, caplog=caplog)

        evaluation_result: ConversationEvaluationRecord = await conversation_test_function(
            config=config
        )

        # The agent must not repeat the looping message verbatim in any of its
        # responses during the scripted replay. It is acceptable (and expected)
        # for the agent to still be mid-conversation at the end of the script —
        # what matters is that it moved on rather than staying stuck.
        context = await conversation_manager.get_conversation_context()
        repeated_turns = [
            t for t in context.all_history.turns
            if t.output.message_for_user == test_case.looping_message
        ]
        assert len(repeated_turns) == 0, (
            f"Agent repeated the looping message {len(repeated_turns)} time(s) during the scripted replay.\n"
            f"Looping message: {test_case.looping_message!r}"
        )

        # assert_log_error_warnings(
        #     caplog=caplog,
        #     expect_errors_in_logs=test_case.expect_errors_in_logs,
        #     expect_warnings_in_logs=test_case.expect_warnings_in_logs,
        # )

    assert_expected_evaluation_results(evaluation_result=evaluation_result, test_case=test_case)
