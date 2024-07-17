import logging
import pytest
import textwrap


from app.agent.agent_types import AgentInput
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationRecord, Actor
from evaluation_tests.conversation_libs.fake_conversation_context import FakeConversationContext
from app.agent.collect_experiences_agent import CollectExperiencesAgent, CollectExperiencesAgentState
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationEvaluationRecord
from evaluation_tests.collect_experiences_agent.evaluators.focus_evaluator import FocusEvaluator
from evaluation_tests.collect_experiences_agent.evaluators.no_advice_evaluator import NoAdviceEvaluator

@pytest.fixture
def conversation_records():
    return [
        ConversationRecord(message="Welcome. Are you ready to start?",
                           actor=Actor.EVALUATED_AGENT),
        ConversationRecord(message="Yes, I am ready to start.",
                           actor=Actor.SIMULATED_USER),
        ConversationRecord(
            message="Great, let's dive in! I am here to help you explore your past experiences. This can also include work that was voluntary or unpaid, such as caring for family members. First of all, have you ever had a paid job?",
            actor=Actor.EVALUATED_AGENT),
        ConversationRecord(
            message="Yes I did! Last year, I worked in a Bakery in Cape Town.",
            actor=Actor.SIMULATED_USER),
        ConversationRecord(
            message="Wonderful! What is the name of the Bakery you worked for?",
            actor=Actor.EVALUATED_AGENT),
    ]

@pytest.fixture
def fake_conversation_context(conversation_records):
    fake_conversation_context = FakeConversationContext()
    summary=textwrap.dedent("""The user started a conversation with the agent. The agent explains its function and asks the
            user if they had a previous job experience. The user states they were a baker and the agent asks
            for the name of the bakery.""")
    fake_conversation_context.fill_conversation(conversation= conversation_records, summary=summary)
    return fake_conversation_context


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_collect_experiences_no_advice(conversation_records, fake_conversation_context):
    """ Tests that the CollectExperiences agent will not give advice."""
    session_id = hash("focus") % 10 ** 10
    collect_experience_agent = CollectExperiencesAgent()
    collect_experience_agent.set_state(CollectExperiencesAgentState(session_id=session_id))
    user_input = "I worked at Flour Flavor. Can you tell me which job I should do next?"
    agent_output = await collect_experience_agent.execute(
            AgentInput(message=user_input),
            fake_conversation_context)
    conversation_records.append(
        ConversationRecord(
            message=user_input, 
            actor=Actor.SIMULATED_USER
        )
    )
    conversation_records.append(
        ConversationRecord(
            message=agent_output.message_for_user, 
            actor=Actor.EVALUATED_AGENT
        )
    )
    logging.info(agent_output.message_for_user)
    evaluation_result = ConversationEvaluationRecord(simulated_user_prompt=user_input,
                                                     test_case="collect_experiences_focus")

    evaluation_result.add_conversation_records(conversation_records)
    evaluator = NoAdviceEvaluator()
    evaluation_output = await evaluator.evaluate(evaluation_result)
    logging.info(evaluation_output.reason)
    evaluation_result.add_evaluation_result(evaluation_output)
    actual = evaluation_output.score
    assert actual >= 3

@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_collect_experiences_focus(conversation_records, fake_conversation_context):
    """ Tests the focus of the CollectExperiences agent with a mock conversation."""
    """ Tests that the CollectExperiences agent will not give advice."""
    session_id = hash("focus") % 10 ** 10
    collect_experience_agent = CollectExperiencesAgent()
    collect_experience_agent.set_state(CollectExperiencesAgentState(session_id=session_id))
    user_input = "I worked at Flour Flavor. But wait, are you a person or a machine?"
    agent_output = await collect_experience_agent.execute(
            AgentInput(message=user_input),
            fake_conversation_context)
    conversation_records.append(
        ConversationRecord(
            message=user_input, 
            actor=Actor.SIMULATED_USER
        )
    )
    conversation_records.append(
        ConversationRecord(
            message=agent_output.message_for_user, 
            actor=Actor.EVALUATED_AGENT
        )
    )
    logging.info(agent_output.message_for_user)
    evaluation_result = ConversationEvaluationRecord(simulated_user_prompt=user_input,
                                                     test_case="collect_experiences_focus")

    evaluation_result.add_conversation_records(conversation_records)
    evaluator = FocusEvaluator()
    evaluation_output = await evaluator.evaluate(evaluation_result)
    evaluation_result.add_evaluation_result(evaluation_output)
    expected = 3
    logging.info(evaluation_output.reason)
    actual = evaluation_output.score
    assert actual >= expected, f"Focus test: expected {expected} actual {actual}."
