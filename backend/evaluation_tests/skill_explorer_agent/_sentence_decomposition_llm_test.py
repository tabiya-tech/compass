import logging

import pytest

from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.skill_explorer_agent._sentence_decomposition_llm import _SentenceDecompositionLLM
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationTurn
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


class _TestCaseSentenceDecomposition(CompassTestCase):
    # The GIVEN
    given_turns: list[tuple[str, str]]
    """
    The conversation history.
    First element is what the user said, second element is what the agent said.
    """

    given_summary: str
    """
    The context summary. Can be empty.
    """

    given_user_input: str
    """
    The last user input.
    """

    # The THEN (expected)
    expected_resolved_pronouns: list[str]


test_cases_sentence_decomposition = [
    _TestCaseSentenceDecomposition(
        name="scope_of_work",
        given_summary="",
        given_turns=[
            ("(silence)",
             "Tell me about your typical day as a baker"),
        ],
        given_user_input="""I make the bread and sometimes I clean the place. I do not sell the bread myself""",
        expected_resolved_pronouns=["I make the bread.", "Sometimes I clean the place.", "I do not sell the bread."],
    ),
    _TestCaseSentenceDecomposition(
        name="not_in_scope_of_work",
        given_summary="",
        given_turns=[
            ("(silence)",
             "Are there any tasks that you specifically don't take care of?  Which ones?"),
        ],
        given_user_input="""I do not clean. I also do not sell""",
        expected_resolved_pronouns=['I do not clean.', 'I also do not sell.'],
    ),
    _TestCaseSentenceDecomposition(
        name="resolve_object_subject_1",
        given_summary="",
        given_turns=[
            ("John and I shape the dough",
             "Can you tell me more about how you shape the dough"),
        ],
        given_user_input="""We do it using our hands. It is a difficult procedure, John uses his senses and I observe the process""",
        expected_resolved_pronouns=['I observe the process.',
                                    'John and I shape the dough using our hands.',
                                    "John uses his senses.",
                                    'Shaping the dough is a difficult procedure.'],
    ),

    _TestCaseSentenceDecomposition(
        name="resolve_object_subject_2",
        given_summary="",
        given_turns=[
            ("John and I shape the dough",
             "That's a great start! You've already given me a good picture of your daily routine. "
             "Can you tell me more about how you decide what to bake each day?"),
        ],
        given_user_input="""my boss decides that""",
        expected_resolved_pronouns=["My boss decides what to bake each day."],
    ),

    _TestCaseSentenceDecomposition(
        name="resolve_object_subject_3",
        given_summary="",
        given_turns=[
        ],
        given_user_input="""My aunt eats the cake that I baked that was decided by my boss""",
        expected_resolved_pronouns=["My aunt eats the cake.", "I baked the cake.", "My boss decided the cake."],
    ),

    _TestCaseSentenceDecomposition(
        name="resolve_object_subject_4",
        given_summary="",
        given_turns=[
        ],
        given_user_input="""My aunt eats the cake that I baked after I did not clean the place""",
        expected_resolved_pronouns=["My aunt eats the cake.", "I baked the cake.", "I did not clean the place."],
    ),

    _TestCaseSentenceDecomposition(
        name="long_description_with_scopes_of_work",
        given_summary="",
        given_turns=[
            ("(silence)",
             "Tell me about your typical day as a baker"),
        ],
        given_user_input=""" I wake up very early in the morning to be at the bakery on time. 
    I have be there early because the bread must be ready when the customers come.
    I heat up the ovens, clean the place and then make the bread.
    After the bread is ready, I clean up my area and I can go home.
    My brother sells the bread and we meet later the same day and split the money.
    I use part of the money to buy the stuff we need to make the bread. 
    It is important to keep track of what I have spent, so that I can get my money back.""",
        expected_resolved_pronouns=['After the bread is ready, I clean up my area.',
                                    'I and my brother meet later the same day.',
                                    'I and my brother split the money.',
                                    'I can get my money back.',
                                    'I can go home.',
                                    'I clean the place.',
                                    'I have to be there early because the bread must be '
                                    'ready when the customers come.',
                                    'I heat up the ovens.',
                                    'I make the bread.',
                                    'I use part of the money to buy the stuff I and my '
                                    'brother need to make the bread.',
                                    'I wake up early to be at the bakery on time.',
                                    'I wake up very early in the morning.',
                                    'It is important to keep track of what I have spent.',
                                    'My brother sells the bread.'],
    ),
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases_sentence_decomposition),
                         ids=[case.name for case in get_test_cases_to_run(test_cases_sentence_decomposition)])
async def test_sentence_decomposition(test_case: _TestCaseSentenceDecomposition):
    context: ConversationContext = ConversationContext()

    # GIVEN the previous conversation context
    for turn in test_case.given_turns:
        _add_turn_to_context(turn[0], turn[1], context)
    # AND the context summary
    context.summary = test_case.given_summary

    # WHEN the data extraction LLM is executed with the given
    _llm = _SentenceDecompositionLLM(logging.getLogger())
    actual_response, _ = await _llm.execute(last_user_input=test_case.given_user_input,
                                            context=context)
    # THEN the last referenced experience index should be the expected one
    assert sorted(actual_response.decomposed_and_dereferenced) == sorted(test_case.expected_resolved_pronouns)


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
