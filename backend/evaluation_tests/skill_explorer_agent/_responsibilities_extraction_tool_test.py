import logging

import pytest

from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.skill_explorer_agent._responsibilities_extraction_tool import _ResponsibilitiesExtractionTool
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationTurn
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


class _TestCaseDataExtraction(CompassTestCase):
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
    expected_responsibilities: list[str]

    expected_non_responsibilities: list[str]

    expected_other_peoples_responsibilities: list[str]


test_cases_data_extraction = [
    _TestCaseDataExtraction(
        name="scope_of_work",
        given_summary="",
        given_turns=[
            ("(silence)",
             "Tell me about your typical day as a baker"),
        ],
        given_user_input="""I make the bread and sometimes I clean the place. I do not sell the bread myself""",
        expected_responsibilities=["I make the bread", "I clean the place"],
        expected_other_peoples_responsibilities=[],
        expected_non_responsibilities=['I do not sell the bread I make'],
    ),
    _TestCaseDataExtraction(
        name="not_in_scope_of_work",
        given_summary="",
        given_turns=[
            ("(silence)",
             "Are there any tasks that you specifically don't take care of?  Which ones?"),
        ],
        given_user_input="""I do not clean. I also do not sell""",
        expected_responsibilities=[],
        expected_other_peoples_responsibilities=[],
        expected_non_responsibilities=['I clean', 'I sell'],
    ),
    _TestCaseDataExtraction(
        name="resolve_object_subject_1",
        given_summary="",
        given_turns=[
            ("John and I shape the dough",
             "Can you tell me more about how you shape the dough"),
        ],
        given_user_input="""We do it using our hands. It is a difficult procedure, John uses his senses and I observe the process""",
        expected_responsibilities=['I observe the process',
                                   'I shape the dough with our hands'],
        expected_non_responsibilities=["Shaping the dough is a difficult procedure"],
        expected_other_peoples_responsibilities=['John shapes the dough using his hands', 'John uses his senses'],
    ),

    _TestCaseDataExtraction(
        name="resolve_object_subject_2",
        given_summary="",
        given_turns=[
            ("John and I shape the dough",
             "That's a great start! You've already given me a good picture of your daily routine. "
             "Can you tell me more about how you decide what to bake each day?"),
        ],
        given_user_input="""my boss decides that""",
        expected_responsibilities=[],
        expected_non_responsibilities=[],
        expected_other_peoples_responsibilities=['Our boss decides what John and I bake '
                                                 'each day'],
    ),

    _TestCaseDataExtraction(
        name="resolve_object_subject_3",
        given_summary="",
        given_turns=[
        ],
        given_user_input="""My aunt eats the cake that I baked that was decided by my boss""",
        expected_responsibilities=["I baked the cake"],
        expected_non_responsibilities=[],
        expected_other_peoples_responsibilities=["My aunt eats the cake", "My boss decided on the cake"],
    ),

    _TestCaseDataExtraction(
        name="resolve_object_subject_4",
        given_summary="",
        given_turns=[
        ],
        given_user_input="""My aunt eats the cake that I baked after I did not clean the place""",
        expected_responsibilities=["I baked the cake"],
        expected_non_responsibilities=["I did not clean the place"],
        expected_other_peoples_responsibilities=["My aunt eats the cake"],
    ),

    _TestCaseDataExtraction(
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
        expected_responsibilities=['After the bread is ready, I clean my area',
                                   'I can get my money back',
                                   'I can go home',
                                   'I clean the bakery',
                                   'I have to be there early',
                                   'I heat the ovens',
                                   'I make the bread',
                                   'I use part of the money to buy the ingredients',
                                   'I wake up early to arrive at the bakery on time',
                                   'I wake up very early',
                                   'It is important to track my expenses',
                                   'We meet later that day',
                                   'We split the money'],
        expected_non_responsibilities=[],
        expected_other_peoples_responsibilities=['My brother sells the bread']
    ),
]


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(3)
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases_data_extraction),
                         ids=[case.name for case in get_test_cases_to_run(test_cases_data_extraction)])
async def test_data_extraction(test_case: _TestCaseDataExtraction):
    context: ConversationContext = ConversationContext()

    # GIVEN the previous conversation context
    for turn in test_case.given_turns:
        _add_turn_to_context(turn[0], turn[1], context)
    # AND the context summary
    context.summary = test_case.given_summary

    # AND the user input
    user_input = AgentInput(message=test_case.given_user_input)

    # WHEN the data extraction LLM is executed
    data_extraction_llm = _ResponsibilitiesExtractionTool(logging.getLogger())
    actual_responsibilities_data, _ = await data_extraction_llm.execute(user_input=user_input,
                                                                        context=context)

    # THEN the last referenced experience index should be the expected one
    assert {"responsibilities": sorted(actual_responsibilities_data.responsibilities),
            "non_responsibilities": sorted(actual_responsibilities_data.non_responsibilities),
            "other_peoples_responsibilities": sorted(actual_responsibilities_data.other_peoples_responsibilities)} == \
           {"responsibilities": sorted(test_case.expected_responsibilities),
            "non_responsibilities": sorted(test_case.expected_non_responsibilities),
            "other_peoples_responsibilities": sorted(test_case.expected_other_peoples_responsibilities)}


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
