#!/usr/bin/env python3
"""
Unit test to debug hybrid mode vignette selection.

This test directly checks if vignettes advance properly when completed_vignettes is updated.
"""

import pytest
import asyncio
import numpy as np
from pathlib import Path

from app.agent.preference_elicitation_agent.vignette_engine import VignetteEngine
from app.agent.preference_elicitation_agent.state import PreferenceElicitationAgentState
from app.agent.preference_elicitation_agent.types import UserContext


@pytest.mark.asyncio
async def test_hybrid_mode_vignette_progression():
    """
    Test that hybrid mode advances through vignettes correctly as completed_vignettes is updated.

    Expected behavior:
    - Turn 1: Should select static_begin_001
    - Turn 2: Should select static_begin_002 (after marking turn 1 complete)
    - Turn 3: Should select static_begin_003 (after marking turn 2 complete)
    - Turn 4: Should select static_begin_004 (after marking turn 3 complete)
    """
    # Initialize engine in hybrid mode
    backend_root = Path(__file__).parent.parent
    offline_output_dir = str(backend_root / "offline_output")

    # Skip test if offline vignettes haven't been generated yet
    if not Path(offline_output_dir).exists():
        pytest.skip("Offline vignette files not generated - run offline optimization first")

    # Mock LLM for personalization
    from unittest.mock import AsyncMock, MagicMock

    mock_llm = MagicMock()
    # Mock the call method to return valid JSON
    mock_llm.call = AsyncMock(return_value=MagicMock(
        response='{"scenario_text": "Mock scenario", "option_a_title": "Mock A", "option_a_description": "Mock A desc", "option_b_title": "Mock B", "option_b_description": "Mock B desc", "reasoning": "Mock reasoning"}',
        prompt_token_count=100,
        response_token_count=50
    ))

    engine = VignetteEngine(
        llm=mock_llm,
        use_personalization=False,  # Must disable default personalization
        use_offline_with_personalization=True,
        offline_output_dir=offline_output_dir
    )

    # Initialize state with Bayesian posterior
    prior_mean = np.zeros(7)
    prior_cov = np.eye(7)

    state = PreferenceElicitationAgentState(
        session_id=99999,
        use_adaptive_selection=False,  # Hybrid mode doesn't use this flag
        posterior_mean=prior_mean.tolist(),
        posterior_covariance=prior_cov.tolist(),
        fisher_information_matrix=np.zeros((7, 7)).tolist()
    )

    user_context = UserContext(
        current_role="Test Role",
        industry="Test Industry",
        experience_level="junior"
    )

    print("\n" + "="*80)
    print("TESTING HYBRID MODE VIGNETTE PROGRESSION")
    print("="*80)

    # Turn 1: Should get static_begin_001
    print("\n--- TURN 1 ---")
    print(f"State before: completed_vignettes = {state.completed_vignettes}")

    vignette_1 = await engine.select_next_vignette(
        state=state,
        user_context=user_context
    )

    print(f"Selected vignette: {vignette_1.vignette_id if vignette_1 else None}")
    assert vignette_1 is not None, "Turn 1: Should return a vignette"
    assert vignette_1.vignette_id.startswith("static_begin"), f"Turn 1: Expected static_begin vignette, got {vignette_1.vignette_id}"

    # Simulate user response - mark as completed
    state.completed_vignettes.append(vignette_1.vignette_id)
    print(f"State after: completed_vignettes = {state.completed_vignettes}")

    # Turn 2: Should get static_begin_002
    print("\n--- TURN 2 ---")
    print(f"State before: completed_vignettes = {state.completed_vignettes}")

    vignette_2 = await engine.select_next_vignette(
        state=state,
        user_context=user_context
    )

    print(f"Selected vignette: {vignette_2.vignette_id if vignette_2 else None}")
    assert vignette_2 is not None, "Turn 2: Should return a vignette"
    assert vignette_2.vignette_id != vignette_1.vignette_id, f"Turn 2: Should return DIFFERENT vignette! Got {vignette_2.vignette_id} (same as turn 1)"

    # Simulate user response - mark as completed
    state.completed_vignettes.append(vignette_2.vignette_id)
    print(f"State after: completed_vignettes = {state.completed_vignettes}")

    # Turn 3: Should get static_begin_003
    print("\n--- TURN 3 ---")
    print(f"State before: completed_vignettes = {state.completed_vignettes}")

    vignette_3 = await engine.select_next_vignette(
        state=state,
        user_context=user_context
    )

    print(f"Selected vignette: {vignette_3.vignette_id if vignette_3 else None}")
    assert vignette_3 is not None, "Turn 3: Should return a vignette"
    assert vignette_3.vignette_id != vignette_1.vignette_id, f"Turn 3: Should return DIFFERENT vignette from turn 1!"
    assert vignette_3.vignette_id != vignette_2.vignette_id, f"Turn 3: Should return DIFFERENT vignette from turn 2!"

    # Simulate user response - mark as completed
    state.completed_vignettes.append(vignette_3.vignette_id)
    print(f"State after: completed_vignettes = {state.completed_vignettes}")

    # Turn 4: Should get static_begin_004
    print("\n--- TURN 4 ---")
    print(f"State before: completed_vignettes = {state.completed_vignettes}")

    vignette_4 = await engine.select_next_vignette(
        state=state,
        user_context=user_context
    )

    print(f"Selected vignette: {vignette_4.vignette_id if vignette_4 else None}")
    assert vignette_4 is not None, "Turn 4: Should return a vignette"
    assert vignette_4.vignette_id not in [vignette_1.vignette_id, vignette_2.vignette_id, vignette_3.vignette_id], \
        f"Turn 4: Should return DIFFERENT vignette from previous turns!"

    print("\n" + "="*80)
    print("✅ TEST PASSED: Vignettes advance correctly!")
    print("="*80)


@pytest.mark.asyncio
async def test_state_mutation_check():
    """
    Test if state.completed_vignettes is actually mutating or being reset.

    This checks if the state object is being preserved between calls.
    """
    state = PreferenceElicitationAgentState(session_id=12345)

    print("\n" + "="*80)
    print("TESTING STATE MUTATION")
    print("="*80)

    # Initial state
    print(f"\nInitial: completed_vignettes = {state.completed_vignettes}")
    print(f"Initial: id(completed_vignettes) = {id(state.completed_vignettes)}")

    # Add first vignette
    state.completed_vignettes.append("test_vignette_001")
    print(f"\nAfter append 1: completed_vignettes = {state.completed_vignettes}")
    print(f"After append 1: id(completed_vignettes) = {id(state.completed_vignettes)}")

    # Add second vignette
    state.completed_vignettes.append("test_vignette_002")
    print(f"\nAfter append 2: completed_vignettes = {state.completed_vignettes}")
    print(f"After append 2: id(completed_vignettes) = {id(state.completed_vignettes)}")

    # Check persistence
    assert len(state.completed_vignettes) == 2, "State should have 2 vignettes"
    assert state.completed_vignettes[0] == "test_vignette_001"
    assert state.completed_vignettes[1] == "test_vignette_002"

    print("\n✅ State mutation works correctly")
    print("="*80)


if __name__ == "__main__":
    asyncio.run(test_hybrid_mode_vignette_progression())
    asyncio.run(test_state_mutation_check())
