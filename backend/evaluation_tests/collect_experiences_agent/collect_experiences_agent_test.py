import asyncio
import os

import pytest

from app.agent.experience.work_type import WorkType
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from evaluation_tests.conversation_libs.conversation_test_function import conversation_test_function, \
    ConversationTestConfig, LLMSimulatedUser
from evaluation_tests.collect_experiences_agent.collect_experiences_test_cases import test_cases
from evaluation_tests.collect_experiences_agent.collect_experiences_executor import CollectExperienceAgentGetConversationContextExecutor, \
    CollectExperienceAgentisFinished, CollectExperiencesAgentExecutor
from evaluation_tests.collect_experiences_agent.conversation_generator import generate

TEST_DICTIONARY = {
    test_case.name: test_case for test_case in test_cases
}

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


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_collect_experiences_withholding_student():
    """
    Tests the collect experiences agent with a simulated user.
    """
    test_case = TEST_DICTIONARY["withholding_student_e2e"]

    session_id = hash(test_case.name) % 10 ** 10
    output_folder = os.path.join(os.getcwd(), 'test_output/collect_experience/simulated_user/', test_case.name)

    # The conversation manager for this test
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id))
    execute_evaluated_agent = CollectExperiencesAgentExecutor(conversation_manager=conversation_manager, session_id=session_id)

    # Run the conversation test
    config = ConversationTestConfig(
        max_iterations=20,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=execute_evaluated_agent,
        execute_simulated_user=LLMSimulatedUser(system_instructions=test_case.simulated_user_prompt),
        is_finished=CollectExperienceAgentisFinished(),
        get_conversation_context=CollectExperienceAgentGetConversationContextExecutor(conversation_manager=conversation_manager)
    )

    # Using GeminiChatLLM for the simulated user as we want to conduct a conversation with an in-memory state (history)
    # and not manage the history ourselves.
    await generate(max_iterations=config.max_iterations,
        execute_simulated_user=config.execute_simulated_user,
        execute_evaluated_agent=config.execute_evaluated_agent,
        is_finished=config.is_finished)
    context = await conversation_manager.get_conversation_context()
    final_output = context.history.turns[-1].output
    assert final_output.finished
    experiences = execute_evaluated_agent.get_experiences()
    assert len(experiences) == 3
    titles = [experience.experience_title for experience in experiences]
    dates = [experience.timeline for experience in experiences]
    work_types = [experience.work_type for experience in experiences]
    assert any(["teach" in elem.lower() for elem in titles])
    assert any(["2020" in date.start for date in dates])
    assert any(["2017/01" in date.start for date in dates])
    assert any([work_type == WorkType.SELF_EMPLOYMENT for work_type in work_types])

@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_collect_experiences_unexperienced_student():
    """
    Tests the collect experiences agent with a simulated user.
    """
    test_case = TEST_DICTIONARY["unexperienced_student_e2e"]

    session_id = hash(test_case.name) % 10 ** 10
    output_folder = os.path.join(os.getcwd(), 'test_output/collect_experience/simulated_user/', test_case.name)

    # The conversation manager for this test
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id))
    execute_evaluated_agent = CollectExperiencesAgentExecutor(conversation_manager=conversation_manager, session_id=session_id)

    # Run the conversation test
    config = ConversationTestConfig(
        max_iterations=10,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=execute_evaluated_agent,
        execute_simulated_user=LLMSimulatedUser(system_instructions=test_case.simulated_user_prompt),
        is_finished=CollectExperienceAgentisFinished(),
        get_conversation_context=CollectExperienceAgentGetConversationContextExecutor(conversation_manager=conversation_manager)
    )
    await generate(max_iterations=config.max_iterations,
        execute_simulated_user=config.execute_simulated_user,
        execute_evaluated_agent=config.execute_evaluated_agent,
        is_finished=config.is_finished)
    
    context = await conversation_manager.get_conversation_context()
    final_output = context.history.turns[-1].output
    assert final_output.finished
    experiences = execute_evaluated_agent.get_experiences()
    assert len(experiences) > 0

@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_collect_experiences_french_worker_typos():
    """
    Tests the collect experiences agent with a simulated user.
    """
    test_case = TEST_DICTIONARY["french_worker_typos_e2e"]

    session_id = hash(test_case.name) % 10 ** 10
    output_folder = os.path.join(os.getcwd(), 'test_output/collect_experience/simulated_user/', test_case.name)

    # The conversation manager for this test
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id))
    execute_evaluated_agent = CollectExperiencesAgentExecutor(conversation_manager=conversation_manager, session_id=session_id)

    # Run the conversation test
    config = ConversationTestConfig(
        max_iterations=10,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=execute_evaluated_agent,
        execute_simulated_user=LLMSimulatedUser(system_instructions=test_case.simulated_user_prompt),
        is_finished=CollectExperienceAgentisFinished(),
        get_conversation_context=CollectExperienceAgentGetConversationContextExecutor(conversation_manager=conversation_manager)
    )
    await generate(max_iterations=config.max_iterations,
        execute_simulated_user=config.execute_simulated_user,
        execute_evaluated_agent=config.execute_evaluated_agent,
        is_finished=config.is_finished)
    
    context = await conversation_manager.get_conversation_context()
    final_output = context.history.turns[-1].output
    assert final_output.finished
    experiences = execute_evaluated_agent.get_experiences()
    assert len(experiences) == 2
    titles = [experience.experience_title for experience in experiences]
    locations = [experience.location for experience in experiences]
    companies = [experience.company for experience in experiences]
    dates = [experience.timeline for experience in experiences]
    work_types = [experience.work_type for experience in experiences]
    assert any(["delivery" in elem.lower() for elem in titles])
    assert any(["paris" in location.lower() for location in locations])
    assert any(["uber" in company.lower() for company in companies])
    assert any(["2021/01" in date.start for date in dates])
    assert any(["2023/03" in date.end for date in dates])
    assert any(["2019" in date.start for date in dates])
    assert any([work_type == WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT for work_type in work_types])

@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_collect_experiences_french_worker_infodump():
    """
    Tests the collect experiences agent with a simulated user.
    """
    test_case = TEST_DICTIONARY["french_worker_infodump_e2e"]

    session_id = hash(test_case.name) % 10 ** 10
    output_folder = os.path.join(os.getcwd(), 'test_output/collect_experience/simulated_user/', test_case.name)

    # The conversation manager for this test
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id))
    execute_evaluated_agent = CollectExperiencesAgentExecutor(conversation_manager=conversation_manager, session_id=session_id)

    # Run the conversation test
    config = ConversationTestConfig(
        max_iterations=10,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=execute_evaluated_agent,
        execute_simulated_user=LLMSimulatedUser(system_instructions=test_case.simulated_user_prompt),
        is_finished=CollectExperienceAgentisFinished(),
        get_conversation_context=CollectExperienceAgentGetConversationContextExecutor(conversation_manager=conversation_manager)
    )
    await generate(max_iterations=config.max_iterations,
        execute_simulated_user=config.execute_simulated_user,
        execute_evaluated_agent=config.execute_evaluated_agent,
        is_finished=config.is_finished)
    
    context = await conversation_manager.get_conversation_context()
    assert context.history.turns[-1].output.finished
    experiences = execute_evaluated_agent.get_experiences()
    assert len(experiences) == 2
    titles = [experience.experience_title for experience in experiences]
    locations = [experience.location for experience in experiences]
    companies = [experience.company for experience in experiences]
    dates = [experience.timeline for experience in experiences]
    work_types = [experience.work_type for experience in experiences]
    assert any(["delivery" in elem.lower() for elem in titles])
    assert any(["paris" in location.lower() for location in locations])
    assert any(["uber" in company.lower() for company in companies])
    assert any(["2021/01" in date.start for date in dates])
    assert any(["2023/03" in date.end for date in dates])
    assert any(["2019" in date.start for date in dates])
    assert any([work_type == WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT for work_type in work_types])

@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_collect_experiences_single_experience():
    """
    Tests the collect experiences agent with a simulated user.
    """
    test_case = TEST_DICTIONARY["single_experience_e2e"]

    session_id = hash(test_case.name) % 10 ** 10
    output_folder = os.path.join(os.getcwd(), 'test_output/collect_experience/simulated_user/', test_case.name)

    # The conversation manager for this test
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id))
    execute_evaluated_agent = CollectExperiencesAgentExecutor(conversation_manager=conversation_manager, session_id=session_id)

    # Run the conversation test
    config = ConversationTestConfig(
        max_iterations=10,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=execute_evaluated_agent,
        execute_simulated_user=LLMSimulatedUser(system_instructions=test_case.simulated_user_prompt),
        is_finished=CollectExperienceAgentisFinished(),
        get_conversation_context=CollectExperienceAgentGetConversationContextExecutor(conversation_manager=conversation_manager)
    )
    await generate(max_iterations=config.max_iterations,
        execute_simulated_user=config.execute_simulated_user,
        execute_evaluated_agent=config.execute_evaluated_agent,
        is_finished=config.is_finished)
    
    context = await conversation_manager.get_conversation_context()
    final_output = context.history.turns[-1].output
    assert final_output.finished
    experiences = execute_evaluated_agent.get_experiences()
    assert len(experiences) == 1
    assert "danc" in experiences[0].experience_title.lower()
    assert "nairobi" in experiences[0].location.lower()
    assert "2018" in experiences[0].timeline.start

@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_collect_experiences_single_experience_mistake():
    """
    Tests the collect experiences agent with a simulated user.
    """
    test_case = TEST_DICTIONARY["single_experience_mistake_e2e"]

    session_id = hash(test_case.name) % 10 ** 10
    output_folder = os.path.join(os.getcwd(), 'test_output/collect_experience/simulated_user/', test_case.name)

    # The conversation manager for this test
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id))
    execute_evaluated_agent = CollectExperiencesAgentExecutor(conversation_manager=conversation_manager, session_id=session_id)

    # Run the conversation test
    config = ConversationTestConfig(
        max_iterations=10,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=execute_evaluated_agent,
        execute_simulated_user=LLMSimulatedUser(system_instructions=test_case.simulated_user_prompt),
        is_finished=CollectExperienceAgentisFinished(),
        get_conversation_context=CollectExperienceAgentGetConversationContextExecutor(conversation_manager=conversation_manager)
    )
    await generate(max_iterations=config.max_iterations,
        execute_simulated_user=config.execute_simulated_user,
        execute_evaluated_agent=config.execute_evaluated_agent,
        is_finished=config.is_finished)
    
    context = await conversation_manager.get_conversation_context()
    final_output = context.history.turns[-1].output
    assert final_output.finished
    experiences = execute_evaluated_agent.get_experiences()
    assert len(experiences) == 1
    assert "danc" in experiences[0].experience_title.lower()
    assert "nairobi" in experiences[0].location.lower()
    assert "2018" in experiences[0].timeline.start