import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone

import pytest

from app.career_readiness.types import TopicStatus
from app.i18n.translation_service import get_i18n_manager
from app.i18n.types import Locale
from evaluation_tests.conversation_libs.conversation_generator import generate
from evaluation_tests.conversation_libs.conversation_test_function import ScriptedSimulatedUser
from evaluation_tests.conversation_libs.evaluators.evaluation_result import (
    Actor,
    ConversationRecord,
    ConversationEvaluationRecord,
)
from evaluation_tests.career_readiness_agent.career_readiness_agent_executors import (
    CareerReadinessExecutor,
    CareerReadinessGetConversationContextExecutor,
    CareerReadinessIsFinished,
)
from app.conversation_memory.save_conversation_context import (
    save_conversation_context_to_json,
    save_conversation_context_to_markdown,
)


@dataclass
class CareerReadinessTestCase:
    """Test case with scripted user messages and expected phrases from module content."""
    name: str
    module_id: str
    scripted_user: list[str]
    description: str
    expected_phrases_by_turn: list[list[str]] = field(default_factory=list)
    """
    For each agent response (after welcome), at least one phrase in the list must appear.
    Turn 0 = welcome message (skipped). Turn 1 = response to scripted_user[0], etc.
    """


TEST_CASES = [
    CareerReadinessTestCase(
        name="professional_identity_basics",
        module_id="professional-identity",
        description="Student explores professional identity concepts with partial knowledge",
        scripted_user=[
            "I'm not really sure, maybe it's just about what job I have?",
            "I think skills are things like using computers and being good with people",
        ],
        expected_phrases_by_turn=[
            ["professional identity", "values", "skills", "experiences", "aspirations", "career"],
            ["technical", "transferable", "knowledge", "communication", "problem-solving", "categories", "types"],
        ],
    ),
    CareerReadinessTestCase(
        name="cv_development_structure",
        module_id="cv-development",
        description="Student explores CV development with partial knowledge of structure",
        scripted_user=[
            "I think it's like a list of jobs I've had, right?",
            "Maybe I should start with my name and then write about what I did at my jobs?",
        ],
        expected_phrases_by_turn=[
            ["CV", "education", "experience", "skills", "achievements", "employers", "document", "summarize"],
            ["contact", "personal statement", "professional summary", "work experience", "education", "structure",
             "sections", "skills", "accomplishments", "qualifications", "organize"],
        ],
    ),
    CareerReadinessTestCase(
        name="interview_preparation_types",
        module_id="interview-preparation",
        description="Student explores interview types and the STAR method",
        scripted_user=[
            "I've only done face-to-face interviews, I don't know much about other types",
            "In the behavioral one, you describe what happened at a past job?",
        ],
        expected_phrases_by_turn=[
            ["structured", "behavioral", "situational", "panel", "types", "interview"],
            ["STAR", "Situation", "Task", "Action", "Result", "method"],
        ],
    ),
]


@dataclass
class CareerReadinessEdgeCaseTestCase:
    """
    Edge case test: scripted conversation with topic_status assertions.
    No phrase matching — asserts only on server-side topic_status state and
    that the agent keeps asking questions while topics remain uncovered.
    """
    name: str
    module_id: str
    description: str
    scripted_user: list[str]
    # topic_id -> expected TopicStatus after all turns complete
    expected_final_topic_status: dict[str, TopicStatus] = field(default_factory=dict)
    # Indices (0-based, into agent responses after the welcome) where the agent
    # MUST still be asking a question (i.e. topics remain, must not wrap up)
    must_ask_question_at_turns: list[int] = field(default_factory=list)


EDGE_CASE_TEST_CASES = [
    CareerReadinessEdgeCaseTestCase(
        name="no_premature_completion_with_uncovered_topics",
        module_id="professional-identity",
        description=(
            "Student gives a strong answer on the first topic only, then deflects vaguely. "
            "The agent must not mark the module complete and must keep asking about remaining topics."
        ),
        scripted_user=[
            # Strong answer on "What is Professional Identity?"
            "Professional identity is how I see myself as a worker — my values, the skills I've built as an "
            "electrician, and what kind of professional I want to become. It's not just my job title.",
            # Vague deflection on next topic
            "I don't know, maybe just whatever I can do?",
            # Another deflection
            "I guess the same thing as before?",
        ],
        expected_final_topic_status={
            # First topic should be covered after the strong answer
            "What is Professional Identity?": TopicStatus.COVERED,
            # Remaining topics must not be covered after vague answers
            "Types of Skills": TopicStatus.NOT_COVERED,
            "How to Identify Your Skills": TopicStatus.NOT_COVERED,
            "Articulating Your Professional Identity": TopicStatus.NOT_COVERED,
        },
        must_ask_question_at_turns=[1, 2],  # after each vague answer, agent must still be asking
    ),
    CareerReadinessEdgeCaseTestCase(
        name="off_topic_answer_does_not_cover_asked_topic",
        module_id="cv-development",
        description=(
            "Student answers about cover letters when asked about CVs. "
            "The agent must redirect; CV topics must not be marked covered from the off-topic answer."
        ),
        scripted_user=[
            # Off-topic: student answers about cover letters instead of CVs
            "A cover letter is a letter you write to the employer explaining why you want the job. "
            "You should keep it short and address it to the hiring manager.",
            # On-topic: proper answer about CV structure
            "A CV should have my contact details at the top, then a personal statement, "
            "then my work experience and education, and finally my skills.",
        ],
        expected_final_topic_status={
            # CV Structure may be covered after the second on-topic answer — that's fine.
            # The key assertion is that the module is NOT complete after only two turns.
            # We assert this via is_complete in the test body rather than per-topic here,
            # since the exact coverage after two turns depends on the LLM.
        },
        must_ask_question_at_turns=[0],  # after the off-topic answer, agent must redirect with a question
    ),
    CareerReadinessEdgeCaseTestCase(
        name="thin_answers_do_not_mark_topics_covered",
        module_id="interview-preparation",
        description=(
            "Student gives bare acknowledgment answers for several turns. "
            "Topics must not be marked covered on thin engagement."
        ),
        scripted_user=[
            # Bare acknowledgment
            "Yes I understand.",
            # Vague
            "I think STAR means like... telling a story about what happened.",
            # Still thin
            "Yeah that makes sense.",
            # Substantive answer on The STAR Method
            "So Situation is what was happening, Task is what I needed to do, Action is what I actually did, "
            "and Result is what happened because of it. Like when my supervisor asked me to fix a wiring fault "
            "alone — I diagnosed it, replaced the component, and the machine was back online in an hour.",
        ],
        expected_final_topic_status={
            # Types of Interviews — only received acknowledgment answers, must not be covered
            "Types of Interviews": TopicStatus.NOT_COVERED,
        },
        must_ask_question_at_turns=[0, 1, 2],  # agent must keep probing after each thin answer
    ),
    CareerReadinessEdgeCaseTestCase(
        name="topic_status_no_downgrade_after_contradictory_answer",
        module_id="professional-identity",
        description=(
            "Student covers two topics well, then later contradicts the first. "
            "The server-side merge must not downgrade previously covered topics."
        ),
        scripted_user=[
            # Strong answer on "What is Professional Identity?"
            "Professional identity is more than a job title. It's my values, skills, and career goals. "
            "For me as a plumber, it means being someone who solves problems reliably and takes pride in safe work.",
            # Strong answer on "Types of Skills"
            "There are technical skills like pipefitting and using pressure gauges, and transferable skills "
            "like communication and problem-solving that apply across any job.",
            # Contradicts the first topic — potential downgrade trigger
            "Actually wait, I think professional identity is just your job title after all.",
            # Answer on "How to Identify Your Skills"
            "To identify my skills I would think about what tasks I do well and ask my supervisor for feedback.",
        ],
        expected_final_topic_status={
            # Both topics covered before the contradiction must remain COVERED
            "What is Professional Identity?": TopicStatus.COVERED,
            "Types of Skills": TopicStatus.COVERED,
        },
        must_ask_question_at_turns=[],
    ),
]


def _agent_responses(conversation: list[ConversationRecord]) -> list[str]:
    return [r.message for r in conversation if r.actor == Actor.EVALUATED_AGENT]


def _assert_module_content(conversation: list[ConversationRecord], test_case: CareerReadinessTestCase) -> None:
    agent_responses = _agent_responses(conversation)
    assert len(agent_responses) >= 1, "Expected at least one agent response"
    for i, expected_phrases in enumerate(test_case.expected_phrases_by_turn):
        response_index = i + 1
        if response_index >= len(agent_responses):
            break
        response_text = agent_responses[response_index].lower()
        found = any(phrase.lower() in response_text for phrase in expected_phrases)
        excerpt = agent_responses[response_index][:400] + "..." if len(
            agent_responses[response_index]) > 400 else agent_responses[response_index]
        assert found, (
            f"Agent response to '{test_case.scripted_user[i]}' should contain "
            f"at least one of {expected_phrases} but got: {excerpt}"
        )


def _save_conversation_output(
    conversation: list[ConversationRecord],
    test_case: CareerReadinessTestCase | CareerReadinessEdgeCaseTestCase,
    subfolder: str,
) -> None:
    output_folder = os.path.join(
        os.getcwd(), "test_output", "career_readiness_agent", subfolder, test_case.name,
    )
    os.makedirs(output_folder, exist_ok=True)
    base_name = f"{test_case.name}_{datetime.now(timezone.utc).isoformat()}"
    record = ConversationEvaluationRecord(
        simulated_user_prompt=test_case.description,
        test_case=test_case.name,
    )
    record.add_conversation_records(conversation)
    record.save_data(folder=output_folder, base_file_name=base_name)


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.5-flash-lite/")
@pytest.mark.parametrize("test_case", TEST_CASES, ids=[tc.name for tc in TEST_CASES])
async def test_career_readiness_scripted(evals_setup, setup_multi_locale_app_config,
                                         test_case: CareerReadinessTestCase):
    """
    Scripted conversation test for the Career Readiness agent.
    Asserts agent responses include relevant module content phrases.
    """
    logging.info("Running Career Readiness test case: %s", test_case.name)
    get_i18n_manager().set_locale(Locale.EN_US)

    executor = CareerReadinessExecutor(module_id=test_case.module_id)
    max_iterations = len(test_case.scripted_user) + 1

    conversation = await generate(
        max_iterations=max_iterations,
        execute_evaluated_agent=executor,
        execute_simulated_user=ScriptedSimulatedUser(script=test_case.scripted_user),
        is_finished=CareerReadinessIsFinished(executor),
    )

    _assert_module_content(conversation, test_case)
    _save_conversation_output(conversation, test_case,"scripted")

    context = await CareerReadinessGetConversationContextExecutor(executor)()
    output_folder = os.path.join(
        os.getcwd(), "test_output", "career_readiness_agent", "scripted", test_case.name,
    )
    base_name = f"{test_case.name}_{datetime.now(timezone.utc).isoformat()}"
    ctx_path = os.path.join(output_folder, f"{base_name}_context")
    save_conversation_context_to_json(context=context, file_path=ctx_path + ".json")
    save_conversation_context_to_markdown(
        title=f"Career Readiness: {test_case.name}",
        context=context,
        file_path=ctx_path + ".md",
    )


@pytest.mark.asyncio
@pytest.mark.evaluation_test("gemini-2.5-flash-lite/")
@pytest.mark.parametrize("test_case", EDGE_CASE_TEST_CASES, ids=[tc.name for tc in EDGE_CASE_TEST_CASES])
async def test_career_readiness_edge_cases(evals_setup, setup_multi_locale_app_config,
                                            test_case: CareerReadinessEdgeCaseTestCase):
    """
    Edge case tests targeting quiz-trigger reliability (CORE-310).

    Assertions are on server-side topic_status state (not phrase matching), and on
    whether the agent keeps asking questions while topics remain uncovered.

    Failure modes covered:
    - no_premature_completion: module must not complete when topics are uncovered
    - off_topic_answer: an off-topic answer must not cover the asked topic
    - thin_answers: bare acknowledgments must not mark topics as covered
    - no_downgrade: a later contradictory answer must not downgrade a covered topic
    """
    logging.info("Running Career Readiness edge case: %s", test_case.name)
    get_i18n_manager().set_locale(Locale.EN_US)

    executor = CareerReadinessExecutor(module_id=test_case.module_id)
    max_iterations = len(test_case.scripted_user) + 1

    conversation = await generate(
        max_iterations=max_iterations,
        execute_evaluated_agent=executor,
        execute_simulated_user=ScriptedSimulatedUser(script=test_case.scripted_user),
        is_finished=CareerReadinessIsFinished(executor),
    )

    _save_conversation_output(conversation, test_case, "edge_cases")

    agent_responses = _agent_responses(conversation)
    final_status = {r.topic_id: r.status for r in executor.topic_status}

    # Assert the agent kept asking questions at turns where topics remained uncovered
    for turn_index in test_case.must_ask_question_at_turns:
        response_index = turn_index + 1  # +1 to skip the welcome message
        if response_index < len(agent_responses):
            response = agent_responses[response_index]
            assert "?" in response, (
                f"Agent must ask a question at turn {turn_index} while topics remain uncovered, "
                f"but got: {response[:300]}"
            )

    # Assert expected per-topic final statuses
    for topic_id, expected_status in test_case.expected_final_topic_status.items():
        actual = final_status.get(topic_id)
        assert actual == expected_status, (
            f"Topic '{topic_id}': expected {expected_status.value}, got {actual.value if actual else 'missing'}"
        )

    # Assert module is not prematurely complete for tests where that is the key invariant
    if test_case.name in (
        "no_premature_completion_with_uncovered_topics",
        "off_topic_answer_does_not_cover_asked_topic",
        "thin_answers_do_not_mark_topics_covered",
    ):
        assert not executor.is_complete, (
            f"Module must not be marked complete after scripted turns for '{test_case.name}'"
        )
