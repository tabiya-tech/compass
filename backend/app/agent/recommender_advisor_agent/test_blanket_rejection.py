"""
Tests for the blanket rejection fix in the recommender advisor agent.

Covers:
1. Code guard — finished=True is stripped from any non-COMPLETE phase
2. _handle_blanket_rejection — re-calls engine, filters seen UUIDs, transitions correctly
3. reject intent routing — concerns handler routes to _handle_blanket_rejection on 'reject' intent
"""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from app.agent.recommender_advisor_agent.agent import RecommenderAdvisorAgent
from app.agent.recommender_advisor_agent.state import RecommenderAdvisorAgentState
from app.agent.recommender_advisor_agent.types import (
    ConversationPhase,
    Node2VecRecommendations,
    OccupationRecommendation,
    ScoreBreakdown,
    SkillComponent,
)
from app.agent.recommender_advisor_agent.phase_handlers.concerns_handler import ConcernsPhaseHandler
from app.agent.recommender_advisor_agent.llm_response_models import (
    ConversationResponse,
    UserIntentClassification,
)
from app.agent.agent_types import AgentInput
from app.conversation_memory.conversation_memory_manager import ConversationContext
from app.countries import Country


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_occupation(uuid: str, name: str) -> OccupationRecommendation:
    return OccupationRecommendation(
        uuid=uuid,
        originUuid=f"{uuid}_origin",
        rank=1,
        occupation_id=f"OCC_{uuid}",
        occupation_code="1234",
        occupation=name,
        final_score=0.75,
        score_breakdown=ScoreBreakdown(
            total_skill_utility=0.70,
            skill_components=SkillComponent(loc=0.75, ess=0.68, opt=0.70, grp=0.72),
            skill_penalty_applied=0.0,
            preference_score=0.75,
            demand_score=0.70,
            demand_label="Moderate Demand",
        ),
    )


def _make_recommendations(uuids: list) -> Node2VecRecommendations:
    return Node2VecRecommendations(
        youth_id="test_user",
        generated_at="2026-01-01T00:00:00Z",
        recommended_by=["Algorithm"],
        occupation_recommendations=[_make_occupation(u, f"Job {u}") for u in uuids],
        opportunity_recommendations=[],
        skillstraining_recommendations=[],
    )


def _make_state(
    presented_uuids: list = None,
    phase: ConversationPhase = ConversationPhase.ADDRESS_CONCERNS,
) -> RecommenderAdvisorAgentState:
    state = RecommenderAdvisorAgentState(
        session_id=1,
        youth_id="test_user",
        country_of_user=Country.KENYA,
        discuss_recommendations=True,
        conversation_phase=phase,
        recommendations=_make_recommendations(presented_uuids or ["uuid_a", "uuid_b"]),
    )
    if presented_uuids:
        state.presented_occupations = list(presented_uuids)
    return state


def _make_concerns_handler(recommendation_interface=None) -> ConcernsPhaseHandler:
    return ConcernsPhaseHandler(
        conversation_llm=MagicMock(),
        conversation_caller=MagicMock(),
        resistance_caller=MagicMock(),
        recommendation_interface=recommendation_interface,
    )


@pytest.fixture
def mock_context():
    return MagicMock(spec=ConversationContext)


# ---------------------------------------------------------------------------
# Code guard: finished=True must only propagate from COMPLETE
# ---------------------------------------------------------------------------

class TestFinishedGuard:
    """
    agent.execute() must strip finished=True from any handler response unless
    state.conversation_phase is COMPLETE when the handler returns.
    """

    @pytest.fixture
    def agent(self):
        with patch("app.agent.recommender_advisor_agent.agent.GeminiGenerativeLLM"):
            return RecommenderAdvisorAgent(
                db6_client=MagicMock(),
                node2vec_client=MagicMock(),
                occupation_search_service=MagicMock(),
            )

    @pytest.mark.asyncio
    async def test_blocks_finished_true_from_address_concerns(self, agent, mock_context):
        # GIVEN agent is in ADDRESS_CONCERNS and the LLM incorrectly sets finished=True
        state = _make_state(phase=ConversationPhase.ADDRESS_CONCERNS)
        agent.set_state(state)
        agent._concerns_handler.handle = AsyncMock(return_value=(
            ConversationResponse(message="Goodbye!", finished=True, reasoning="LLM set finished=True"),
            []
        ))

        # WHEN execute is called
        output = await agent.execute(
            AgentInput(message="I don't like any of them", is_artificial=False),
            mock_context,
        )

        # THEN finished is blocked — conversation must not end
        assert output.finished is False

    @pytest.mark.asyncio
    async def test_blocks_finished_true_from_action_planning(self, agent, mock_context):
        # GIVEN agent is in ACTION_PLANNING and the LLM sets finished=True prematurely
        state = _make_state(phase=ConversationPhase.ACTION_PLANNING)
        agent.set_state(state)
        agent._action_handler.handle = AsyncMock(return_value=(
            ConversationResponse(message="All the best!", finished=True, reasoning="LLM bug"),
            []
        ))

        output = await agent.execute(
            AgentInput(message="No I want to keep talking", is_artificial=False),
            mock_context,
        )

        assert output.finished is False

    @pytest.mark.asyncio
    async def test_allows_finished_true_from_complete_phase(self, agent, mock_context):
        # GIVEN agent is in COMPLETE (wrapup handler already ran, set phase to COMPLETE)
        state = _make_state(phase=ConversationPhase.COMPLETE)
        agent.set_state(state)
        agent._wrapup_handler.handle_complete = AsyncMock(return_value=(
            ConversationResponse(message="Take care!", finished=True, reasoning="Session complete"),
            []
        ))

        output = await agent.execute(
            AgentInput(message="bye", is_artificial=False),
            mock_context,
        )

        # THEN finished propagates — legitimate termination allowed
        assert output.finished is True


# ---------------------------------------------------------------------------
# _handle_blanket_rejection behaviour
# ---------------------------------------------------------------------------

class TestHandleBlanketRejection:
    """
    _handle_blanket_rejection must:
    - re-call the matching engine
    - filter out already-presented occupation UUIDs
    - transition to PRESENT_RECOMMENDATIONS when new occupations exist
    - stay in ADDRESS_CONCERNS with a graceful message when no new occupations exist
    - always return finished=False
    """

    @pytest.mark.asyncio
    async def test_with_new_occupations_transitions_to_present(self, mock_context):
        # GIVEN state has already presented uuid_a and uuid_b
        state = _make_state(presented_uuids=["uuid_a", "uuid_b"])

        # AND the engine returns a fresh occupation (uuid_c) alongside the seen ones
        mock_rec_interface = MagicMock()
        mock_rec_interface.generate_recommendations = AsyncMock(
            return_value=_make_recommendations(["uuid_a", "uuid_b", "uuid_c"])
        )
        handler = _make_concerns_handler(recommendation_interface=mock_rec_interface)

        # WHEN _handle_blanket_rejection is called
        response, _ = await handler._handle_blanket_rejection(state)

        # THEN phase transitions to PRESENT_RECOMMENDATIONS
        assert state.conversation_phase == ConversationPhase.PRESENT_RECOMMENDATIONS
        # AND only uuid_c survives the filter
        remaining = state.recommendations.occupation_recommendations
        assert len(remaining) == 1
        assert remaining[0].uuid == "uuid_c"
        # AND finished is False
        assert response.finished is False

    @pytest.mark.asyncio
    async def test_with_no_new_occupations_stays_open(self, mock_context):
        # GIVEN state has already presented uuid_a and uuid_b
        state = _make_state(presented_uuids=["uuid_a", "uuid_b"])
        original_phase = state.conversation_phase

        # AND the engine returns only already-seen occupations
        mock_rec_interface = MagicMock()
        mock_rec_interface.generate_recommendations = AsyncMock(
            return_value=_make_recommendations(["uuid_a", "uuid_b"])
        )
        handler = _make_concerns_handler(recommendation_interface=mock_rec_interface)

        # WHEN _handle_blanket_rejection is called
        response, _ = await handler._handle_blanket_rejection(state)

        # THEN phase does NOT change
        assert state.conversation_phase == original_phase
        # AND response tells user to check back (not a crash or empty message)
        assert response.message
        assert "check back" in response.message.lower() or "refreshes" in response.message.lower()
        # AND conversation stays open
        assert response.finished is False

    @pytest.mark.asyncio
    async def test_finished_is_false_on_both_paths(self, mock_context):
        # Both "new occs found" and "no new occs" must never terminate the session
        for returned_uuids in [["uuid_a", "uuid_b", "uuid_c"], ["uuid_a", "uuid_b"]]:
            state = _make_state(presented_uuids=["uuid_a", "uuid_b"])
            mock_rec_interface = MagicMock()
            mock_rec_interface.generate_recommendations = AsyncMock(
                return_value=_make_recommendations(returned_uuids)
            )
            handler = _make_concerns_handler(recommendation_interface=mock_rec_interface)

            response, _ = await handler._handle_blanket_rejection(state)

            assert response.finished is False, (
                f"finished=True on path where engine returned {returned_uuids}"
            )

    @pytest.mark.asyncio
    async def test_engine_called_with_state_params(self, mock_context):
        # GIVEN state with specific params
        state = _make_state(presented_uuids=["uuid_a"])
        state.city = "Mombasa"
        state.province = "Coast"

        mock_rec_interface = MagicMock()
        mock_rec_interface.generate_recommendations = AsyncMock(
            return_value=_make_recommendations(["uuid_b"])
        )
        handler = _make_concerns_handler(recommendation_interface=mock_rec_interface)

        await handler._handle_blanket_rejection(state)

        # THEN engine is called with the state's identity params
        mock_rec_interface.generate_recommendations.assert_called_once_with(
            youth_id=state.youth_id,
            city=state.city,
            province=state.province,
            preference_vector=state.preference_vector,
            skills_vector=state.skills_vector,
            bws_scores=state.bws_scores,
            top_10_bws=state.top_10_bws,
        )


# ---------------------------------------------------------------------------
# reject intent routing through handler.handle()
# ---------------------------------------------------------------------------

class TestRejectIntentRouting:
    """
    When the intent classifier returns 'reject', concerns_handler.handle()
    must route to _handle_blanket_rejection and never hit the resistance classifier.
    """

    @pytest.mark.asyncio
    async def test_reject_intent_triggers_engine_re_call(self, mock_context):
        # GIVEN the intent classifier returns 'reject'
        state = _make_state(presented_uuids=["uuid_a"])

        mock_rec_interface = MagicMock()
        mock_rec_interface.generate_recommendations = AsyncMock(
            return_value=_make_recommendations(["uuid_a"])  # no new occs — graceful path
        )
        handler = _make_concerns_handler(recommendation_interface=mock_rec_interface)

        reject_intent = UserIntentClassification(
            reasoning="User dismissed all recommendations",
            intent="reject",
            target_recommendation_id=None,
            target_occupation_index=None,
            requested_occupation_name=None,
        )
        handler._intent_classifier = MagicMock()
        handler._intent_classifier.classify_intent = AsyncMock(return_value=(reject_intent, []))

        # WHEN handle() is called with a blanket rejection
        response, _ = await handler.handle("I don't like any of them", state, mock_context)

        # THEN recommendation_interface was called (reject path taken, not resistance classifier)
        mock_rec_interface.generate_recommendations.assert_called_once()
        assert response.finished is False

    @pytest.mark.asyncio
    async def test_reject_intent_does_not_call_resistance_classifier(self, mock_context):
        # GIVEN the intent classifier returns 'reject'
        state = _make_state(presented_uuids=["uuid_a"])

        mock_rec_interface = MagicMock()
        mock_rec_interface.generate_recommendations = AsyncMock(
            return_value=_make_recommendations(["uuid_b"])
        )
        handler = _make_concerns_handler(recommendation_interface=mock_rec_interface)

        reject_intent = UserIntentClassification(
            reasoning="Blanket rejection",
            intent="reject",
            target_recommendation_id=None,
            target_occupation_index=None,
            requested_occupation_name=None,
        )
        handler._intent_classifier = MagicMock()
        handler._intent_classifier.classify_intent = AsyncMock(return_value=(reject_intent, []))

        # Spy on the resistance caller to confirm it is never invoked
        handler._resistance_caller.call_llm = AsyncMock()

        await handler.handle("None of these work for me", state, mock_context)

        # THEN resistance classifier was NOT called (wrong path would call it)
        handler._resistance_caller.call_llm.assert_not_called()
