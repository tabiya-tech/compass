"""
Tests for the career readiness service layer.
"""
from datetime import datetime, timezone

import pytest
from bson import ObjectId

from app.agent.agent_types import AgentOutput, AgentType
from app.career_readiness.agent import CareerReadinessAgentOutput
from app.career_readiness.errors import (
    ConversationAccessDeniedError,
    ConversationAlreadyExistsError,
    ConversationNotFoundError,
    CareerReadinessModuleNotFoundError,
    QuizAlreadyPassedError,
    QuizNotAvailableError,
)
from app.career_readiness.module_loader import ModuleConfig, ModuleRegistry, QuizConfig, QuizQuestion
from app.career_readiness.repository import ICareerReadinessConversationRepository
from app.career_readiness.service import (
    CareerReadinessService,
    _build_conversation_context,
    _derive_module_statuses,
    _evaluate_quiz,
    _merge_topic_status,
    _normalize_topic,
    _synthesize_topic_status,
)
from app.career_readiness.types import (
    CareerReadinessConversationDocument,
    CareerReadinessMessage,
    CareerReadinessMessageSender,
    ConversationMode,
    ModuleStatus,
    TopicStatus,
    TopicStatusRecord,
)
from app.context_vars import user_language_ctx_var
from app.i18n.types import Locale


@pytest.fixture(autouse=True)
def set_locale():
    """Set the active locale required by the translated service messages (via t())."""
    token = user_language_ctx_var.set(Locale.EN_US)
    yield
    user_language_ctx_var.reset(token)


# ---------------------------------------------------------------------------
# Quiz helpers
# ---------------------------------------------------------------------------

def _make_quiz_questions() -> list[QuizQuestion]:
    return [
        QuizQuestion(question="Q1?", options=["A. Opt1", "B. Opt2", "C. Opt3", "D. Opt4"], correct_answer="A"),
        QuizQuestion(question="Q2?", options=["A. Opt1", "B. Opt2", "C. Opt3", "D. Opt4"], correct_answer="B"),
    ]


def _make_quiz_config() -> QuizConfig:
    return QuizConfig(pass_threshold=0.5, questions=_make_quiz_questions())


# ---------------------------------------------------------------------------
# Mock helpers
# ---------------------------------------------------------------------------

def _make_module_config(
    module_id: str = "cv-development",
    title: str = "CV Development",
    sort_order: int = 1,
    topics: list[str] | None = None,
    quiz: QuizConfig | None = None,
) -> ModuleConfig:
    return ModuleConfig(
        id=module_id,
        title=title,
        description="A test module.",
        icon="cv",
        sort_order=sort_order,
        input_placeholder="Ask about CVs...",
        content="# CV Content\nWrite your CV.",
        topics=topics or ["Topic A", "Topic B"],
        quiz=quiz or _make_quiz_config(),
    )


def _make_message(
    sender: CareerReadinessMessageSender = CareerReadinessMessageSender.AGENT,
    message: str = "Hello",
) -> CareerReadinessMessage:
    return CareerReadinessMessage(
        message_id=str(ObjectId()),
        message=message,
        sender=sender,
        sent_at=datetime.now(timezone.utc),
    )


def _make_conversation(
    user_id: str = "test_user",
    module_id: str = "cv-development",
    messages: list[CareerReadinessMessage] | None = None,
    conversation_mode: ConversationMode = ConversationMode.INSTRUCTION,
    covered_topics: list[str] | None = None,
    topic_status: list[TopicStatusRecord] | None = None,
    quiz_delivered: bool = False,
    quiz_passed: bool = False,
) -> CareerReadinessConversationDocument:
    now = datetime.now(timezone.utc)
    return CareerReadinessConversationDocument(
        conversation_id=str(ObjectId()),
        module_id=module_id,
        user_id=user_id,
        messages=messages or [_make_message()],
        conversation_mode=conversation_mode,
        covered_topics=covered_topics or [],
        topic_status=topic_status or [],
        quiz_delivered=quiz_delivered,
        quiz_passed=quiz_passed,
        created_at=now,
        updated_at=now,
    )


def _full_topic_status(
    topics: list[str],
    covered: list[str] | None = None,
    partial: list[str] | None = None,
) -> list[TopicStatusRecord]:
    """Build a topic_status list with the given covered/partial assignments; the rest NOT_COVERED."""
    covered_set = set(covered or [])
    partial_set = set(partial or [])
    result: list[TopicStatusRecord] = []
    for topic in topics:
        if topic in covered_set:
            result.append(TopicStatusRecord(
                topic_id=topic, status=TopicStatus.COVERED, evidence="student explained it",
            ))
        elif topic in partial_set:
            result.append(TopicStatusRecord(
                topic_id=topic, status=TopicStatus.PARTIAL, evidence="brief mention",
            ))
        else:
            result.append(TopicStatusRecord(
                topic_id=topic, status=TopicStatus.NOT_COVERED, evidence="",
            ))
    return result


class MockRepository(ICareerReadinessConversationRepository):
    """In-memory mock repository for testing."""

    def __init__(self):
        self._conversations: dict[str, CareerReadinessConversationDocument] = {}

    async def create(self, document: CareerReadinessConversationDocument) -> None:
        self._conversations[document.conversation_id] = document

    async def find_by_conversation_id(self, conversation_id: str) -> CareerReadinessConversationDocument | None:
        return self._conversations.get(conversation_id)

    async def find_by_user_and_module(self, user_id: str, module_id: str) -> CareerReadinessConversationDocument | None:
        for conv in self._conversations.values():
            if conv.user_id == user_id and conv.module_id == module_id:
                return conv
        return None

    async def find_all_by_user(self, user_id: str) -> list[CareerReadinessConversationDocument]:
        return [conv for conv in self._conversations.values() if conv.user_id == user_id]

    async def append_message(self, conversation_id: str, message: CareerReadinessMessage) -> None:
        conv = self._conversations.get(conversation_id)
        if conv:
            conv.messages.append(message)
            conv.updated_at = datetime.now(timezone.utc)

    async def update_topic_status(self, conversation_id: str, topic_status: list[TopicStatusRecord]) -> None:
        conv = self._conversations.get(conversation_id)
        if conv:
            conv.topic_status = list(topic_status)
            conv.updated_at = datetime.now(timezone.utc)

    async def update_quiz_delivered(self, conversation_id: str, delivered: bool) -> None:
        conv = self._conversations.get(conversation_id)
        if conv:
            conv.quiz_delivered = delivered
            conv.updated_at = datetime.now(timezone.utc)

    async def update_quiz_passed(self, conversation_id: str, passed: bool) -> None:
        conv = self._conversations.get(conversation_id)
        if conv:
            conv.quiz_passed = passed
            conv.updated_at = datetime.now(timezone.utc)

    async def update_conversation_mode(self, conversation_id: str, mode: ConversationMode) -> None:
        conv = self._conversations.get(conversation_id)
        if conv:
            conv.conversation_mode = mode
            conv.updated_at = datetime.now(timezone.utc)

    async def delete_by_conversation_id(self, conversation_id: str) -> bool:
        if conversation_id in self._conversations:
            del self._conversations[conversation_id]
            return True
        return False


class MockModuleRegistry(ModuleRegistry):
    """Module registry that uses in-memory modules instead of loading from disk."""

    def __init__(self, modules: list[ModuleConfig] | None = None):
        # Skip parent __init__ to avoid loading from disk
        self._modules: dict[str, ModuleConfig] = {}
        for m in (modules or []):
            self._modules[m.id] = m


def _make_mock_agent_output(
    message: str = "Agent response",
    proposed_topic_status: list[TopicStatusRecord] | None = None,
) -> CareerReadinessAgentOutput:
    agent_output = AgentOutput(
        message_id=str(ObjectId()),
        message_for_user=message,
        finished=False,
        agent_type=AgentType.CAREER_READINESS_AGENT,
        agent_response_time_in_sec=0.5,
        llm_stats=[],
        sent_at=datetime.now(timezone.utc),
    )
    return CareerReadinessAgentOutput(
        agent_output=agent_output,
        proposed_topic_status=proposed_topic_status or [],
    )


class MockCareerReadinessAgent:
    """Mock agent that returns canned responses without calling an LLM."""

    def __init__(self, intro_message: str = "Welcome!", response_message: str = "Agent response",
                 proposed_topic_status: list[TopicStatusRecord] | None = None):
        self._intro_message = intro_message
        self._response_message = response_message
        self._proposed_topic_status = proposed_topic_status or []
        self.last_current_topic_status: list[TopicStatusRecord] | None = None

    async def generate_intro_message(self, context):
        return _make_mock_agent_output(message=self._intro_message)

    async def execute(self, user_input, context, current_topic_status=None):
        self.last_current_topic_status = current_topic_status
        return _make_mock_agent_output(
            message=self._response_message,
            proposed_topic_status=self._proposed_topic_status,
        )


def _make_mock_agent_factory(agent: MockCareerReadinessAgent | None = None):
    """Factory that returns a mock agent regardless of mode."""
    mock_agent = agent or MockCareerReadinessAgent()

    def factory(module_config, mode, **kwargs):
        return mock_agent

    return factory


def _make_service(
    modules: list[ModuleConfig] | None = None,
    repository: MockRepository | None = None,
    agent: MockCareerReadinessAgent | None = None,
) -> tuple[CareerReadinessService, MockRepository]:
    """Helper to create a service with mocked dependencies."""
    repo = repository or MockRepository()
    registry = MockModuleRegistry(modules or [_make_module_config()])
    factory = _make_mock_agent_factory(agent)
    service = CareerReadinessService(repository=repo, module_registry=registry, agent_factory=factory)
    return service, repo


# ---------------------------------------------------------------------------
# Tests — Pure functions
# ---------------------------------------------------------------------------

class TestDeriveModuleStatuses:
    """Tests for the _derive_module_statuses function."""

    def test_all_modules_not_started_when_no_conversations(self):
        # GIVEN three modules and no conversations
        given_modules = [
            _make_module_config(module_id="m1", sort_order=1),
            _make_module_config(module_id="m2", sort_order=2),
            _make_module_config(module_id="m3", sort_order=3),
        ]

        # WHEN statuses are derived
        actual_statuses = _derive_module_statuses(given_modules, [])

        # THEN all modules are NOT_STARTED
        assert actual_statuses["m1"] == ModuleStatus.NOT_STARTED
        assert actual_statuses["m2"] == ModuleStatus.NOT_STARTED
        assert actual_statuses["m3"] == ModuleStatus.NOT_STARTED

    def test_modules_without_conversations_are_not_started_regardless_of_completions(self):
        # GIVEN three modules and the first one completed
        given_modules = [
            _make_module_config(module_id="m1", sort_order=1),
            _make_module_config(module_id="m2", sort_order=2),
            _make_module_config(module_id="m3", sort_order=3),
        ]
        given_conversations = [
            _make_conversation(module_id="m1", quiz_passed=True),
        ]

        # WHEN statuses are derived
        actual_statuses = _derive_module_statuses(given_modules, given_conversations)

        # THEN the first is COMPLETED, second and third are NOT_STARTED
        assert actual_statuses["m1"] == ModuleStatus.COMPLETED
        assert actual_statuses["m2"] == ModuleStatus.NOT_STARTED
        assert actual_statuses["m3"] == ModuleStatus.NOT_STARTED

    def test_completed_modules_coexist_with_not_started_modules(self):
        # GIVEN three modules with first two completed
        given_modules = [
            _make_module_config(module_id="m1", sort_order=1),
            _make_module_config(module_id="m2", sort_order=2),
            _make_module_config(module_id="m3", sort_order=3),
        ]
        given_conversations = [
            _make_conversation(module_id="m1", quiz_passed=True),
            _make_conversation(module_id="m2", quiz_passed=True),
        ]

        # WHEN statuses are derived
        actual_statuses = _derive_module_statuses(given_modules, given_conversations)

        # THEN third module is NOT_STARTED
        assert actual_statuses["m1"] == ModuleStatus.COMPLETED
        assert actual_statuses["m2"] == ModuleStatus.COMPLETED
        assert actual_statuses["m3"] == ModuleStatus.NOT_STARTED

    def test_in_progress_module_does_not_affect_other_statuses(self):
        # GIVEN first module in progress (has conversation but quiz not passed)
        given_modules = [
            _make_module_config(module_id="m1", sort_order=1),
            _make_module_config(module_id="m2", sort_order=2),
        ]
        given_conversations = [
            _make_conversation(module_id="m1", quiz_passed=False),
        ]

        # WHEN statuses are derived
        actual_statuses = _derive_module_statuses(given_modules, given_conversations)

        # THEN first is IN_PROGRESS, second is NOT_STARTED
        assert actual_statuses["m1"] == ModuleStatus.IN_PROGRESS
        assert actual_statuses["m2"] == ModuleStatus.NOT_STARTED


class TestEvaluateQuiz:
    """Tests for the quiz evaluator."""

    def test_all_correct(self):
        # GIVEN a quiz and all correct answers
        given_quiz = _make_quiz_config()
        given_answers = {1: "A", 2: "B"}

        # WHEN evaluated
        actual_score, actual_total, actual_results = _evaluate_quiz(given_quiz, given_answers)

        # THEN all are correct
        assert actual_score == 2
        assert actual_total == 2
        assert actual_results == [True, True]

    def test_partial_correct(self):
        # GIVEN a quiz with one wrong answer
        given_quiz = _make_quiz_config()
        given_answers = {1: "A", 2: "C"}

        # WHEN evaluated
        actual_score, actual_total, actual_results = _evaluate_quiz(given_quiz, given_answers)

        # THEN score is 1 out of 2
        assert actual_score == 1
        assert actual_total == 2
        assert actual_results == [True, False]

    def test_missing_answers_counted_as_wrong(self):
        # GIVEN a quiz with only one answer provided (question 2 missing)
        given_quiz = _make_quiz_config()
        given_answers = {1: "A"}

        # WHEN evaluated
        actual_score, actual_total, actual_results = _evaluate_quiz(given_quiz, given_answers)

        # THEN the missing answer is counted as wrong
        assert actual_score == 1
        assert actual_total == 2
        assert actual_results == [True, False]


class TestNormalizeTopic:
    """Tests for the _normalize_topic helper."""

    def test_strips_trailing_question_mark(self):
        # GIVEN a topic name with a trailing question mark
        given_topic = "What is a CV?"

        # WHEN the topic is normalized
        actual_normalized = _normalize_topic(given_topic)

        # THEN the trailing question mark is removed
        expected_normalized = "what is a cv"
        assert actual_normalized == expected_normalized

    def test_strips_multiple_trailing_punctuation(self):
        # GIVEN a topic name with multiple trailing punctuation characters
        given_topic = "Really?!"

        # WHEN the topic is normalized
        actual_normalized = _normalize_topic(given_topic)

        # THEN all trailing punctuation is removed
        expected_normalized = "really"
        assert actual_normalized == expected_normalized

    def test_preserves_internal_punctuation(self):
        # GIVEN a topic name with internal punctuation
        given_topic = "Motivation Statement vs. Cover Letter"

        # WHEN the topic is normalized
        actual_normalized = _normalize_topic(given_topic)

        # THEN internal punctuation is preserved
        expected_normalized = "motivation statement vs. cover letter"
        assert actual_normalized == expected_normalized

    def test_collapses_extra_whitespace_and_strips_ends(self):
        # GIVEN a topic name with leading, trailing, and internal whitespace
        given_topic = "  What  is   a   CV  "

        # WHEN the topic is normalized
        actual_normalized = _normalize_topic(given_topic)

        # THEN whitespace is collapsed and trimmed
        expected_normalized = "what is a cv"
        assert actual_normalized == expected_normalized

    def test_lowercases_mixed_case(self):
        # GIVEN a topic name with mixed casing
        given_topic = "CV Writing Tips"

        # WHEN the topic is normalized
        actual_normalized = _normalize_topic(given_topic)

        # THEN the result is lowercased
        expected_normalized = "cv writing tips"
        assert actual_normalized == expected_normalized

    def test_frontmatter_and_section_header_variants_normalize_to_same_value(self):
        # GIVEN two representations of the same topic — one from frontmatter, one from a section header
        given_frontmatter_topic = "What is a CV"
        given_header_topic = "What is a CV?"

        # WHEN both are normalized
        actual_frontmatter_normalized = _normalize_topic(given_frontmatter_topic)
        actual_header_normalized = _normalize_topic(given_header_topic)

        # THEN they produce the same normalized value
        assert actual_frontmatter_normalized == actual_header_normalized

    def test_empty_string_returns_empty(self):
        # GIVEN an empty topic string
        given_topic = ""

        # WHEN the topic is normalized
        actual_normalized = _normalize_topic(given_topic)

        # THEN an empty string is returned
        assert actual_normalized == ""


class TestMergeTopicStatus:
    """Tests for the _merge_topic_status monotonic-merge helper."""

    def _logger(self):
        import logging
        return logging.getLogger(__name__)

    def test_upgrade_from_not_covered_to_partial(self):
        # GIVEN current status is NOT_COVERED
        given_current = [TopicStatusRecord(topic_id="A", status=TopicStatus.NOT_COVERED, evidence="")]
        # AND proposed is PARTIAL
        given_proposed = [TopicStatusRecord(topic_id="A", status=TopicStatus.PARTIAL, evidence="student mentioned it")]

        # WHEN merged
        actual_merged = _merge_topic_status(
            given_current, given_proposed, logger=self._logger(), conversation_id="c1",
        )

        # THEN the proposed upgrade is applied and its evidence is kept
        assert actual_merged[0].status == TopicStatus.PARTIAL
        assert actual_merged[0].evidence == "student mentioned it"

    def test_upgrade_from_partial_to_covered(self):
        # GIVEN current is PARTIAL
        given_current = [TopicStatusRecord(topic_id="A", status=TopicStatus.PARTIAL, evidence="earlier")]
        # AND proposed is COVERED
        given_proposed = [TopicStatusRecord(topic_id="A", status=TopicStatus.COVERED, evidence="now explained fully")]

        # WHEN merged
        actual_merged = _merge_topic_status(
            given_current, given_proposed, logger=self._logger(), conversation_id="c1",
        )

        # THEN the upgrade applies and the proposed evidence replaces the prior evidence
        assert actual_merged[0].status == TopicStatus.COVERED
        assert actual_merged[0].evidence == "now explained fully"

    def test_downgrade_rejected_and_state_retained(self):
        # GIVEN current is COVERED
        given_current = [TopicStatusRecord(topic_id="A", status=TopicStatus.COVERED, evidence="prior evidence")]
        # AND proposed is NOT_COVERED (an attempted downgrade)
        given_proposed = [TopicStatusRecord(topic_id="A", status=TopicStatus.NOT_COVERED, evidence="")]

        # WHEN merged
        actual_merged = _merge_topic_status(
            given_current, given_proposed, logger=self._logger(), conversation_id="c1",
        )

        # THEN current is retained
        assert actual_merged[0].status == TopicStatus.COVERED
        assert actual_merged[0].evidence == "prior evidence"

    def test_missing_proposed_retains_current(self):
        # GIVEN current has two topics
        given_current = [
            TopicStatusRecord(topic_id="A", status=TopicStatus.COVERED, evidence="ok"),
            TopicStatusRecord(topic_id="B", status=TopicStatus.PARTIAL, evidence="brief"),
        ]
        # AND proposed only mentions topic A
        given_proposed = [TopicStatusRecord(topic_id="A", status=TopicStatus.COVERED, evidence="still ok")]

        # WHEN merged
        actual_merged = _merge_topic_status(
            given_current, given_proposed, logger=self._logger(), conversation_id="c1",
        )

        # THEN both topics are in the result
        assert len(actual_merged) == 2
        by_id = {r.topic_id: r for r in actual_merged}
        # AND topic B retains its partial status
        assert by_id["B"].status == TopicStatus.PARTIAL

    def test_preserves_order_of_current(self):
        # GIVEN a specific order in current
        given_current = [
            TopicStatusRecord(topic_id="A", status=TopicStatus.NOT_COVERED, evidence=""),
            TopicStatusRecord(topic_id="B", status=TopicStatus.NOT_COVERED, evidence=""),
            TopicStatusRecord(topic_id="C", status=TopicStatus.NOT_COVERED, evidence=""),
        ]
        # AND proposed in a different order
        given_proposed = [
            TopicStatusRecord(topic_id="C", status=TopicStatus.COVERED, evidence="c"),
            TopicStatusRecord(topic_id="B", status=TopicStatus.COVERED, evidence="b"),
            TopicStatusRecord(topic_id="A", status=TopicStatus.COVERED, evidence="a"),
        ]

        # WHEN merged
        actual_merged = _merge_topic_status(
            given_current, given_proposed, logger=self._logger(), conversation_id="c1",
        )

        # THEN the output follows current's order
        assert [r.topic_id for r in actual_merged] == ["A", "B", "C"]


class TestSynthesizeTopicStatus:
    """Tests for _synthesize_topic_status (legacy-migration bootstrap)."""

    def test_empty_legacy_produces_all_not_covered(self):
        # GIVEN module topics and no legacy coverage
        given_topics = ["Topic A", "Topic B"]

        # WHEN synthesized
        actual = _synthesize_topic_status(given_topics, [])

        # THEN every record is NOT_COVERED with empty evidence
        assert len(actual) == 2
        for r in actual:
            assert r.status == TopicStatus.NOT_COVERED
            assert r.evidence == ""

    def test_legacy_entries_become_covered_with_migrated_evidence(self):
        # GIVEN module topics and a legacy list naming one
        given_topics = ["Topic A", "Topic B"]
        given_legacy = ["Topic A"]

        # WHEN synthesized
        actual = _synthesize_topic_status(given_topics, given_legacy)

        # THEN Topic A becomes COVERED with migrated evidence; Topic B stays NOT_COVERED
        by_id = {r.topic_id: r for r in actual}
        assert by_id["Topic A"].status == TopicStatus.COVERED
        assert by_id["Topic A"].evidence == "(migrated)"
        assert by_id["Topic B"].status == TopicStatus.NOT_COVERED

    def test_legacy_entries_match_with_case_and_punctuation_tolerance(self):
        # GIVEN module topics with punctuation and a legacy entry without it
        given_topics = ["What is a CV?"]
        given_legacy = ["What is a CV"]

        # WHEN synthesized
        actual = _synthesize_topic_status(given_topics, given_legacy)

        # THEN the legacy entry matches via normalization and becomes COVERED
        assert actual[0].status == TopicStatus.COVERED


# ---------------------------------------------------------------------------
# Tests — Service methods
# ---------------------------------------------------------------------------

class TestBuildConversationContext:
    """Tests for the _build_conversation_context helper."""

    def test_builds_context_from_silence_intro_and_user_agent_pair(self):
        # GIVEN messages with silence+intro pair followed by user+agent pair
        given_messages = [
            _make_message(sender=CareerReadinessMessageSender.USER, message="(silence)"),
            _make_message(sender=CareerReadinessMessageSender.AGENT, message="Welcome!"),
            _make_message(sender=CareerReadinessMessageSender.USER, message="Help me"),
            _make_message(sender=CareerReadinessMessageSender.AGENT, message="Sure!"),
        ]

        # WHEN the context is built
        actual_context = _build_conversation_context(given_messages)

        # THEN there are two conversation turns (silence+intro and user+agent)
        assert len(actual_context.history.turns) == 2
        assert actual_context.history.turns[0].input.message == "(silence)"
        assert actual_context.history.turns[0].output.message_for_user == "Welcome!"
        assert actual_context.history.turns[1].input.message == "Help me"
        assert actual_context.history.turns[1].output.message_for_user == "Sure!"

    def test_builds_context_from_silence_intro_only(self):
        # GIVEN only a silence+intro pair
        given_messages = [
            _make_message(sender=CareerReadinessMessageSender.USER, message="(silence)"),
            _make_message(sender=CareerReadinessMessageSender.AGENT, message="Welcome!"),
        ]

        # WHEN the context is built
        actual_context = _build_conversation_context(given_messages)

        # THEN there is one turn (the intro)
        assert len(actual_context.history.turns) == 1
        assert actual_context.history.turns[0].input.message == "(silence)"
        assert actual_context.history.turns[0].output.message_for_user == "Welcome!"


class TestListModules:
    """Tests for listing modules with status derivation."""

    @pytest.mark.asyncio
    async def test_all_modules_not_started_when_no_conversations(self):
        # GIVEN a service with two modules and no conversations
        given_modules = [
            _make_module_config(module_id="m1", sort_order=1),
            _make_module_config(module_id="m2", title="Module 2", sort_order=2),
        ]
        service, _ = _make_service(modules=given_modules)

        # WHEN modules are listed
        actual_result = await service.list_modules("user_abc")

        # THEN both modules are NOT_STARTED
        assert actual_result.modules[0].status == ModuleStatus.NOT_STARTED
        assert actual_result.modules[1].status == ModuleStatus.NOT_STARTED

    @pytest.mark.asyncio
    async def test_returns_in_progress_when_conversation_exists(self):
        # GIVEN a service with a module and an existing conversation
        given_module = _make_module_config(module_id="cv-development")
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(user_id="user_abc", module_id="cv-development")
        await repo.create(given_conversation)

        # WHEN modules are listed for the user
        actual_result = await service.list_modules("user_abc")

        # THEN the module with a conversation has IN_PROGRESS status
        assert actual_result.modules[0].status == ModuleStatus.IN_PROGRESS



class TestGetModule:
    """Tests for getting module details."""

    @pytest.mark.asyncio
    async def test_returns_module_detail(self):
        # GIVEN a service with a module
        given_module = _make_module_config()
        service, _ = _make_service(modules=[given_module])

        # WHEN the module is retrieved
        actual_result = await service.get_module("user_abc", "cv-development")

        # THEN the module detail is returned with NOT_STARTED status
        assert actual_result.id == "cv-development"
        assert actual_result.status == ModuleStatus.NOT_STARTED

    @pytest.mark.asyncio
    async def test_returns_active_conversation_id(self):
        # GIVEN a service with an existing conversation
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(user_id="user_abc", module_id="cv-development")
        await repo.create(given_conversation)

        # WHEN the module is retrieved
        actual_result = await service.get_module("user_abc", "cv-development")

        # THEN the active conversation ID is included
        assert actual_result.active_conversation_id == given_conversation.conversation_id
        assert actual_result.status == ModuleStatus.IN_PROGRESS

    @pytest.mark.asyncio
    async def test_raises_module_not_found(self):
        # GIVEN a service with no modules
        service, _ = _make_service(modules=[])

        # WHEN a non-existent module is requested
        # THEN CareerReadinessModuleNotFoundError is raised
        with pytest.raises(CareerReadinessModuleNotFoundError):
            await service.get_module("user_abc", "nonexistent")


class TestCreateConversation:
    """Tests for creating a new conversation."""

    @pytest.mark.asyncio
    async def test_creates_conversation_with_intro_message(self):
        # GIVEN a service with a module and a mock agent
        given_module = _make_module_config()
        given_agent = MockCareerReadinessAgent(intro_message="Welcome to CV Development!")
        service, repo = _make_service(modules=[given_module], agent=given_agent)

        # WHEN a conversation is created
        actual_result = await service.create_conversation("user_abc", "cv-development")

        # THEN a conversation response is returned with the intro message (silence filtered out)
        assert actual_result.module_id == "cv-development"
        assert len(actual_result.messages) == 1
        assert actual_result.messages[0].message == "Welcome to CV Development!"
        assert actual_result.conversation_mode == ConversationMode.INSTRUCTION
        # AND the DB stores both the silence and intro messages
        actual_doc = await repo.find_by_conversation_id(actual_result.conversation_id)
        assert actual_doc is not None
        assert len(actual_doc.messages) == 2
        assert actual_doc.messages[0].message == "(silence)"
        assert actual_doc.messages[1].message == "Welcome to CV Development!"

    @pytest.mark.asyncio
    async def test_raises_already_exists_when_duplicate(self):
        # GIVEN a service with an existing conversation
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(user_id="user_abc", module_id="cv-development")
        await repo.create(given_conversation)

        # WHEN a duplicate conversation is attempted
        # THEN ConversationAlreadyExistsError is raised
        with pytest.raises(ConversationAlreadyExistsError):
            await service.create_conversation("user_abc", "cv-development")

    @pytest.mark.asyncio
    async def test_raises_module_not_found(self):
        # GIVEN a service with no modules
        service, _ = _make_service(modules=[])

        # WHEN a conversation is created for a non-existent module
        # THEN CareerReadinessModuleNotFoundError is raised
        with pytest.raises(CareerReadinessModuleNotFoundError):
            await service.create_conversation("user_abc", "nonexistent")


class TestSendMessage:
    """Tests for sending messages with mode dispatch."""

    @pytest.mark.asyncio
    async def test_instruction_mode_normal_response(self):
        # GIVEN a service with a conversation in instruction mode and an agent that marks Topic A covered
        given_module = _make_module_config(topics=["Topic A", "Topic B"])
        given_agent = MockCareerReadinessAgent(
            response_message="Let's discuss Topic A.",
            proposed_topic_status=_full_topic_status(given_module.topics, covered=["Topic A"]),
        )
        service, repo = _make_service(modules=[given_module], agent=given_agent)
        given_conversation = _make_conversation(user_id="user_abc", module_id="cv-development")
        await repo.create(given_conversation)

        # WHEN a message is sent
        actual_result = await service.send_message(
            "user_abc", "cv-development", given_conversation.conversation_id, "Tell me about Topic A",
        )

        # THEN the response includes the user message and agent response
        assert actual_result.messages[-1].message == "Let's discuss Topic A."
        # AND the response's covered_topics (derived from topic_status) includes Topic A
        assert "Topic A" in actual_result.covered_topics
        # AND the conversation's topic_status reflects Topic A covered, Topic B not yet
        actual_conv = await repo.find_by_conversation_id(given_conversation.conversation_id)
        assert actual_conv is not None
        by_id = {r.topic_id: r for r in actual_conv.topic_status}
        assert by_id["Topic A"].status == TopicStatus.COVERED
        assert by_id["Topic B"].status == TopicStatus.NOT_COVERED

    @pytest.mark.asyncio
    async def test_quiz_triggers_when_all_topics_become_covered(self):
        # GIVEN a conversation where Topic A is already covered and the agent now marks Topic B covered too
        given_module = _make_module_config(topics=["Topic A", "Topic B"])
        given_agent = MockCareerReadinessAgent(
            response_message="Great, we've covered everything!",
            proposed_topic_status=_full_topic_status(
                given_module.topics, covered=["Topic A", "Topic B"],
            ),
        )
        service, repo = _make_service(modules=[given_module], agent=given_agent)
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            topic_status=_full_topic_status(given_module.topics, covered=["Topic A"]),
        )
        await repo.create(given_conversation)

        # WHEN a message is sent
        actual_result = await service.send_message(
            "user_abc", "cv-development", given_conversation.conversation_id, "I understand now",
        )

        # THEN quiz_available is True in the response
        assert actual_result.quiz_available is True
        # AND the last message is a marker indicating quiz is ready
        assert "quiz" in actual_result.messages[-1].message.lower()
        # AND quiz_delivered is set on the conversation
        actual_conv = await repo.find_by_conversation_id(given_conversation.conversation_id)
        assert actual_conv is not None
        assert actual_conv.quiz_delivered is True

    @pytest.mark.asyncio
    async def test_quiz_does_not_trigger_when_any_topic_is_partial(self):
        # GIVEN two topics where Topic B is only partial after this turn
        given_module = _make_module_config(topics=["Topic A", "Topic B"])
        given_agent = MockCareerReadinessAgent(
            response_message="Let's keep going.",
            proposed_topic_status=_full_topic_status(
                given_module.topics, covered=["Topic A"], partial=["Topic B"],
            ),
        )
        service, repo = _make_service(modules=[given_module], agent=given_agent)
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            topic_status=_full_topic_status(given_module.topics, covered=["Topic A"]),
        )
        await repo.create(given_conversation)

        # WHEN a message is sent
        actual_result = await service.send_message(
            "user_abc", "cv-development", given_conversation.conversation_id, "I think I get it",
        )

        # THEN the quiz is NOT delivered
        assert actual_result.quiz_available is False
        actual_conv = await repo.find_by_conversation_id(given_conversation.conversation_id)
        assert actual_conv is not None
        assert actual_conv.quiz_delivered is False

    @pytest.mark.asyncio
    async def test_quiz_does_not_trigger_when_any_topic_is_not_covered(self):
        # GIVEN two topics where Topic B is still not_covered after this turn
        given_module = _make_module_config(topics=["Topic A", "Topic B"])
        given_agent = MockCareerReadinessAgent(
            response_message="Let me explain Topic B.",
            proposed_topic_status=_full_topic_status(given_module.topics, covered=["Topic A"]),
        )
        service, repo = _make_service(modules=[given_module], agent=given_agent)
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            topic_status=_full_topic_status(given_module.topics, covered=["Topic A"]),
        )
        await repo.create(given_conversation)

        # WHEN a message is sent
        actual_result = await service.send_message(
            "user_abc", "cv-development", given_conversation.conversation_id, "hmm",
        )

        # THEN the quiz is NOT delivered
        assert actual_result.quiz_available is False

    @pytest.mark.asyncio
    async def test_quizless_module_completes_directly_when_all_topics_become_covered(self):
        # GIVEN a quiz-less module (e.g. entrepreneurship) with one topic still uncovered
        given_module = ModuleConfig(
            id="entrepreneurship",
            title="Entrepreneurship & Enterprise Development",
            description="A quiz-less module.",
            icon="entrepreneurship",
            sort_order=6,
            input_placeholder="Ask about starting a business...",
            content="# Entrepreneurship\nStart a business.",
            topics=["Topic A", "Topic B"],
            quiz=None,
        )
        # AND the agent now marks the final remaining topic covered
        given_agent = MockCareerReadinessAgent(
            response_message="Great, we've covered everything!",
            proposed_topic_status=_full_topic_status(
                given_module.topics, covered=["Topic A", "Topic B"],
            ),
        )
        service, repo = _make_service(modules=[given_module], agent=given_agent)
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="entrepreneurship",
            topic_status=_full_topic_status(given_module.topics, covered=["Topic A"]),
        )
        await repo.create(given_conversation)

        # WHEN a message is sent that covers the remaining topic
        actual_result = await service.send_message(
            "user_abc", "entrepreneurship", given_conversation.conversation_id, "I understand now",
        )

        # THEN the module is reported as completed
        assert actual_result.module_completed is True
        # AND no quiz is offered
        assert actual_result.quiz_available is False
        # AND the conversation transitions to SUPPORT mode for follow-up questions
        assert actual_result.conversation_mode == ConversationMode.SUPPORT
        # AND the closing message is a completion message, not a quiz prompt
        assert "quiz" not in actual_result.messages[-1].message.lower()
        # AND the conversation is persisted as passed in SUPPORT mode, without a quiz ever being delivered
        actual_conv = await repo.find_by_conversation_id(given_conversation.conversation_id)
        assert actual_conv is not None
        assert actual_conv.quiz_passed is True
        assert actual_conv.quiz_delivered is False
        assert actual_conv.conversation_mode == ConversationMode.SUPPORT

    @pytest.mark.asyncio
    async def test_quizless_module_does_not_complete_while_a_topic_is_uncovered(self):
        # GIVEN a quiz-less module where one topic remains uncovered after this turn
        given_module = ModuleConfig(
            id="entrepreneurship",
            title="Entrepreneurship & Enterprise Development",
            description="A quiz-less module.",
            icon="entrepreneurship",
            sort_order=6,
            input_placeholder="Ask about starting a business...",
            content="# Entrepreneurship\nStart a business.",
            topics=["Topic A", "Topic B"],
            quiz=None,
        )
        # AND the agent leaves the remaining topic uncovered after this turn
        given_agent = MockCareerReadinessAgent(
            response_message="Let me explain Topic B.",
            proposed_topic_status=_full_topic_status(given_module.topics, covered=["Topic A"]),
        )
        service, repo = _make_service(modules=[given_module], agent=given_agent)
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="entrepreneurship",
            topic_status=_full_topic_status(given_module.topics, covered=["Topic A"]),
        )
        await repo.create(given_conversation)

        # WHEN a message is sent that does not cover the remaining topic
        actual_result = await service.send_message(
            "user_abc", "entrepreneurship", given_conversation.conversation_id, "hmm",
        )

        # THEN the module is NOT completed and stays in INSTRUCTION mode
        assert actual_result.module_completed is False
        assert actual_result.conversation_mode == ConversationMode.INSTRUCTION
        actual_conv = await repo.find_by_conversation_id(given_conversation.conversation_id)
        assert actual_conv is not None
        assert actual_conv.quiz_passed is False
        assert actual_conv.quiz_delivered is False
        assert actual_conv.conversation_mode == ConversationMode.INSTRUCTION

    @pytest.mark.asyncio
    async def test_agent_downgrade_attempt_is_rejected_and_state_retained(self):
        # GIVEN a conversation where Topic A is already covered on the server side
        given_module = _make_module_config(topics=["Topic A", "Topic B"])
        # AND the agent attempts to downgrade Topic A back to not_covered
        given_agent = MockCareerReadinessAgent(
            response_message="Let's revisit.",
            proposed_topic_status=_full_topic_status(given_module.topics),  # all not_covered
        )
        service, repo = _make_service(modules=[given_module], agent=given_agent)
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            topic_status=_full_topic_status(given_module.topics, covered=["Topic A"]),
        )
        await repo.create(given_conversation)

        # WHEN a message is sent
        await service.send_message(
            "user_abc", "cv-development", given_conversation.conversation_id, "go back",
        )

        # THEN Topic A remains covered in the stored topic_status
        actual_conv = await repo.find_by_conversation_id(given_conversation.conversation_id)
        assert actual_conv is not None
        by_id = {r.topic_id: r for r in actual_conv.topic_status}
        assert by_id["Topic A"].status == TopicStatus.COVERED

    @pytest.mark.asyncio
    async def test_inflight_conversation_with_legacy_covered_topics_is_migrated_on_read(self):
        # GIVEN a legacy conversation that has covered_topics but no topic_status
        given_module = _make_module_config(topics=["Topic A", "Topic B"])
        given_agent = MockCareerReadinessAgent(
            response_message="Next up, Topic B.",
            proposed_topic_status=_full_topic_status(given_module.topics, covered=["Topic A"]),
        )
        service, repo = _make_service(modules=[given_module], agent=given_agent)
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            covered_topics=["Topic A"],
            topic_status=[],  # simulating legacy pre-migration shape
        )
        await repo.create(given_conversation)

        # WHEN a message is sent
        await service.send_message(
            "user_abc", "cv-development", given_conversation.conversation_id, "ok",
        )

        # THEN the agent received a fully migrated current_topic_status (Topic A covered)
        assert given_agent.last_current_topic_status is not None
        by_id_received = {r.topic_id: r for r in given_agent.last_current_topic_status}
        assert by_id_received["Topic A"].status == TopicStatus.COVERED
        assert by_id_received["Topic A"].evidence == "(migrated)"
        assert by_id_received["Topic B"].status == TopicStatus.NOT_COVERED
        # AND the DB now has the per-topic-status representation
        actual_conv = await repo.find_by_conversation_id(given_conversation.conversation_id)
        assert actual_conv is not None
        assert len(actual_conv.topic_status) == 2

    @pytest.mark.asyncio
    async def test_chat_during_active_quiz_sets_quiz_available(self):
        # GIVEN a conversation with quiz delivered but not passed
        given_module = _make_module_config()
        given_agent = MockCareerReadinessAgent(response_message="Let me help you with that.")
        service, repo = _make_service(modules=[given_module], agent=given_agent)
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            quiz_delivered=True,
        )
        await repo.create(given_conversation)

        # WHEN the user sends a chat message while quiz is active
        actual_result = await service.send_message(
            "user_abc", "cv-development", given_conversation.conversation_id, "Can you explain more?",
        )

        # THEN the response includes quiz_available=True
        assert actual_result.quiz_available is True
        # AND the agent still responds normally
        assert actual_result.messages[-1].message == "Let me help you with that."

    @pytest.mark.asyncio
    async def test_support_mode_message(self):
        # GIVEN a completed conversation in support mode
        given_module = _make_module_config()
        given_agent = MockCareerReadinessAgent(response_message="Here's more info on that topic.")
        service, repo = _make_service(modules=[given_module], agent=given_agent)
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            conversation_mode=ConversationMode.SUPPORT,
            quiz_passed=True,
        )
        await repo.create(given_conversation)

        # WHEN a message is sent in support mode
        actual_result = await service.send_message(
            "user_abc", "cv-development", given_conversation.conversation_id, "Can you explain more?",
        )

        # THEN the agent responds normally
        assert actual_result.messages[-1].message == "Here's more info on that topic."
        assert actual_result.conversation_mode == ConversationMode.SUPPORT
        assert actual_result.quiz_passed is True

    @pytest.mark.asyncio
    async def test_raises_conversation_not_found(self):
        # GIVEN a service with a module but no conversation
        given_module = _make_module_config()
        service, _ = _make_service(modules=[given_module])

        # WHEN a message is sent to a non-existent conversation
        # THEN ConversationNotFoundError is raised
        with pytest.raises(ConversationNotFoundError):
            await service.send_message("user_abc", "cv-development", "nonexistent", "Hello")

    @pytest.mark.asyncio
    async def test_raises_access_denied_for_wrong_user(self):
        # GIVEN a conversation owned by user_abc
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(user_id="user_abc", module_id="cv-development")
        await repo.create(given_conversation)

        # WHEN a different user tries to send a message
        # THEN ConversationAccessDeniedError is raised
        with pytest.raises(ConversationAccessDeniedError):
            await service.send_message(
                "other_user", "cv-development", given_conversation.conversation_id, "Hello",
            )


class TestGetConversationHistory:
    """Tests for retrieving conversation history."""

    @pytest.mark.asyncio
    async def test_returns_conversation_history(self):
        # GIVEN a conversation with messages
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_messages = [
            _make_message(sender=CareerReadinessMessageSender.AGENT, message="Welcome!"),
            _make_message(sender=CareerReadinessMessageSender.USER, message="Hello!"),
        ]
        given_conversation = _make_conversation(user_id="user_abc", module_id="cv-development", messages=given_messages)
        await repo.create(given_conversation)

        # WHEN the history is requested
        actual_result = await service.get_conversation_history(
            "user_abc", "cv-development", given_conversation.conversation_id,
        )

        # THEN all messages are returned
        assert len(actual_result.messages) == 2
        assert actual_result.conversation_id == given_conversation.conversation_id

    @pytest.mark.asyncio
    async def test_raises_conversation_not_found(self):
        # GIVEN a service with no conversations
        given_module = _make_module_config()
        service, _ = _make_service(modules=[given_module])

        # WHEN a non-existent conversation is requested
        # THEN ConversationNotFoundError is raised
        with pytest.raises(ConversationNotFoundError):
            await service.get_conversation_history("user_abc", "cv-development", "nonexistent")

    @pytest.mark.asyncio
    async def test_returns_quiz_passed_false_when_quiz_delivered_but_not_passed(self):
        # GIVEN a conversation where the quiz was delivered but not yet passed
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            quiz_delivered=True, quiz_passed=False,
        )
        await repo.create(given_conversation)

        # WHEN the history is requested
        actual_result = await service.get_conversation_history(
            "user_abc", "cv-development", given_conversation.conversation_id,
        )

        # THEN quiz_passed is False (not None)
        assert actual_result.quiz_passed is False
        # AND quiz_available is True
        assert actual_result.quiz_available is True

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "quiz_delivered, quiz_passed, expected_quiz_available",
        [
            (True, False, True),
            (False, False, False),
            (True, True, False),
        ],
        ids=["delivered-not-passed", "not-delivered", "already-passed"],
    )
    async def test_quiz_available_reflects_quiz_state(self, quiz_delivered, quiz_passed, expected_quiz_available):
        # GIVEN a conversation with given quiz state
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            quiz_delivered=quiz_delivered, quiz_passed=quiz_passed,
        )
        await repo.create(given_conversation)

        # WHEN the history is requested
        actual_result = await service.get_conversation_history(
            "user_abc", "cv-development", given_conversation.conversation_id,
        )

        # THEN quiz_available matches the expected value
        assert actual_result.quiz_available is expected_quiz_available

    @pytest.mark.asyncio
    async def test_raises_access_denied_for_wrong_user(self):
        # GIVEN a conversation owned by user_abc
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(user_id="user_abc", module_id="cv-development")
        await repo.create(given_conversation)

        # WHEN a different user requests the history
        # THEN ConversationAccessDeniedError is raised
        with pytest.raises(ConversationAccessDeniedError):
            await service.get_conversation_history(
                "other_user", "cv-development", given_conversation.conversation_id,
            )


class TestDeleteConversation:
    """Tests for deleting a conversation."""

    @pytest.mark.asyncio
    async def test_deletes_conversation(self):
        # GIVEN a conversation
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(user_id="user_abc", module_id="cv-development")
        await repo.create(given_conversation)

        # WHEN the conversation is deleted
        await service.delete_conversation("user_abc", "cv-development", given_conversation.conversation_id)

        # THEN the conversation no longer exists
        actual_result = await repo.find_by_conversation_id(given_conversation.conversation_id)
        assert actual_result is None

    @pytest.mark.asyncio
    async def test_raises_conversation_not_found(self):
        # GIVEN a service with no conversations
        given_module = _make_module_config()
        service, _ = _make_service(modules=[given_module])

        # WHEN a non-existent conversation is deleted
        # THEN ConversationNotFoundError is raised
        with pytest.raises(ConversationNotFoundError):
            await service.delete_conversation("user_abc", "cv-development", "nonexistent")

    @pytest.mark.asyncio
    async def test_raises_access_denied_for_wrong_user(self):
        # GIVEN a conversation owned by user_abc
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(user_id="user_abc", module_id="cv-development")
        await repo.create(given_conversation)

        # WHEN a different user tries to delete
        # THEN ConversationAccessDeniedError is raised
        with pytest.raises(ConversationAccessDeniedError):
            await service.delete_conversation(
                "other_user", "cv-development", given_conversation.conversation_id,
            )


class TestGetQuiz:
    """Tests for retrieving quiz questions."""

    @pytest.mark.asyncio
    async def test_returns_questions_without_correct_answers(self):
        # GIVEN a conversation with quiz delivered
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            quiz_delivered=True,
        )
        await repo.create(given_conversation)

        # WHEN the quiz is requested
        actual_result = await service.get_quiz(
            "user_abc", "cv-development", given_conversation.conversation_id,
        )

        # THEN questions are returned with options
        assert len(actual_result.questions) == 2
        assert actual_result.questions[0].question == "Q1?"
        assert actual_result.questions[0].options == ["A. Opt1", "B. Opt2", "C. Opt3", "D. Opt4"]
        # AND no correct_answer field is exposed
        assert not hasattr(actual_result.questions[0], "correct_answer")

    @pytest.mark.asyncio
    async def test_raises_not_available_when_quiz_not_delivered(self):
        # GIVEN a conversation where the quiz has not been delivered
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            quiz_delivered=False, quiz_passed=False,
        )
        await repo.create(given_conversation)

        # WHEN the quiz is requested
        # THEN QuizNotAvailableError is raised
        with pytest.raises(QuizNotAvailableError):
            await service.get_quiz(
                "user_abc", "cv-development", given_conversation.conversation_id,
            )

    @pytest.mark.asyncio
    async def test_raises_already_passed_when_quiz_completed(self):
        # GIVEN a conversation where the quiz was already passed
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            quiz_delivered=True, quiz_passed=True,
        )
        await repo.create(given_conversation)

        # WHEN the quiz is requested
        # THEN QuizAlreadyPassedError is raised
        with pytest.raises(QuizAlreadyPassedError):
            await service.get_quiz(
                "user_abc", "cv-development", given_conversation.conversation_id,
            )


class TestSubmitQuiz:
    """Tests for submitting quiz answers."""

    @pytest.mark.asyncio
    async def test_pass_transitions_to_support(self):
        # GIVEN a conversation with quiz delivered (2 questions, threshold 0.5)
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            quiz_delivered=True,
        )
        await repo.create(given_conversation)

        # WHEN correct answers are submitted
        actual_result = await service.submit_quiz(
            "user_abc", "cv-development", given_conversation.conversation_id, {1: "A", 2: "B"},
        )

        # THEN the quiz is passed
        assert actual_result.passed is True
        assert actual_result.score == 2
        assert actual_result.total == 2
        assert actual_result.module_completed is True
        assert actual_result.conversation_mode == ConversationMode.SUPPORT
        # AND per-question results are correct
        assert all(r.is_correct for r in actual_result.question_results)
        # AND the conversation state is updated
        actual_conv = await repo.find_by_conversation_id(given_conversation.conversation_id)
        assert actual_conv is not None
        assert actual_conv.quiz_passed is True
        assert actual_conv.conversation_mode == ConversationMode.SUPPORT

    @pytest.mark.asyncio
    async def test_fail_keeps_quiz_available_for_retry(self):
        # GIVEN a conversation with quiz delivered (2 questions, threshold 0.5)
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            quiz_delivered=True,
        )
        await repo.create(given_conversation)

        # WHEN all wrong answers are submitted
        actual_result = await service.submit_quiz(
            "user_abc", "cv-development", given_conversation.conversation_id, {1: "C", 2: "C"},
        )

        # THEN the quiz is not passed
        assert actual_result.passed is False
        assert actual_result.score == 0
        assert actual_result.module_completed is False
        assert actual_result.conversation_mode == ConversationMode.INSTRUCTION
        # AND quiz_delivered stays active for retry
        actual_conv = await repo.find_by_conversation_id(given_conversation.conversation_id)
        assert actual_conv is not None
        assert actual_conv.quiz_delivered is True

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "quiz_delivered, quiz_passed, expected_error",
        [
            (False, False, QuizNotAvailableError),
            (True, True, QuizAlreadyPassedError),
        ],
        ids=["not-delivered", "already-passed"],
    )
    async def test_raises_not_available_when_quiz_not_active(self, quiz_delivered, quiz_passed, expected_error):
        # GIVEN a conversation where the quiz is not active
        given_module = _make_module_config()
        service, repo = _make_service(modules=[given_module])
        given_conversation = _make_conversation(
            user_id="user_abc", module_id="cv-development",
            quiz_delivered=quiz_delivered, quiz_passed=quiz_passed,
        )
        await repo.create(given_conversation)

        # WHEN answers are submitted
        # THEN the expected error is raised
        with pytest.raises(expected_error):
            await service.submit_quiz(
                "user_abc", "cv-development", given_conversation.conversation_id, {1: "A", 2: "B"},
            )
