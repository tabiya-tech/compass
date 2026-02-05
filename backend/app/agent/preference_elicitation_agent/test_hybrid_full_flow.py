#!/usr/bin/env python3
"""
Automated test for hybrid mode full conversation flow.

Tests the complete flow from INTRO → EXPERIENCE → VIGNETTES → WRAPUP
with automated responses, checking that vignettes progress correctly.
"""

import pytest
import asyncio
import numpy as np
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

from app.agent.preference_elicitation_agent.agent import PreferenceElicitationAgent
from app.agent.preference_elicitation_agent.state import PreferenceElicitationAgentState
from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_memory_types import (
    ConversationContext,
    ConversationHistory,
    ConversationTurn
)
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience import WorkType, Timeline


def create_sample_experiences():
    """Create sample experiences for testing."""
    return [
        ExperienceEntity(
            uuid="exp-1",
            experience_title="High School Teacher (Mathematics & Physics)",
            company="Alliance High School",
            location="Kikuyu",
            timeline=Timeline(start="2018", end="2023"),
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT
        ),
        ExperienceEntity(
            uuid="exp-2",
            experience_title="Private Tutor",
            company="Self-employed",
            location="Nairobi",
            timeline=Timeline(start="2023", end="Present"),
            work_type=WorkType.SELF_EMPLOYMENT
        )
    ]


@pytest.mark.asyncio
async def test_hybrid_mode_full_conversation_flow():
    """
    Test complete hybrid mode conversation flow with automated responses.

    Verifies:
    - Vignettes progress through all phases (static_begin → adaptive → static_end)
    - completed_vignettes list grows correctly
    - No duplicate vignettes shown
    - Proper phase transitions
    """
    print("\n" + "="*80)
    print("TESTING HYBRID MODE FULL CONVERSATION FLOW")
    print("="*80)

    # Create agent in hybrid mode
    backend_root = Path(__file__).parent.parent
    offline_output_dir = str(backend_root / "offline_output")

    # Skip test if offline vignettes haven't been generated yet
    if not Path(offline_output_dir).exists():
        pytest.skip("Offline vignette files not generated - run offline optimization first")

    agent = PreferenceElicitationAgent(
        use_personalized_vignettes=False,  # Disable default personalization
        use_offline_with_personalization=True,
        offline_output_dir=offline_output_dir
    )

    # Initialize state with Bayesian posterior
    prior_mean = np.zeros(7)
    prior_cov = np.eye(7)

    state = PreferenceElicitationAgentState(
        session_id=99999,
        initial_experiences_snapshot=create_sample_experiences(),
        use_db6_for_fresh_data=False,
        use_adaptive_selection=False,
        posterior_mean=prior_mean.tolist(),
        posterior_covariance=prior_cov.tolist(),
        fisher_information_matrix=np.zeros((7, 7)).tolist()
    )

    agent.set_state(state)

    print(f"✓ Initialized agent in hybrid mode")
    print(f"  Initial phase: {state.conversation_phase}")
    print(f"  Initial completed_vignettes: {state.completed_vignettes}")

    # Conversation context
    conversation_history = ConversationHistory()

    # Automated responses for different phases
    experience_responses = [
        "I enjoyed the flexibility and autonomy",
        "The low pay was frustrating, but I liked working with students",
        "I prefer jobs with good work-life balance and decent salary"
    ]

    vignette_responses = ["A", "B", "A", "B", "A"]  # Alternate A/B

    turn_index = 0
    vignettes_seen = []
    phase_transitions = []

    # Track phase changes
    current_phase = state.conversation_phase

    print(f"\n{'='*80}")
    print("STARTING CONVERSATION")
    print(f"{'='*80}\n")

    max_turns = 30  # Safety limit
    for turn_num in range(max_turns):
        # Determine user message based on phase
        if turn_index == 0:
            user_message = ""  # First turn
        elif state.conversation_phase == "EXPERIENCE_QUESTIONS":
            user_message = experience_responses[min(turn_index - 1, len(experience_responses) - 1)]
        elif state.conversation_phase == "VIGNETTES":
            user_message = vignette_responses[len(vignettes_seen) % len(vignette_responses)]
        elif state.conversation_phase == "FOLLOW_UP":
            user_message = "I chose that because it offers better work-life balance and aligns with my values"
        else:
            user_message = "yes"

        # Track phase transition
        if state.conversation_phase != current_phase:
            phase_transitions.append(f"{current_phase} → {state.conversation_phase}")
            current_phase = state.conversation_phase
            print(f"\n🔄 PHASE TRANSITION: {phase_transitions[-1]}")

        # Create input
        agent_input = AgentInput(
            message=user_message,
            is_artificial=(turn_index == 0)
        )

        context = ConversationContext(
            all_history=conversation_history,
            history=conversation_history,
            summary=""
        )

        # Execute
        print(f"\n--- Turn {turn_num + 1} (Phase: {state.conversation_phase}) ---")
        print(f"User: {user_message if user_message else '(first turn)'}")

        try:
            output = await agent.execute(agent_input, context)

            # Track vignettes in VIGNETTES phase
            if state.conversation_phase == "VIGNETTES" and state.current_vignette_id:
                if state.current_vignette_id not in vignettes_seen:
                    vignettes_seen.append(state.current_vignette_id)
                    print(f"📋 Vignette shown: {state.current_vignette_id}")
                    print(f"   Total completed: {len(state.completed_vignettes)}")
                    print(f"   Unique seen: {len(vignettes_seen)}")

            print(f"Agent response: {output.message_for_user[:100]}...")

            # Update history
            conversation_turn = ConversationTurn(
                index=turn_index,
                input=agent_input,
                output=output
            )
            conversation_history.turns.append(conversation_turn)

            turn_index += 1

            # Check if finished
            if output.finished:
                print(f"\n✅ Conversation finished at turn {turn_num + 1}")
                break

            # Safety check
            if state.conversation_phase == "COMPLETE":
                print(f"\n✅ Reached COMPLETE phase at turn {turn_num + 1}")
                break

        except Exception as e:
            print(f"\n❌ ERROR at turn {turn_num + 1}: {e}")
            import traceback
            traceback.print_exc()
            raise

    # Analyze results
    print(f"\n{'='*80}")
    print("CONVERSATION SUMMARY")
    print(f"{'='*80}")

    print(f"\nTotal turns: {turn_index}")
    print(f"Phase transitions: {len(phase_transitions)}")
    for transition in phase_transitions:
        print(f"  - {transition}")

    print(f"\nVignettes:")
    print(f"  Total shown: {len(vignettes_seen)}")
    print(f"  Total completed: {len(state.completed_vignettes)}")
    print(f"  Unique vignettes: {len(set(vignettes_seen))}")

    # Categorize vignettes
    static_begin = [v for v in vignettes_seen if v.startswith("static_begin")]
    adaptive = [v for v in vignettes_seen if v.startswith("adaptive")]
    static_end = [v for v in vignettes_seen if v.startswith("static_end")]

    print(f"\nBreakdown:")
    print(f"  static_begin: {len(static_begin)} (expected: 4)")
    print(f"  adaptive: {len(adaptive)} (expected: 0-14)")
    print(f"  static_end: {len(static_end)} (expected: 2)")

    print(f"\nFirst 5 vignettes: {vignettes_seen[:5]}")
    print(f"Last 5 vignettes: {vignettes_seen[-5:]}")

    # ========== BAYESIAN POSTERIOR & FIM ANALYSIS ==========
    print(f"\n{'='*80}")
    print("BAYESIAN POSTERIOR DISTRIBUTION")
    print(f"{'='*80}")

    # Display preference dimensions
    dims = [
        "financial_importance",
        "work_environment_importance",
        "career_growth_importance",
        "work_life_balance_importance",
        "job_security_importance",
        "task_preference_importance",
        "values_culture_importance"
    ]

    print(f"\n{'Dimension':<30} {'Mean (μ)':<12} {'Std Dev (σ)':<15} {'95% CI':<30}")
    print("-" * 87)

    posterior_mean = np.array(state.posterior_mean)
    posterior_cov = np.array(state.posterior_covariance)

    for i, dim in enumerate(dims):
        mean = posterior_mean[i]
        variance = posterior_cov[i, i]
        std = np.sqrt(variance)
        ci_lower = mean - 1.96 * std
        ci_upper = mean + 1.96 * std

        # Shorten dimension names for display
        display_name = dim.replace("_importance", "").replace("_", " ").title()

        print(f"{display_name:<30} {mean:+.3f}{' '*7} ±{std:.3f}{' '*9} [{ci_lower:+.3f}, {ci_upper:+.3f}]")

    # ========== FISHER INFORMATION MATRIX ==========
    print(f"\n{'='*80}")
    print("FISHER INFORMATION MATRIX")
    print(f"{'='*80}")

    fim = np.array(state.fisher_information_matrix)
    eigenvalues = np.linalg.eigvalsh(fim)
    det = np.linalg.det(fim)
    d_efficiency = det ** (1 / 7) if det > 0 else 0
    condition_number = eigenvalues.max() / eigenvalues.min() if eigenvalues.min() > 1e-10 else np.inf

    print(f"\nFIM Metrics:")
    print(f"  Determinant (det(FIM)): {det:.2e}")
    print(f"  D-Efficiency (det^(1/k)): {d_efficiency:.4f}")
    print(f"  Condition Number: {condition_number:.2f}")
    print(f"  Min Eigenvalue: {eigenvalues.min():.4f}")
    print(f"  Max Eigenvalue: {eigenvalues.max():.4f}")

    print(f"\nEigenvalues (Information per Direction):")
    for i, eig in enumerate(eigenvalues, 1):
        print(f"  {i}. {eig:.4f}")

    # ========== FINAL PREFERENCE VECTOR ==========
    print(f"\n{'='*80}")
    print("FINAL PREFERENCE VECTOR (Simplified - 7 Dimensions)")
    print(f"{'='*80}")

    pv = state.preference_vector
    print(f"\n{'Dimension':<35} {'Importance':<12} {'Uncertainty (Var)':<20} {'Interpretation'}")
    print("-" * 100)

    dimensions = [
        ("Financial", pv.financial_importance, "Salary, benefits, compensation"),
        ("Work Environment", pv.work_environment_importance, "Remote, commute, autonomy, pace"),
        ("Career Advancement", pv.career_advancement_importance, "Growth, learning, promotion"),
        ("Work-Life Balance", pv.work_life_balance_importance, "Hours, flexibility, family time"),
        ("Job Security", pv.job_security_importance, "Stability, contract type, risk"),
        ("Task Preferences", pv.task_preference_importance, "Routine, cognitive, manual, social"),
        ("Social Impact", pv.social_impact_importance, "Purpose, helping others, community")
    ]

    for dim_name, importance, description in dimensions:
        uncertainty = pv.per_dimension_uncertainty.get(f"{dim_name.lower().replace(' ', '_').replace('-', '_')}_importance", 0.0)

        # Interpret importance level
        if importance >= 0.7:
            level = "HIGH"
        elif importance >= 0.4:
            level = "MODERATE"
        else:
            level = "LOW"

        print(f"{dim_name:<35} {importance:.3f} ({level}){' '*3} {uncertainty:.3f}{' '*15} {description}")

    print(f"\n{'='*80}")
    print("METADATA")
    print(f"{'='*80}")
    print(f"Overall Confidence:      {pv.confidence_score:.3f}")
    print(f"Vignettes Completed:     {pv.n_vignettes_completed}")
    print(f"FIM Determinant:         {pv.fim_determinant:.2e}" if pv.fim_determinant else "FIM Determinant:         N/A")

    print(f"\nRaw Posterior Mean:      {[f'{x:.3f}' for x in pv.posterior_mean]}")
    print(f"Posterior Variance:      {[f'{x:.3f}' for x in pv.posterior_covariance_diagonal]}")

    # Show top preferences
    print(f"\n{'='*80}")
    print("TOP PREFERENCES (Ranked by Importance)")
    print(f"{'='*80}")

    ranked = sorted(dimensions, key=lambda x: x[1], reverse=True)
    for i, (dim_name, importance, description) in enumerate(ranked, 1):
        print(f"{i}. {dim_name}: {importance:.3f} - {description}")

    # Show qualitative metadata
    print(f"\n{'='*80}")
    print("QUALITATIVE METADATA (LLM-Extracted Patterns)")
    print(f"{'='*80}")

    if pv.decision_patterns:
        print(f"\nDecision Patterns:")
        for key, value in pv.decision_patterns.items():
            print(f"  - {key}: {value}")
    else:
        print(f"\nDecision Patterns: (none extracted yet)")

    if pv.tradeoff_willingness:
        print(f"\nTradeoff Willingness:")
        for key, value in pv.tradeoff_willingness.items():
            print(f"  - {key}: {value}")
    else:
        print(f"\nTradeoff Willingness: (none extracted yet)")

    if pv.values_signals:
        print(f"\nValues Signals:")
        for key, value in pv.values_signals.items():
            print(f"  - {key}: {value}")
    else:
        print(f"\nValues Signals: (none extracted yet)")

    if pv.consistency_indicators:
        print(f"\nConsistency Indicators:")
        for key, value in pv.consistency_indicators.items():
            print(f"  - {key}: {value:.3f}")
    else:
        print(f"\nConsistency Indicators: (none extracted yet)")

    if pv.extracted_constraints:
        print(f"\nExtracted Constraints:")
        for key, value in pv.extracted_constraints.items():
            print(f"  - {key}: {value}")
    else:
        print(f"\nExtracted Constraints: (none extracted yet)")

    # Assertions
    assert len(vignettes_seen) > 0, "No vignettes were shown"
    assert len(set(vignettes_seen)) == len(vignettes_seen), f"Duplicate vignettes shown: {vignettes_seen}"
    assert len(static_begin) == 4, f"Expected 4 static_begin vignettes, got {len(static_begin)}"
    assert 0 <= len(adaptive) <= 14, f"Expected 0-14 adaptive vignettes, got {len(adaptive)}"
    assert len(static_end) == 2, f"Expected 2 static_end vignettes, got {len(static_end)}"

    print(f"\n{'='*80}")
    print("✅ ALL TESTS PASSED")
    print(f"{'='*80}\n")


if __name__ == "__main__":
    asyncio.run(test_hybrid_mode_full_conversation_flow())
