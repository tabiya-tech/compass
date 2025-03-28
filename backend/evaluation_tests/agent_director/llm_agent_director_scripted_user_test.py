import asyncio
import dataclasses
import logging
import os
from typing import Coroutine, Callable, Awaitable

import pytest
from _pytest.logging import LogCaptureFixture

from app.vector_search.vector_search_dependencies import SearchServices
from app.agent.agent_director.abstract_agent_director import AgentDirectorState
from app.agent.agent_types import AgentType
from app.agent.collect_experiences_agent import CollectExperiencesAgentState
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState
from app.agent.agent_director.llm_agent_director import LLMAgentDirector
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager, \
    ConversationMemoryManagerState
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from evaluation_tests.agent_director.agent_director_executors import AgentDirectorExecutor, \
    AgentDirectorGetConversationContextExecutor, AgentDirectorIsFinished
from evaluation_tests.conversation_libs.conversation_test_function import conversation_test_function, \
    ConversationTestConfig, ScriptedUserEvaluationTestCase, \
    ScriptedSimulatedUser

from common_libs.test_utilities import get_random_session_id


@pytest.fixture(scope="session")
def event_loop():
    """
    Makes sure that all the async calls finish.

    Without it, the tests sometimes fail with "Event loop is closed" error.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def setup_agent_director(setup_search_services: Awaitable[SearchServices]) -> tuple[
    ConversationMemoryManager,
    Callable[
        [LogCaptureFixture, ScriptedUserEvaluationTestCase],
        Coroutine[None, None, None]
    ]
]:
    session_id = get_random_session_id()
    # The conversation manager for this test
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id=session_id))
    # The Search Services for this test
    search_services = await setup_search_services
    agent_director = LLMAgentDirector(conversation_manager, search_services)
    agent_director.set_state(AgentDirectorState(session_id=session_id))
    explore_experiences_agent = agent_director.get_explore_experiences_agent()
    explore_experiences_agent.set_state(ExploreExperiencesAgentDirectorState(session_id=session_id))
    explore_experiences_agent.get_collect_experiences_agent().set_state(CollectExperiencesAgentState(session_id=session_id))

    async def agent_director_exec(caplog, test_case):
        print(f"Running test case {test_case.name}")

        output_folder = os.path.join(os.getcwd(), 'test_output/llm_agent_director/scripted', test_case.name)

        execute_evaluated_agent = AgentDirectorExecutor(agent_director=agent_director)

        # Run the conversation test
        config = ConversationTestConfig(
            # Ignoring max_iterations,
            # the agent is expected to complete the conversation at the last input from the user
            max_iterations=len(test_case.scripted_user) + 1,
            test_case=test_case,
            output_folder=output_folder,
            execute_evaluated_agent=execute_evaluated_agent,
            execute_simulated_user=ScriptedSimulatedUser(script=test_case.scripted_user),
            is_finished=AgentDirectorIsFinished(),
            get_conversation_context=AgentDirectorGetConversationContextExecutor(
                conversation_manager=conversation_manager)
        )
        # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
        # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
        # the log messages to the root logger. For this reason, we add additional guards.
        with caplog.at_level(logging.DEBUG):
            # Guards to ensure that the loggers are correctly setup,
            # otherwise the tests cannot be trusted that they correctly assert the absence of errors and warnings.
            guard_warning_msg = logging.getLevelName(logging.WARNING) + str(session_id)  # some random string
            execute_evaluated_agent._agent._logger.warning(guard_warning_msg)
            assert guard_warning_msg in caplog.text
            guard_error_msg = logging.getLevelName(logging.ERROR) + str(session_id)  # some random string
            execute_evaluated_agent._agent._logger.warning(guard_error_msg)
            assert guard_error_msg in caplog.text
            caplog.records.clear()

            # Run the main test
            await conversation_test_function(
                config=config
            )

            # Check that no errors and no warning were logged
            # for record in caplog.records:
            #    # assert record.levelname != 'ERROR'
            #    # assert record.levelname != 'WARNING'

    return conversation_manager, agent_director_exec


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_user_says_all_the_time_yes(caplog: LogCaptureFixture,
                                          setup_agent_director: Awaitable[tuple[ConversationMemoryManager, Callable[
                                              [LogCaptureFixture, ScriptedUserEvaluationTestCase],
                                              Coroutine[None, None, None]
                                          ]]]):
    """
    Conversation test, based on a scripted user.
    Asserts that the agent director routes the conversation and does not complete it.
    """

    given_test_case = ScriptedUserEvaluationTestCase(
        name='user_says_yes',
        simulated_user_prompt="Scripted user: Just says yes",
        scripted_user=[
            "yes",
            "yes",
            "yes",
            "yes",
            "yes"
        ],
        evaluations=[]
    )

    conversation_manager, agent_director_exec = await setup_agent_director
    await agent_director_exec(caplog, given_test_case)

    # Check if the welcome agent completed their task
    context = await conversation_manager.get_conversation_context()
    # Assert that the conversation is not finished
    assert not context.history.turns[-1].output.finished


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_user_talks_about_occupations(caplog: LogCaptureFixture,
                                            setup_agent_director: Awaitable[tuple[ConversationMemoryManager, Callable[
                                                [LogCaptureFixture, ScriptedUserEvaluationTestCase],
                                                Coroutine[None, None, None]
                                            ]]]):
    """
    Conversation test, based on a scripted user.
    Asserts that the agent director is able to complete the conversation.
    """

    @dataclasses.dataclass
    class AgentState:
        index: int
        agent_type: AgentType
        finished: bool

    given_test_case = ScriptedUserEvaluationTestCase(
        name='user_typical_conversation',
        simulated_user_prompt="Scripted user: Just says yes",
        scripted_user=[
            "Hi, can you please explain the process?",
            "Ok, Let's start",  # End of WelcomeAgent, Start of SkillsAgent
            "I worked as a backer",  # <--- Job 1
            "pastry and bread making",  # <--- skills
            "no, I dont have more to say about this",
            "Can you explain the process again?",  # WelcomeAgent Explains
            "Let's finish the conversation",  # End of SkillsAgent, Start and end of FarewellAgent
        ],
        evaluations=[]
    )

    conversation_manager, agent_director_exec = await setup_agent_director
    await agent_director_exec(caplog, given_test_case)

    # Check if the welcome agent completed their task
    context = await conversation_manager.get_conversation_context()
    # Assert that the conversation is finished and we are still at the skills explorer
    expected_agent_states: list[AgentState] = [
        AgentState(0, AgentType.WELCOME_AGENT, False),  # WelcomeAgent say hi
        AgentState(1, AgentType.WELCOME_AGENT, False),
        AgentState(2, AgentType.WELCOME_AGENT, True),  # WelcomeAgent completes task
        AgentState(3, AgentType.EXPLORE_EXPERIENCES_AGENT, False),  # Start of Skill Explore
        AgentState(4, AgentType.EXPLORE_EXPERIENCES_AGENT, False),  # Job 1
        AgentState(5, AgentType.EXPLORE_EXPERIENCES_AGENT, False),  # skills
        AgentState(6, AgentType.EXPLORE_EXPERIENCES_AGENT, False),  # No more to say
        AgentState(7, AgentType.WELCOME_AGENT, False),  # WelcomeAgent explains
        AgentState(8, AgentType.EXPLORE_EXPERIENCES_AGENT, True),  # SkillsAgent completes task
        AgentState(9, AgentType.FAREWELL_AGENT, True)  # FarewellAgent completes task
    ]
    for i, expected_state in enumerate(expected_agent_states):
        turn = context.all_history.turns[i]
        actual_state = AgentState(i, turn.output.agent_type, turn.output.finished)
        assert actual_state == expected_state, f"Agent actual state: {actual_state} did have the expected state: {expected_state}"
