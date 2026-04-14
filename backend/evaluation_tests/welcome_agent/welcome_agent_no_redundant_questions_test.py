"""
Evaluation test: WelcomeAgent must NOT ask about personal data that has already been collected.

Bug context: When user profile context (programme, school, year) is injected into the prompt,
the WelcomeAgent sometimes asks about it despite instructions not to ask questions.
This test verifies the agent does not ask about already-known personal data fields.
"""

import asyncio
import logging
from datetime import datetime, timezone

import pytest

from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.welcome_agent import WelcomeAgentState
from app.context_vars import user_profile_context_var
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState
from app.countries import Country
from app.i18n.translation_service import get_i18n_manager
from app.i18n.types import Locale
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from app.users.plain_personal_data.service import format_plain_personal_data_for_prompt
from app.users.plain_personal_data.types import PlainPersonalData
from common_libs.test_utilities import get_random_session_id
from common_libs.test_utilities.guard_caplog import guard_caplog
from evaluation_tests.welcome_agent.welcome_agent_executors import WelcomeAgentExecutor

# Phrases that indicate the agent is asking about already-collected personal data
FORBIDDEN_PHRASES = [
    "programme",
    "program of study",
    "school year",
    "year of study",
    "year you are in",
    "what year",
    "which year",
    "current program",
    "tell me about your program",
]


@pytest.fixture(scope="session")
def event_loop():
    """
    Makes sure that all the async calls finish.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
    yield loop
    loop.close()


def _set_user_profile_context():
    """
    Inject user profile context with programme/school/year data,
    simulating a user who has already provided this information during registration.
    """
    given_now = datetime.now(timezone.utc)
    given_plain_personal_data = PlainPersonalData(
        user_id="eval-test-user",
        created_at=given_now,
        updated_at=given_now,
        data={
            "institution_name": "Lusaka Technical College",
            "programme_name": "Food Production",
            "school_year": "Year 2",
        },
    )
    user_profile_context_var.set(
        format_plain_personal_data_for_prompt(given_plain_personal_data)
    )


def _assert_no_redundant_questions(response_text: str):
    """
    Assert that the agent response does not contain any phrases
    that indicate it is asking about already-collected personal data.
    """
    response_lower = response_text.lower()
    for phrase in FORBIDDEN_PHRASES:
        assert phrase not in response_lower, (
            f"WelcomeAgent asked about already-collected data. "
            f"Found forbidden phrase '{phrase}' in response: {response_text}"
        )


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.5-flash-lite/")
@pytest.mark.repeat(5)
async def test_welcome_agent_does_not_ask_about_known_personal_data(evals_setup, caplog):
    """
    Test that the WelcomeAgent does NOT ask about programme/school/year
    when that data is already present in the user profile context.

    The test simulates the real flow:
    1. First call with empty input triggers the hardcoded welcome message
    2. Second call with "Let's start!" triggers the LLM transition response
    3. We assert the LLM response does not ask about already-known personal data
    """
    get_i18n_manager().set_locale(Locale.EN_US)

    # GIVEN a user who has already provided programme/school/year data
    _set_user_profile_context()

    # AND a fresh WelcomeAgent (first encounter, like the real flow)
    session_id = get_random_session_id()
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id=session_id))
    welcome_agent_state = WelcomeAgentState(
        session_id=session_id,
        is_first_encounter=True,
        user_started_discovery=False,
        country_of_user=Country.UNSPECIFIED,
    )
    execute_evaluated_agent = WelcomeAgentExecutor(
        state=welcome_agent_state, conversation_manager=conversation_manager
    )

    with caplog.at_level(logging.INFO):
        guard_caplog(execute_evaluated_agent._agent._logger, caplog)

        # WHEN the first call triggers the hardcoded welcome message
        first_output: AgentOutput = await execute_evaluated_agent(
            agent_input=AgentInput(message="hello")
        )
        # AND the welcome message is not finished (waiting for user to start)
        assert not first_output.finished

        # AND the user says "Let's start!" (this triggers the LLM response)
        actual_output: AgentOutput = await execute_evaluated_agent(
            agent_input=AgentInput(message="Let's start!")
        )

        # THEN expect the agent to finish (user_indicated_start=True)
        assert actual_output.finished, (
            f"Expected WelcomeAgent to finish after 'Let's start!' but it didn't. "
            f"Response: {actual_output.message_for_user}"
        )

        # AND expect the response to NOT ask about programme/school/year
        _assert_no_redundant_questions(actual_output.message_for_user)
