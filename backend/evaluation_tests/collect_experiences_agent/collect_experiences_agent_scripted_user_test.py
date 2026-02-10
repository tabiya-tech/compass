import logging
import os
from typing import Coroutine, Callable, Awaitable

import pytest
from _pytest.logging import LogCaptureFixture

from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager, \
    ConversationMemoryManagerState
from app.countries import Country
from app.i18n.translation_service import get_i18n_manager
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from common_libs.test_utilities import get_random_session_id
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from evaluation_tests.collect_experiences_agent.collect_experiences_executor import CollectExperiencesAgentExecutor, \
    CollectExperienceAgentGetConversationContextExecutor, CollectExperienceAgentIsFinished
from evaluation_tests.conversation_libs.conversation_test_function import conversation_test_function, \
    ConversationTestConfig, ScriptedUserEvaluationTestCase, ScriptedSimulatedUser


@pytest.fixture(scope="function")
async def setup_collect_experiences_agent() -> tuple[
    ConversationMemoryManager,
    Callable[
        [LogCaptureFixture, ScriptedUserEvaluationTestCase, Country],
        Coroutine[None, None, None]
    ]
]:
    session_id = get_random_session_id()
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id=session_id))

    async def collect_experiences_exec(caplog: LogCaptureFixture, test_case: ScriptedUserEvaluationTestCase, country: Country):
        print(f"Running test case {test_case.name}")

        get_i18n_manager().set_locale(test_case.locale)
        output_folder = os.path.join(os.getcwd(), 'test_output/collect_experiences_agent/scripted', test_case.name)
        execute_evaluated_agent = CollectExperiencesAgentExecutor(
            conversation_manager=conversation_manager,
            session_id=session_id,
            country_of_user=country
        )

        config = ConversationTestConfig(
            max_iterations=len(test_case.scripted_user),
            test_case=test_case,
            output_folder=output_folder,
            execute_evaluated_agent=execute_evaluated_agent,
            execute_simulated_user=ScriptedSimulatedUser(script=test_case.scripted_user),
            is_finished=CollectExperienceAgentIsFinished(executor=execute_evaluated_agent),
            get_conversation_context=CollectExperienceAgentGetConversationContextExecutor(
                conversation_manager=conversation_manager)
        )

        with caplog.at_level(logging.DEBUG):
            guard_caplog(logger=execute_evaluated_agent._agent._logger, caplog=caplog)

            await conversation_test_function(
                config=config
            )

            assert_log_error_warnings(caplog=caplog,
                                      expect_errors_in_logs=False,
                                      expect_warnings_in_logs=True)

    return conversation_manager, collect_experiences_exec


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.5-flash-lite/")
@pytest.mark.repeat(3)
async def test_kenyan_user_multiple_experiences_transition_issues(caplog: LogCaptureFixture,
                                                                  setup_collect_experiences_agent: Awaitable[tuple[
                                                                      ConversationMemoryManager, Callable[
                                                                          [LogCaptureFixture, ScriptedUserEvaluationTestCase, Country],
                                                                          Coroutine[None, None, None]
                                                                      ]]],
                                                                  setup_multi_locale_app_config):
    """
    Scripted test based on a real user conversation that had transition issues.
    Tests that the agent properly transitions between work types and collects all experiences correctly.
    """

    given_test_case = ScriptedUserEvaluationTestCase(
        name='kenyan_user_multiple_experiences_transition_issues',
        simulated_user_prompt="Scripted user: Kenyan user with multiple work experiences",
        scripted_user=[
            "yes",
            "yes, not necessarily a company but i did work for this lady where i took care of her kids, cleaned and cooked for them. that helped me get money to do a course back in 2014",
            "oh and it was in Vihiga.. i did 2 gigz then",
            "hey I didn't say it was 2014 to 2014... where did you get that?",
            "i worked for about 18 months with that lady, she was nice",
            "haven't we just discussed it? i worked for her in 2014 for about 18 months",
            "no can't remember, but it was around that time",
            "na that's cool",
            "so the 1st gig is helping the lady..we've just talked about it ya. then on my off days, i used to cook and sell chapati.. you know guys in vihiga love chapati's so that was a nice way to spend my off days making extra cash. but this was for myself and you asked about working for other people",
            "like which one?",
            "uuuh ya, after my course i did work as a secretary in 2016 for about 9 months at a school. it was an ok job but the hours were too much so i decided to try get into a bigger company. this small companies are hard with hours you know",
            "in machakos and wow that place is hot",
            "nop, that's it",
            "yes, i worked for about 9 months so not sure it's 2016 to 2016... but i can't tell you the exact month i started.. i can change that later right?",
            "no secretary was for 9 months... you've put 2 years?",
            "yes",
            "no that's cool",
            "nop",
            "wow, i told you already in vihiga? same time as I was taking care of the kids? so it has same timeline",
            "yes",
            "no looks good",
            "to the public, they like eating it.. chapati is a type of food famous in kenya",
            "same period as when i was taking care of the vihiga lady's children",
            "no",
            "yes they are the same",
            "no",
            "well selling of chapati was my own business?",
            "no",
            "yes, during internship for my course. it's a requirement to get an internship so i did it for 3 months. it was unpaid but they gave me transport money",
            "it was called Lukola Associates, i was in their thika office",
            "during my course so around the end of 2015, i think i started in sept 2015",
            "no",
            "no, that's it",
            "no",
            "no, that's it",
            "no",
            "no, you have all the experiences Compass.. now can we do the skills?",
            "you have repeated selling chapati 3 times.. it's thee same thing",
            "yes it's ok now",
            "uum i am not sure... communication skills?",
            "i have volunteering at an orphanage just once... there are no 2 instances",
            "yes",
        ],
        evaluations=[]
    )

    conversation_manager, collect_experiences_exec = await setup_collect_experiences_agent
    await collect_experiences_exec(caplog, given_test_case, Country.KENYA)

    context = await conversation_manager.get_conversation_context()
    assert context.history.turns[-1].output.finished


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.5-flash/")
@pytest.mark.repeat(3)
async def test_stuck_after_recap_confirmation(caplog: LogCaptureFixture,
                                             setup_collect_experiences_agent: Awaitable[tuple[
                                                 ConversationMemoryManager, Callable[
                                                     [LogCaptureFixture, ScriptedUserEvaluationTestCase, Country],
                                                     Coroutine[None, None, None]
                                                 ]]],
                                             setup_multi_locale_app_config):
    """
    Scripted test based on a conversation where the agent got stuck after recap confirmation.
    The agent asked for recap, user confirmed "That's right", but then agent didn't properly end
    and instead asked about work types again, creating a loop.
    
    This test focuses on the COLLECT_EXPERIENCES_AGENT phase only (up to index 31 where it finishes).
    """

    given_test_case = ScriptedUserEvaluationTestCase(
        name='stuck_after_recap_confirmation',
        simulated_user_prompt="Scripted user: User with two waged employment experiences who confirms recap but agent gets stuck",
        scripted_user=[
            "Ready.",
            "Yes, I have.",
            "Shoe Salesperson\nSnack Salesperson",
            "I am a Shoe Salesperson at Shoe Soles, a shoe store in Tokyo. I have been working there from 2023 to present.",
            "I was a Snack Salesperson at Hong Kong Fast Snacks from January of 2020 to December of 2022.",
            "No.",
            "No.",
            "No.",
            "No.",
            "That's right.",
            "Great! Let's dive deeper into each of these experiences to capture all the important details.\n\nLet's start with your most recent role: **Shoe Salesperson at Shoe Soles**.\n\nCould you please tell me more about this experience? What were your main responsibilities or duties in this role?",
            "Got it. I understand we're still in the outlining phase. I've provided the basic details for both roles. What's next?",
            "Okay, understood. What's the next step?",
            "Okay, I'm ready.\n\nAs a Shoe Salesperson at Shoe Soles, a shoe store in Tokyo, from 2023 to present, my responsibilities include assisting customers in finding suitable shoes, providing product information, handling sales transactions, managing inventory, and maintaining store cleanliness and display.",
            "Understood. My apologies. I'll wait for your next instruction.",
            "Okay, I'm ready for the next step.",
            "Understood.",
            "Okay. What's next?",
            "Okay, I'm ready.\n\nAs a Shoe Salesperson at Shoe Soles, a shoe store in Tokyo, from 2023 to present, my responsibilities include assisting customers in finding suitable shoes, providing product information, handling sales transactions, managing inventory, and maintaining store cleanliness and display.",
            "Understood. My apologies. I'll await your instruction for the next step.",
            "Okay, I'm ready for the next step.",
            "No.",
            "No.",
            "No.",
            "That's correct.",
            "Understood.",
            "Okay.",
            "Understood.",
            "No.",
        ],
        evaluations=[]
    )

    conversation_manager, collect_experiences_exec = await setup_collect_experiences_agent
    await collect_experiences_exec(caplog, given_test_case, Country.UNSPECIFIED)

    context = await conversation_manager.get_conversation_context()
    assert context.history.turns[-1].output.finished
