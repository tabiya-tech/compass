import asyncio
import os
from datetime import timezone, datetime

import pytest

from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.qna_agent import QnaAgent
from app.conversation_memory.conversation_memory_types import ConversationContext, ConversationTurn, ConversationHistory
from common_libs.llm.gemini import GeminiGenerativeLLM, LLMConfig, SAFETY_OFF_SETTINGS, \
    MEDIUM_TEMPERATURE_GENERATION_CONFIG
from evaluation_tests.conversation_libs.conversation_generator import generate
from evaluation_tests.conversation_libs.conversation_test_function import LLMSimulatedUser
from evaluation_tests.conversation_libs.evaluators.criteria_evaluator import CriteriaEvaluator
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationRecord, Actor, EvaluationType, \
    ConversationEvaluationRecord


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


async def _evaluate_with_llm(prompt: str) -> str:
    llm = GeminiGenerativeLLM(config=LLMConfig(model_name="gemini-1.5-pro-preview-0409"))
    return await llm.generate_content_async(prompt)


# TODO: Make a fake conversation history that can be used in multiple tests
def _create_conversation_history(conversation: list[ConversationRecord], summary: str) -> ConversationContext:
    history = ConversationHistory()
    i = 0
    while i < len(conversation) - 1:
        agent = conversation[i]
        simulated_user = conversation[i + 1]
        history.turns.append(ConversationTurn(index=i / 2, input=AgentInput(message=simulated_user.message),
                                              output=AgentOutput(message_for_user=agent.message,
                                                                 type=AgentType.WELCOME_AGENT, finished=False)))
        i += 2
    return ConversationContext(all_history=history, history=history, summary=summary)


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_qna_agent_answering_simple_question():
    """ Tests the QnA agent with a simple question. """

    qna_agent = QnaAgent()

    output = await qna_agent.execute(AgentInput(message="What will you with my data?"),
                                     ConversationContext(all_history=[], history=[], summary=""))

    assert "TRUE" in await _evaluate_with_llm(
        f"""Respond only with TRUE if "{output.message_for_user}" explains how the data will be used. Otherwise respond
        with FALSE.""")


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_qna_agent_responds_with_cannot_help_for_irrelevant_questions():
    qna_agent = QnaAgent()

    output = await qna_agent.execute(AgentInput(message="Lorem ipsum dolor sit amet."),
                                     ConversationContext(all_history=[], history=[], summary=""))

    assert "TRUE" in await _evaluate_with_llm(
        f"""Respond only with TRUE if "{output.message_for_user}" says "I cannot help you with this". Otherwise respond
        with FALSE."""), f"output: {output}"


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_qna_agent_returns_finished_true():
    qna_agent = QnaAgent()

    output = await qna_agent.execute(AgentInput(message="What will do you with my data?"),
                                     ConversationContext(all_history=[], history=[], summary=""))

    assert output.finished, f"output: {output}"


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_qna_agent_ignores_previous_conversation():
    qna_agent = QnaAgent()

    conversation_history = _create_conversation_history(conversation=[
        ConversationRecord(message="Hello. Welcome. Are you ready to start?",
                           actor=Actor.EVALUATED_AGENT),
        ConversationRecord(message="Yes, I am ready to start.",
                           actor=Actor.SIMULATED_USER),
        ConversationRecord(
            message="Great, let's dive in! Tell me about a time when you had to overcome a challenge. What did you do "
                    "and what skills did you use to succeed?",
            actor=Actor.EVALUATED_AGENT),
        ConversationRecord(
            message="Okay, so last year, I was working on this big writing project for Huum Hub. It was a guide for "
                    "young entrepreneurs, and I was determined to make it the best it could be. But then, "
                    "writer's block hit me hard. I couldn't come up with any new ideas, and I started to doubt myself.",
            actor=Actor.SIMULATED_USER),
        ConversationRecord(
            message="That's amazing! It sounds like you used a lot of different skills to overcome that challenge, "
                    "like problem-solving, research, writing, and perseverance. Can you tell me more about how you "
                    "used your research skills to come up with new ideas?",
            actor=Actor.EVALUATED_AGENT),
    ],
        summary="The user and the agent are discussing a time when the user had to come a challenge. The user is "
                "explaining how they used their arch skills to come up with new ideas.")
    output = await qna_agent.execute(AgentInput(message="What will do you with my data?"), conversation_history)

    assert "TRUE" in await _evaluate_with_llm(
        f"""Respond only with TRUE if "{output.message_for_user}" explains how the data will be used. Otherwise respond
        with FALSE."""), f"output: {output}"


# TODO: Make a fake conversation history, that handles the addition of turns
async def _execute_agent(context, agent, agent_input):
    agent_output = await agent.execute(agent_input, context)
    context.all_history.turns.append(ConversationTurn(index=len(context.all_history.turns), input=agent_input,
                                                      output=agent_output))
    context.history.turns.append(ConversationTurn(index=len(context.all_history.turns), input=agent_input,
                                                  output=agent_output))
    context.history.turns = context.history.turns[-5:]
    context.summary = "A conversation between the user and tabiya compass. The user is asking generic questions " \
                      "about the process."
    return agent_output


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_qna_agent_responds_to_multiple_questions_in_a_row():
    qna_agent = QnaAgent()
    conversation_context = ConversationContext(all_history=[], history=[], summary="")
    prompt = "You are a student from Kenya. You are just starting the process with the tabiya compass. " \
             "You are asking generic questions about the process."
    simulated_user = LLMSimulatedUser(
        system_instructions=prompt,
        llm_config=LLMConfig(
            generation_config=MEDIUM_TEMPERATURE_GENERATION_CONFIG,
            safety_settings=SAFETY_OFF_SETTINGS))
    evaluation_record = ConversationEvaluationRecord(test_case="qna_agent_responds_to_multiple_questions_in_a_row",
                                                     simulated_user_prompt=prompt)

    evaluation_record.conversation.extend(await generate(max_iterations=5,
                                                         execute_evaluated_agent=lambda agent_input: _execute_agent(
                                                             conversation_context,
                                                             qna_agent, agent_input),
                                                         execute_simulated_user=simulated_user,
                                                         is_finished=lambda agent_output: False))

    conciseness_eval = await CriteriaEvaluator(criteria=EvaluationType.CONCISENESS).evaluate(evaluation_record)
    evaluation_record.evaluations.append(conciseness_eval)
    time_now = datetime.now(timezone.utc).isoformat()
    folder = os.path.join(os.path.dirname(__file__), 'test_output')
    evaluation_record.save_data(folder=folder,
                                base_file_name="qna_agent_responds_to_multiple_questions_in_a_row" + time_now)

    assert conciseness_eval.score > 90, f"reasoning: {conciseness_eval.reasoning}"
    # TODO: Add another evaluation to make sure that the conversation is on track.
