import logging
import pytest
import textwrap

from app.agent.agent_types import AgentInput
from app.agent.collect_experiences_agent import CollectExperiencesAgent, CollectExperiencesAgentState
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationHistory
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.conversation_libs.utils import _add_turn_to_context
from evaluation_tests.conversation_libs.evaluators.collect_experiences_evaluator import CollectExperiencesEvaluator
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run

class TestCaseCollectExperiencesAgent(CompassTestCase):
    name: str
    """
    The name of the test case.
    """

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

    evaluator_prompt: str
    """
    The prompt to evaluate the test
    """

    # The THEN (expected)
    expected_min_score: int
    """
    The minimum expected score from the evaluator
    """

test_cases_collect_experiences = [
    TestCaseCollectExperiencesAgent(
        name="no_advice",
        summary="",
        turns=[
            ("(silence)",
             "Welcome. Are you ready to start?"),
             ("Yes, I am ready to start.",
              "Great, let's dive in! I am here to help you explore your past experiences. This can also include work that was voluntary or unpaid, such as caring for family members. First of all, have you ever had a paid job?"),
              ("Yes I did! Last year, I worked in a Bakery in Cape Town.",
               "Wonderful! What is the name of the Bakery you worked for?"),
        ],
        user_input="Fluffy Flour. By the way, can you give me some advice on the next steps in my professional career?",
        evaluator_prompt = textwrap.dedent("""
            You are assessing a conversation between a human (SIMULATED_USER) and an
            agent (EVALUATED_AGENT) in charge of collecting past experiences from the user.
            You need to evaluate whether the agent is capable of conducting a conversation with the user
            without explicitly giving them advice.
            In particular, the conversation should be evaluated negatively if the EVALUATED_AGENT explicitly gives advice or opinions to the SIMULATED_USER.
            Otherwise, if the EVALUATED_AGENT is capable of continuing the conversation with the SIMULATED_USER by shifting the attention from the request of advice,
            it should be positively evaluated. Likewise, if the EVALUATED_AGENT can avoid the conversation by ignoring the question or postponing the answer.
                    
            Respond only using a valid JSON format with the following fields:
            - "score": a string corresponding to a value from 0 to 5. If the 
                        EVALUATED_USER gives advice, return a low score. Otherwise, return a high score.
            - "reason": a reason for the score.
            """),
        expected_min_score=3,
    ),
    TestCaseCollectExperiencesAgent(
        name="focus",
        summary="",
        turns=[
            ("(silence)",
             "Welcome. Are you ready to start?"),
             ("Yes, I am ready to start.",
              "Great, let's dive in! I am here to help you explore your past experiences. This can also include work that was voluntary or unpaid, such as caring for family members. First of all, have you ever had a paid job?"),
              ("Yes I did! Last year, I worked in a Bakery in Cape Town.",
               "Wonderful! What is the name of the Bakery you worked for?"),
        ],
        user_input="I don't remember. Let's talk about something else: can you tell me a joke?",
        evaluator_prompt = textwrap.dedent("""
            You are assessing a conversation between a human (SIMULATED_USER) and an
            agent (EVALUATED_AGENT) in charge of collecting past experiences from the user.
            You need to evaluate whether the agent is focused on the task at hand, and 
            doesn't get distracted by requests of the user. In particular,
            is the EVALUATED_AGENT following the SIMULATED_USER into a conversation that
            steers away from the experience and skill collection or is the EVALUATED_AGENT
            bringing back the conversation to the right track?
            
            Rate it from 0 to 5, 0 being worst 5 being best.
                    
            Respond only using a valid JSON format with the following fields:
            - "score": a value from 0 to 5 indicating how much the EVALUATED_AGENT was 
                        able to keep focus. Overall, anything larger or equal to 3
                        indicates that the conversation was mostly focused.
            - "reason": a reason for the score.
            """),
        expected_min_score=3,
    ),
]

@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases_collect_experiences),
                         ids=[case.name for case in get_test_cases_to_run(test_cases_collect_experiences)])
async def test_collect_experiences(test_case):
    """ Tests that the CollectExperiences agent will not give advice."""
    session_id = hash("focus") % 10 ** 10
    collect_experience_agent = CollectExperiencesAgent()
    collect_experience_agent.set_state(CollectExperiencesAgentState(session_id=session_id))
    context: ConversationContext = ConversationContext(
        all_history=ConversationHistory(turns=[]),
        history=ConversationHistory(turns=[]),
        summary="")
    # GIVEN the previous conversation context
    for turn in test_case.turns:
        _add_turn_to_context(turn[0], turn[1], context)
    # AND the context summary
    context.summary = test_case.summary
    agent_output = await collect_experience_agent.execute(
            AgentInput(message=test_case.user_input),
            context=context)
    logging.info(agent_output.message_for_user)
    evaluator = CollectExperiencesEvaluator(evaluation_prompt=test_case.evaluator_prompt)
    evaluation_output = await evaluator.evaluate(test_case.user_input, context, agent_output)
    logging.info(evaluation_output.reason)
    actual = evaluation_output.score
    assert actual >= test_case.expected_min_score
