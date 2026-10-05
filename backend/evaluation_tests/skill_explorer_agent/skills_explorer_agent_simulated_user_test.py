import logging
import os

import pytest
from _pytest.logging import LogCaptureFixture
from pydantic import BaseModel, Field

from app.agent.config import AgentsConfig
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, JSON_GENERATION_CONFIG, ZERO_TEMPERATURE_GENERATION_CONFIG
from common_libs.llm.schema_builder import with_response_schema
from common_libs.test_utilities import get_random_session_id
from common_libs.test_utilities.guard_caplog import guard_caplog, assert_log_error_warnings
from .skills_explorer_agent_executor import SkillsExplorerAgentExecutor, SkillsExplorerAgentGetConversationContextExecutor, \
    SkillsExplorerAgentIsFinished
from .skills_explorer_test_cases import SkillsExplorerAgentTestCase, test_cases
from evaluation_tests.conversation_libs.conversation_test_function import LLMSimulatedUser, \
    ConversationTestConfig, conversation_test_function, assert_expected_evaluation_results
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-3.5-flash-lite/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_skills_explorer_agent_simulated_user(max_iterations: int, test_case: SkillsExplorerAgentTestCase,
                                                    caplog: LogCaptureFixture):
    """
    Tests the skills explorer agent with a simulated user.
    """
    print(f"Running test case {test_case.name}")

    session_id = get_random_session_id()
    output_folder = os.path.join(os.getcwd(), 'test_output/skills_explorer_agent/simulated_user/', test_case.name)

    # The conversation manager for this test
    given_experience = test_case.given_experience.model_copy(deep=True)  # model_copy is needed to avoid modifying the original experience between repeats
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(session_id=session_id))
    execute_evaluated_agent = SkillsExplorerAgentExecutor(conversation_manager=conversation_manager,
                                                          state=SkillsExplorerAgentState(
                                                              session_id=session_id,
                                                              country_of_user=test_case.country_of_user,
                                                          ),
                                                          experience=given_experience)

    # Run the conversation test
    config = ConversationTestConfig(
        max_iterations=max_iterations,
        test_case=test_case,
        output_folder=output_folder,
        execute_evaluated_agent=execute_evaluated_agent,
        execute_simulated_user=LLMSimulatedUser(system_instructions=test_case.simulated_user_prompt),
        is_finished=SkillsExplorerAgentIsFinished(),
        get_conversation_context=SkillsExplorerAgentGetConversationContextExecutor(
            conversation_manager=conversation_manager),
        deferred_evaluation_assertions=True  # run the evaluation assertions at the end
    )

    # Set the capl-og at the level in question - 1 to ensure that the root logger is set to the correct level.
    # However, this is not enough as a logger can be set up in the agent in such a way that it does not propagate
    # the log messages to the root logger. For this reason, we add additional guards.
    with caplog.at_level(logging.DEBUG):
        # Guards to ensure that the loggers are correctly set up
        guard_caplog(logger=execute_evaluated_agent._agent._logger, caplog=caplog)

        # Run the main test
        evaluation_result: ConversationEvaluationRecord = await conversation_test_function(
            config=config
        )

        # Check if the agent completed their task
        context = await conversation_manager.get_conversation_context()
        assert context.history.turns[-1].output.finished

        # Check if the expected responsibilities are covered by the discovered ones.
        # The simulated user words its answers differently on every run, so the match is by meaning, not by text.
        actual_responsibilities = given_experience.responsibilities.responsibilities
        missing_responsibilities = await _get_missing_responsibilities(expected=test_case.expected_responsibilities,
                                                                       actual=actual_responsibilities)
        assert not missing_responsibilities, (f"missing responsibilities: {missing_responsibilities}, "
                                              f"discovered responsibilities: {actual_responsibilities}")

        # Finally, check that no errors and no warning were logged
        assert_log_error_warnings(caplog=caplog, expect_errors_in_logs=False, expect_warnings_in_logs=False)

    # We run the evaluation assertions at the end
    # as it fails often due to the unpredictability of the LLM responses
    assert_expected_evaluation_results(evaluation_result=evaluation_result, test_case=test_case)


class _MissingResponsibilities(BaseModel):
    reasoning: str = Field(description="A short step-by-step explanation of which expected responsibility is covered by which discovered one.")
    missing: list[str] = Field(description="The expected responsibilities, copied verbatim, that no discovered responsibility covers. Empty if all are covered.")


async def _get_missing_responsibilities(*, expected: list[str], actual: list[str]) -> list[str]:
    """
    Get the expected responsibilities that are not covered by the actual ones.
    A responsibility is covered when a discovered responsibility describes the same task, whatever its wording, tense or language.
    """
    if not expected:
        return []
    llm = GeminiGenerativeLLM(config=LLMConfig(
        language_model_name=AgentsConfig.ultra_high_reasoning_model,
        generation_config=ZERO_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG | with_response_schema(_MissingResponsibilities)))
    response = await llm.generate_content(
        "Compare the expected responsibilities of a person with the responsibilities discovered in a conversation with them.\n"
        "An expected responsibility is covered when a discovered responsibility describes the same task, "
        "whatever its wording, tense, level of detail or language.\n"
        f"Expected responsibilities: {expected}\n"
        f"Discovered responsibilities: {actual}")
    return _MissingResponsibilities.model_validate_json(response.text).missing
