import pytest

from app.conversation_memory.summarizer import Summarizer
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig
from evaluation_tests.conversation_libs.evaluators.evaluation_result import ConversationRecord, Actor, EvaluationType, \
    SummaryEvaluationRecord
from evaluation_tests.conversation_libs.fake_conversation_context import FakeConversationContext
from evaluation_tests.summarizer.summary_evaluator import SummaryCriteriaEvaluator

SUMMARY_EVALUATION_TYPES = [EvaluationType.SUMMARY_CONSISTENCY, EvaluationType.SUMMARY_RELEVANCE]


async def _evaluate_with_llm(prompt: str) -> str:
    llm = GeminiGenerativeLLM(config=LLMConfig(language_model_name="gemini-2.5-pro"))
    return (await llm.generate_content(prompt)).text


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(3)
async def test_summarizer_without_existing_summary(fake_conversation_context: FakeConversationContext,
                                                   common_folder_path: str):
    """ Tests the summarizer with a current conversation and without an existing summary. """
    summarizer = Summarizer()
    conversation_record = [
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
    ]
    fake_conversation_context.fill_conversation(conversation=conversation_record,
                                                summary="")
    summary = await summarizer.summarize(fake_conversation_context)

    evaluation_record = SummaryEvaluationRecord(test_case="test_summarizer_without_existing_summary",
                                                current_summary="",
                                                new_summary=summary,
                                                conversation=conversation_record)

    try:
        for eval_type in SUMMARY_EVALUATION_TYPES:
            summary_eval = await SummaryCriteriaEvaluator(eval_type).evaluate(evaluation_record)
            evaluation_record.evaluations.append(summary_eval)
            assert summary_eval.score > 3, f"reasoning: {summary_eval.reasoning}"

        assert "TRUE" in await _evaluate_with_llm(
            f"""Respond only with TRUE if the _SUMMARY_:"{summary}" is no longer then 100 words. Otherwise respond with FALSE."""), f"output: {summary}"

        assert "TRUE" in await _evaluate_with_llm(
            f"""Respond only with TRUE if the _SUMMARY_:"{summary}" mentions that the user was working on a big writing project for Huum Hub and that they used problem-solving and research skills to complete the project. Otherwise respond with FALSE."""), f"output: {summary}"

    finally:
        folder = common_folder_path + 'summarizer_without_existing_summary'
        evaluation_record.save_data(folder=folder, base_file_name="evaluation_record")


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.0-flash-001/")
@pytest.mark.repeat(3)
async def test_summarizer_with_existing_summary(fake_conversation_context: FakeConversationContext,
                                                common_folder_path: str):
    """ Tests the summarizer with a current conversation and an existing summary. """
    summarizer = Summarizer()
    conversation_record = [
        ConversationRecord(
            message="Yeah, I'm ready! Let's do this! I'm looking for a job that will let me use my English skills. I'm good at writing and speaking, and I'm also a hard worker. I'm hoping to find something that will help me support myself and my family.",
            actor=Actor.SIMULATED_USER),
        ConversationRecord(
            message="Great, you can now begin the skills exploration session.",
            actor=Actor.EVALUATED_AGENT),
    ]
    current_summary = "I am ready to begin my skills exploration session. I am excited to learn more about my skills and how I can use them to help others."
    fake_conversation_context.fill_conversation(conversation=conversation_record,
                                                summary=current_summary)
    new_summary = await summarizer.summarize(fake_conversation_context)

    evaluation_record = SummaryEvaluationRecord(test_case="test_summarizer_with_existing_summary",
                                                conversation=conversation_record,
                                                current_summary=current_summary, new_summary=new_summary)

    try:
        for eval_type in SUMMARY_EVALUATION_TYPES:
            summary_eval = await SummaryCriteriaEvaluator(eval_type).evaluate(evaluation_record)
            evaluation_record.evaluations.append(summary_eval)
            assert summary_eval.score > 3, f"reasoning: {summary_eval.reasoning}"

        assert "TRUE" in await _evaluate_with_llm(
            f"""Respond only with TRUE if the _SUMMARY_:"{new_summary}" is no longer then 100 words. Otherwise respond with FALSE."""), f"output: {new_summary}"

        assert "TRUE" in await _evaluate_with_llm(
            f"""Respond only with TRUE if the _SUMMARY_:"{new_summary}"  mentions that the user has a good English writing and speaking skills. Otherwise respond with FALSE."""), f"output: {new_summary}"

    finally:
        folder = common_folder_path + 'summarizer_with_existing_summary'
        evaluation_record.save_data(folder=folder, base_file_name="evaluation_record")
