"""
Tests for module, sub module and session attribution of LLM traces (CC-1 acceptance criteria 2, 3 and 4).

Each service entry point is exercised through its real traced wrapper, with only the work it
delegates to stubbed out, so these tests assert on the grouping the Langfuse UI would show.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.conversations.service import ConversationService
from app.observability.module_types import TraceModule, TraceSubModule, sub_module_label
from app.users.cv.utils.llm_extractor import CVExperienceExtractor
from common_libs.observability.testing import in_memory_tracing


def _a_conversation_service(phase: ConversationPhase = ConversationPhase.COUNSELING) -> ConversationService:
    """A ConversationService whose only live code is the traced `send` wrapper."""
    service = ConversationService.__new__(ConversationService)

    state = MagicMock()
    state.agent_director_state.current_phase = phase
    service._application_state_metrics_recorder = MagicMock()  # pylint: disable=protected-access
    service._application_state_metrics_recorder.get_state = AsyncMock(return_value=state)  # pylint: disable=protected-access

    response = MagicMock()
    response.messages = []
    service._send = AsyncMock(return_value=response)  # pylint: disable=protected-access

    return service


def _a_cv_extractor() -> CVExperienceExtractor:
    """A CVExperienceExtractor whose only live code is the traced `extract_experiences` wrapper."""
    extractor = CVExperienceExtractor.__new__(CVExperienceExtractor)
    extractor._extract_experiences = AsyncMock(return_value=["sold vegetables at the market"])  # pylint: disable=protected-access
    return extractor


class TestModuleAttribution:
    """
    Tests for module attribution.
    """

    @pytest.mark.asyncio
    async def test_attributes_a_conversation_turn_to_build_your_profile(self):
        """Attributes a conversation turn to build your profile."""
        # GIVEN a Build Your Profile conversation turn
        given_service = _a_conversation_service()

        # WHEN the turn is handled
        with in_memory_tracing() as recorded_spans:
            await given_service.send("user-1", 42, "hello", clear_memory=False, filter_pii=False)

        # THEN expect exactly one module to be reported
        assert recorded_spans.trace_modules() == {TraceModule.BUILD_YOUR_PROFILE.value}
        # AND expect the root trace to be tagged with it
        actual_span = recorded_spans.by_name("conversation.turn")
        assert f"module:{TraceModule.BUILD_YOUR_PROFILE.value}" in actual_span.attributes["langfuse.trace.tags"]

    @pytest.mark.asyncio
    async def test_attributes_a_cv_upload_to_cv_upload(self):
        """Attributes a cv upload to cv upload."""
        # GIVEN a CV to extract experiences from
        given_extractor = _a_cv_extractor()

        # WHEN the extraction runs
        with in_memory_tracing() as recorded_spans:
            await given_extractor.extract_experiences("# My CV")

        # THEN expect the cv upload module to be reported
        assert recorded_spans.trace_modules() == {TraceModule.CV_UPLOAD.value}


class TestSubModuleAttribution:
    """
    Tests for sub module attribution.
    """

    @pytest.mark.asyncio
    async def test_reports_the_counseling_phase_as_the_explore_experiences_sub_module(self):
        """Reports the counseling phase as the explore experiences sub module."""
        # GIVEN a Build Your Profile turn in the counseling phase
        given_service = _a_conversation_service(ConversationPhase.COUNSELING)

        # WHEN the turn is handled
        with in_memory_tracing() as recorded_spans:
            await given_service.send("user-1", 42, "hello", clear_memory=False, filter_pii=False)

        # THEN expect the phase to be reported as the explore experiences sub module
        assert recorded_spans.trace_sub_modules() == {TraceSubModule.EXPLORE_EXPERIENCES.value}

    @pytest.mark.asyncio
    async def test_reports_sub_modules_without_underscores(self):
        """Reports sub modules without underscores."""
        # GIVEN a Build Your Profile turn in a phase that is not mapped to a sub module
        given_service = _a_conversation_service(ConversationPhase.CHECKOUT)

        # WHEN the turn is handled
        with in_memory_tracing() as recorded_spans:
            await given_service.send("user-1", 42, "hello", clear_memory=False, filter_pii=False)

        # THEN expect the sub module to be reported as a human readable label with no underscores
        assert recorded_spans.trace_sub_modules() == {"Checkout"}

    @pytest.mark.asyncio
    async def test_reports_no_sub_module_for_a_module_that_has_none(self):
        """Reports no sub module for a module that has none."""
        # GIVEN a CV upload, which is a single module-level unit of work with no sub module
        given_extractor = _a_cv_extractor()

        # WHEN the extraction runs
        with in_memory_tracing() as recorded_spans:
            await given_extractor.extract_experiences("# My CV")

        # THEN expect no sub module to be reported, rather than an empty one
        assert recorded_spans.trace_sub_modules() == set()


class TestSessionAttribution:
    """
    Tests for session attribution.
    """

    @pytest.mark.asyncio
    async def test_groups_build_your_profile_turns_by_conversation_session(self):
        """Groups build your profile turns by conversation session."""
        # GIVEN two turns of the same Build Your Profile conversation
        given_service = _a_conversation_service()
        given_session_id = 42

        # WHEN both turns are handled
        with in_memory_tracing() as recorded_spans:
            await given_service.send("user-1", given_session_id, "hello", clear_memory=False, filter_pii=False)
            await given_service.send("user-1", given_session_id, "and then?", clear_memory=False, filter_pii=False)

        # THEN expect the conversation session id to be the session, as a string
        assert recorded_spans.session_ids() == {str(given_session_id)}

    @pytest.mark.asyncio
    async def test_keeps_the_sessions_of_two_users_apart(self):
        """Keeps the sessions of two users apart."""
        # GIVEN two users with different conversation sessions
        given_service = _a_conversation_service()

        # WHEN a turn of each is handled
        with in_memory_tracing() as recorded_spans:
            await given_service.send("user-1", 1, "hello", clear_memory=False, filter_pii=False)
            await given_service.send("user-2", 2, "hello", clear_memory=False, filter_pii=False)

        # THEN expect one session per user
        assert recorded_spans.session_ids() == {"1", "2"}


class TestUserAttribution:
    """
    Tests for user attribution. Only the Build your Profile routes set the observability context
    variables, so every other module has to pass the user to `start_trace` itself.
    """

    @pytest.mark.asyncio
    async def test_attributes_a_build_your_profile_turn_to_its_user(self):
        """Attributes a build your profile turn to its user."""
        # GIVEN a Build Your Profile turn
        given_service = _a_conversation_service()
        given_user_id = "user-1"

        # WHEN the turn is handled
        with in_memory_tracing() as recorded_spans:
            await given_service.send(given_user_id, 42, "hello", clear_memory=False, filter_pii=False)

        # THEN expect the trace to be attributed to the user
        assert recorded_spans.user_ids() == {given_user_id}

    @pytest.mark.asyncio
    async def test_attributes_a_cv_extraction_to_its_user(self):
        """Attributes a cv extraction to its user."""
        # GIVEN a CV extraction, which runs in a background task carrying no request context
        given_extractor = _a_cv_extractor()
        given_user_id = "user-1"

        # WHEN the extraction runs
        with in_memory_tracing() as recorded_spans:
            await given_extractor.extract_experiences("# My CV", user_id=given_user_id)

        # THEN expect the trace to be attributed to the user, even though it has no session
        assert recorded_spans.user_ids() == {given_user_id}
        assert recorded_spans.session_ids() == set()


class TestSubModuleLabel:
    """
    Tests for sub module label.
    """

    @pytest.mark.parametrize("given_identifier,expected_label", [
        ("cv-development", "CV Development"),
        ("cv_development", "CV Development"),
        ("interview-preparation", "Interview Preparation"),
        ("entrepreneurship", "Entrepreneurship"),
        ("PREFERENCE_ELICITATION", "Preference Elicitation"),
    ])
    def test_humanises_an_identifier(self, given_identifier: str, expected_label: str):
        """Humanises an identifier."""
        # GIVEN an identifier, as a registry slug or as an enum name
        # WHEN it is turned into a sub module label
        actual_label = sub_module_label(given_identifier)

        # THEN expect a human readable label with no underscores or dashes
        assert actual_label == expected_label
        assert "_" not in actual_label
        assert "-" not in actual_label


class TestOnlyDeployedModulesProduceTraces:
    """
    Tests for only deployed modules produce traces.
    """

    @pytest.mark.asyncio
    async def test_a_compass_core_only_deployment_reports_only_build_your_profile(self):
        """A compass core only deployment reports only build your profile."""
        # GIVEN a deployment where only the Compass core (BYP chat) is exercised
        given_service = _a_conversation_service()

        # WHEN several conversation turns are handled and nothing else is
        with in_memory_tracing() as recorded_spans:
            for turn in range(3):
                await given_service.send("user-1", 42, f"turn {turn}", clear_memory=False, filter_pii=False)

        # THEN expect no module other than Build Your Profile to appear.
        assert recorded_spans.trace_modules() == {TraceModule.BUILD_YOUR_PROFILE.value}
        # AND expect no other modules' root traces to exist
        assert "cv.extract_experiences" not in recorded_spans.names()
