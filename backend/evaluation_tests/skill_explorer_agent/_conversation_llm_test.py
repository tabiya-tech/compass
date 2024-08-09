import logging
from textwrap import dedent

import pytest

from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState, ConversationContext, ConversationTurn
from app.server_config import UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE
from app.agent.experience import WorkType
from app.agent.skill_explorer_agent._conversation_llm import _ConversationLLM, _FINAL_MESSAGE
from evaluation_tests.compass_test_case import CompassTestCase
from evaluation_tests.get_test_cases_to_run_func import get_test_cases_to_run


class _TestCaseConversation(CompassTestCase):
    # The GIVEN
    turns: list[tuple[str, str]]
    """
    The conversation history.
    First element is what the user said, second element is what the agent said.
    """

    summary: str

    experiences_explored: list[str]


test_cases = [
    _TestCaseConversation(
        name="first_experience_to_explore",
        summary=("I told you I sell kotas for money and that I've never worked for anyone else. "
                 "I also told you that I help my brother out with his car, starting about 2 years ago when I got my driver's license. "
                 "You asked me if there's a specific location where I help him out. I told you that I help him out wherever he needs help, "
                 "sometimes at his place, sometimes at the garage. You asked me if I still help him out with his car."),

        turns=[("Yes, I still do.",
                "Thanks, so you've been helping your brother with his car since August 2022, and you still do.  "
                "You help him out at his place or at the garage.  "
                "Is there anything you'd like to add or change about this experience?"),
               ("No, that's all correct.",
                'Cool, can you tell me about any other experiences where you helped out friends or family members without getting paid?'),
               ("No, that's the only one.",
                dedent("""\
                                    Let's recap the information we have collected so far:
                                    • Selling Kotas (Self-Employed), 2023/08 - Present, Joburg
                                    • Community Volunteering (Volunteer/Unpaid)
                                    • Helping Brother with Car (Volunteer/Unpaid), 2022/08 - Present, Brother, Garage
                                    Is there anything you would like to add or change?  If you think any of the experiences are the same, you can ask me to delete one.
                                     """))
            , ("That's all correct.",
               "Thank you for sharing your experiences. Let's move on to the next step.")
               ],
        experiences_explored=[]
    ),
    _TestCaseConversation(
        name="german",
        summary=("Ich habe Ihnen gesagt, dass ich Kotas verkaufe, um Geld zu verdienen, und dass ich noch nie für jemand anderen gearbeitet habe. "
                 "Ich habe Ihnen auch gesagt, dass ich meinem Bruder mit seinem Auto helfe, seit etwa 2 Jahren, als ich meinen Führerschein bekommen habe. "
                 "Sie haben mich gefragt, ob es einen bestimmten Ort gibt, an dem ich ihm helfe. Ich habe Ihnen gesagt, dass ich ihm überall helfe, wo er Unterstützung braucht, "
                 "manchmal bei ihm zu Hause, manchmal in der Werkstatt. Sie haben mich gefragt, ob ich ihm immer noch mit seinem Auto helfe."),
        turns=[("Ja, das tue ich immer noch.",
                "Danke, also hilfst du deinem Bruder seit August 2022 mit seinem Auto, und du tust es immer noch. "
                "Du hilfst ihm entweder bei ihm zu Hause oder in der Werkstatt. "
                "Möchtest du noch etwas hinzufügen oder an dieser Erfahrung ändern?"),
               ("Nein, das ist alles korrekt.",
                'Cool, kannst du mir von anderen Erfahrungen erzählen, bei denen du Freunden oder Familienmitgliedern ohne Bezahlung geholfen hast?'),
               ("Nein, das ist die einzige.",
                dedent("""\
                                    Lassen Sie uns die gesammelten Informationen zusammenfassen:
                                    • Verkauf von Kotas (Selbstständig), 2023/08 - Gegenwart, Joburg
                                    • Gemeinschaftsarbeit (Freiwillig/Unbezahlt)
                                    • Hilfe für den Bruder mit dem Auto (Freiwillig/Unbezahlt), 2022/08 - Gegenwart, Bruder, Werkstatt
                                    Möchten Sie noch etwas hinzufügen oder ändern? Wenn Sie der Meinung sind, dass einige der Erfahrungen identisch sind, können Sie mich bitten, eine zu löschen.
                                     """)),
               ("Das ist alles korrekt.",
                "Vielen Dank, dass du deine Erfahrungen geteilt hast. Lassen Sie uns zum nächsten Schritt übergehen.")],
        experiences_explored=[]
    ),
    _TestCaseConversation(
        name="second_experience",
        summary="_SUMMARY_:\nI told you about my kota business and a typical day at work. I explained that I wake up early, prepare ingredients, drive my canteen to Joburg, set up, sell kotas, and then pack up and go home. You asked me to elaborate on other tasks I do at work. I told you that I also make the kotas, serve customers, take orders, handle money, and clean up. You acknowledged that I'm really involved in every aspect of my business and asked me what the most important things are that I need to do at work. I told you that making sure I have enough ingredients, finding a good spot to sell, and keeping my customers happy are the most important things. You asked me how I decide what task to do first each day. \n\nI usually start by preparing the ingredients, then I drive to my spot. I try to get there early so I can set up before the rush starts.",
        turns=[(
            "I usually start with preparing the kotas, then I clean my canteen, and then I drive around to sell them. I try to make sure I have enough ingredients before I start selling",
            "That's a good system.  Are there any tasks that you specifically don't take care of? Which ones?"
        ), ("I don't handle marketing or advertising. I rely on word of mouth and my location to get customers.",
            'Thank you for sharing these details! I have all the information I need.'),
            ('ok what now?',
             'After examining the information you provided, I identified the following skills for your experience "Selling Kotas":\n• administer ingredients in food production\n• unload supplies\n• customer service\n• maintain work area cleanliness\n• take payments for bills\n\n')

        ],
        experiences_explored=["Selling Kotas (Self-Employed), 2023/08 - Present, Joburg"]
    )]


@pytest.mark.asyncio
@pytest.mark.evaluation_test
@pytest.mark.parametrize('test_case', get_test_cases_to_run(test_cases),
                         ids=[case.name for case in get_test_cases_to_run(test_cases)])
async def test_skills_explorer_agent_simulated_user(test_case):
    # The conversation manager for this test
    conversation_manager = ConversationMemoryManager(UNSUMMARIZED_WINDOW_SIZE, TO_BE_SUMMARIZED_WINDOW_SIZE)
    conversation_manager.set_state(state=ConversationMemoryManagerState(1))
    context = await conversation_manager.get_conversation_context()
    # GIVEN the previous conversation context
    for turn in test_case.turns:
        _add_turn_to_context(turn[0], turn[1], context)
    # AND the context summary
    context.summary = test_case.summary
    # WHEN the conversation LLM is executed
    llm = _ConversationLLM()
    out = await llm.execute(
        experiences_explored=test_case.experiences_explored,
        first_time_for_experience=True,
        user_input=AgentInput(message="", is_artificial=True),
        context=context,
        experience_title="Baker",
        work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        logger=logging.getLogger()
    )
    logging.getLogger().info(out)

    assert out.message_for_user != _FINAL_MESSAGE
    assert out.message_for_user.find("baker. \n\n") != -1


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
