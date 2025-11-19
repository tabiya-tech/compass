import pytest

from app.agent.agent_types import AgentInput
from app.agent.qna_agent import QnaAgent
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig
from evaluation_tests.conversation_libs.conversation_generator import generate
from evaluation_tests.conversation_libs.conversation_test_function import LLMSimulatedUser
from evaluation_tests.conversation_libs.evaluators.criteria_evaluator import CriteriaEvaluator
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationRecord, Actor, EvaluationType, \
    ConversationEvaluationRecord
from evaluation_tests.conversation_libs.fake_conversation_context import FakeConversationContext


async def _evaluate_with_llm(prompt: str) -> str:
    llm = GeminiGenerativeLLM(config=LLMConfig(model_name="gemini-1.5-pro-preview-0409"))
    return (await llm.generate_content(prompt)).text


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_qna_agent_answering_simple_question(fake_conversation_context: FakeConversationContext):
    """ Tests the QnA agent with a simple question. """
    qna_agent = QnaAgent()

    output = await qna_agent.execute(AgentInput(message="What will you do with my data?"),
                                     fake_conversation_context)

    assert "TRUE" in await _evaluate_with_llm(
        f"""Respond only with TRUE if "{output.message_for_user}" explains how the data will be used. Otherwise respond
        with FALSE."""), f"output: {output}"


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_qna_agent_responds_with_cannot_help_for_irrelevant_questions(
        fake_conversation_context: FakeConversationContext):
    """ Tests the QnA agent with an irrelevant question. """
    qna_agent = QnaAgent()

    output = await qna_agent.execute(AgentInput(message="Lorem ipsum dolor sit amet."),
                                     fake_conversation_context)

    assert "TRUE" in await _evaluate_with_llm(
        f"""Respond only with TRUE if "{output.message_for_user}" says something similar to "I cannot help you with 
        this". Otherwise respond with FALSE."""), f"output: {output}"


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_qna_agent_returns_finished_true(fake_conversation_context: FakeConversationContext):
    """ Tests the QnA agent with a simple question."""
    qna_agent = QnaAgent()

    output = await qna_agent.execute(AgentInput(message="What will you do with my data?"),
                                     fake_conversation_context)

    assert output.finished, f"output: {output}"


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_qna_agent_ignores_previous_conversation(fake_conversation_context: FakeConversationContext):
    """ Tests the QnA agent with a simple question after a conversation. """
    qna_agent = QnaAgent()

    fake_conversation_context.fill_conversation(conversation=[
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
    output = await qna_agent.execute(AgentInput(message="What will do you with my data?"), fake_conversation_context)

    assert "TRUE" in await _evaluate_with_llm(
        f"""Respond only with TRUE if "{output.message_for_user}" explains how the data will be used. Otherwise respond
        with FALSE."""), f"output: {output}"


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_qna_agent_responds_to_follow_up_questions(fake_conversation_context: FakeConversationContext):
    """ Tests the QnA agent with a follow-up question. """
    qna_agent = QnaAgent()

    fake_conversation_context.fill_conversation(conversation=[
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
        ConversationRecord(
            message="What will you do with my data?",
            actor=Actor.SIMULATED_USER),
        ConversationRecord(
            message="I will use your data to improve my ability to answer questions and generate text. I will not "
                    "share your data with anyone else without your permission.",
            actor=Actor.EVALUATED_AGENT),
    ],
        summary="The user and the agent are discussing a time when the user had to come a challenge. The user is "
                "explaining how they used their arch skills to come up with new ideas.")
    output = await qna_agent.execute(AgentInput(message="Could you elaborate more?"), fake_conversation_context)

    assert "TRUE" in await _evaluate_with_llm(
        f"""Respond only with TRUE if "{output.message_for_user}" explains how the data will be used. Otherwise respond
        with FALSE."""), f"output: {output}"


async def _execute_agent(context: FakeConversationContext, agent, agent_input):
    agent_output = await agent.execute(agent_input, context)
    context.add_history(agent_input, agent_output)
    return agent_output


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_qna_agent_responds_to_multiple_questions_in_a_row(fake_conversation_context: FakeConversationContext,
                                                                 common_folder_path: str):
    """ Tests the QnA agent with multiple questions in a row. """
    qna_agent = QnaAgent()
    prompt = "You are a student from Kenya. You are just starting the process with the tabiya compass. " \
             "You are asking generic questions about the process. Ask only one question at a time, be concise."
    fake_conversation_context.set_summary("The user is asking generic questions about the process.")
    simulated_user = LLMSimulatedUser(system_instructions=prompt)
    evaluation_record = ConversationEvaluationRecord(test_case="qna_agent_responds_to_multiple_questions_in_a_row",
                                                     simulated_user_prompt=prompt)

    try:
        evaluation_record.conversation.extend(await generate(max_iterations=5,
                                                             execute_evaluated_agent=lambda agent_input: _execute_agent(
                                                                 fake_conversation_context,
                                                                 qna_agent, agent_input),
                                                             execute_simulated_user=simulated_user,
                                                             is_finished=lambda agent_output: False))

        conciseness_eval = await CriteriaEvaluator(criteria=EvaluationType.CONCISENESS).evaluate(evaluation_record)
        evaluation_record.evaluations.append(conciseness_eval)
        assert conciseness_eval.score > 70, f"reasoning: {conciseness_eval.reasoning}"
        assert "TRUE" in await _evaluate_with_llm(
            f"""Respond with TRUE if given the conversation below, the EVALUATED_AGENT responds to each question 
                about Brujula, not going into unnecessary detail and sticking to facts. 
                Otherwise respond with FALSE. Provide a reason.
                CONVERSATION:
                {evaluation_record.generate_conversation()}
        """)
    finally:
        folder = common_folder_path + 'qna_agent_responds_to_multiple_questions_in_a_row'
        evaluation_record.save_data(folder=folder, base_file_name="evaluation_record")
        fake_conversation_context.save_conversation(folder_path=folder, title="QnA Agent Multiple Questions in a Row")
