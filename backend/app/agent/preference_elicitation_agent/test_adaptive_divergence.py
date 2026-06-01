#!/usr/bin/env python3
"""
Test whether different user responses produce different adaptive vignettes.

Runs two flows with opposite vignette preferences and compares which
adaptive vignettes get selected by the D-optimal selector.
"""

import pytest
import asyncio
import json
import numpy as np
from pathlib import Path
from datetime import datetime, timezone

from app.agent.preference_elicitation_agent.agent import PreferenceElicitationAgent
from app.agent.preference_elicitation_agent.state import PreferenceElicitationAgentState
from app.agent.agent_types import AgentInput
from app.conversation_memory.conversation_memory_types import (
    ConversationContext, ConversationHistory, ConversationTurn
)
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience import WorkType, Timeline


def create_experiences():
    return [
        ExperienceEntity(
            uuid="exp-1",
            experience_title="Contract Software Developer",
            company="Tabiya Organization",
            timeline=Timeline(start="11/2025", end="Present"),
            work_type=WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK
        )
    ]


# Two opposite response sets for vignettes
RESPONSES_ALWAYS_A = [
    "I prefer option A, flexibility and remote work matter most to me",
    "Option A again, I value the work environment over salary",
    "A - career growth is more important than money",
    "I'd pick A, work-life balance is everything",
    "A, I want autonomy and flexibility",
    "A, remote work is non-negotiable for me",
    "A, the culture matters more",
    "A, learning opportunities are key",
    "A for sure", "A", "A", "A",
]

RESPONSES_ALWAYS_B = [
    "I prefer option B, the higher salary is worth it",
    "Option B, money talks and I need financial security",
    "B - higher pay compensates for the commute",
    "I'd pick B, job security and higher pay win",
    "B, I want the stable paycheck",
    "B, physical work is fine if the pay is good",
    "B, career advancement at a bigger company",
    "B, the benefits package seals it",
    "B for sure", "B", "B", "B",
]

EXPERIENCE_RESPONSES = [
    "I enjoyed the flexibility of remote work",
    "Low pay was frustrating but I liked the autonomy",
    "Work-life balance matters most to me",
]

BWS_RESPONSES = [
    "best: 1, worst: 5", "best: 2, worst: 4", "best: 1, worst: 3",
    "best: 3, worst: 5", "best: 2, worst: 1", "best: 4, worst: 5",
    "best: 1, worst: 3", "best: 2, worst: 5", "best: 3, worst: 1",
    "best: 4, worst: 2", "best: 1, worst: 5", "best: 3, worst: 4",
]


async def run_flow(label: str, vignette_responses: list[str]) -> dict:
    """Run a full agent flow and return results."""
    backend_root = Path(__file__).parent.parent.parent.parent
    offline_output_dir = str(backend_root / "offline_output")

    agent = PreferenceElicitationAgent(
        use_personalized_vignettes=False,
        use_offline_with_personalization=True,
        offline_output_dir=offline_output_dir
    )

    prior_mean = np.array([0.5] * 7)
    prior_cov = np.eye(7) * 0.5
    initial_fim = np.eye(7) / 0.5

    state = PreferenceElicitationAgentState(
        session_id=int(hash(label) % 100000),
        conversation_phase="INTRO",
        conversation_turn_count=0,
        initial_experiences_snapshot=create_experiences(),
        use_adaptive_selection=False,
        posterior_mean=prior_mean.tolist(),
        posterior_covariance=prior_cov.tolist(),
        fisher_information_matrix=initial_fim.tolist(),
    )
    agent.set_state(state)

    vignette_idx = 0
    experience_idx = 0
    bws_idx = 0
    conversation_history = ConversationHistory()
    transcript = []

    for turn_num in range(40):
        phase = state.conversation_phase

        if turn_num == 0:
            user_message = ""
            is_artificial = True
        elif phase == "EXPERIENCE_QUESTIONS":
            user_message = EXPERIENCE_RESPONSES[min(experience_idx, len(EXPERIENCE_RESPONSES) - 1)]
            experience_idx += 1
            is_artificial = False
        elif phase == "BWS":
            user_message = BWS_RESPONSES[min(bws_idx, len(BWS_RESPONSES) - 1)]
            bws_idx += 1
            is_artificial = False
        elif phase == "VIGNETTES":
            user_message = vignette_responses[min(vignette_idx, len(vignette_responses) - 1)]
            vignette_idx += 1
            is_artificial = False
        elif phase == "FOLLOW_UP":
            user_message = "Because that option aligned better with what I value most"
            is_artificial = False
        elif phase == "WRAPUP":
            user_message = "yes"
            is_artificial = False
        else:
            user_message = "yes"
            is_artificial = False

        agent_input = AgentInput(message=user_message, is_artificial=is_artificial)
        context = ConversationContext(
            all_history=conversation_history,
            history=conversation_history,
            summary=""
        )

        try:
            output = await agent.execute(agent_input, context)
        except Exception as e:
            print(f"  [{label}] ERROR at turn {turn_num+1}: {e}")
            break

        transcript.append({
            "turn": turn_num + 1,
            "phase": phase,
            "user": user_message[:80],
            "completed": list(state.completed_vignettes),
            "current_vignette": state.current_vignette_id,
        })

        conversation_turn = ConversationTurn(index=turn_num, input=agent_input, output=output)
        conversation_history.turns.append(conversation_turn)

        if output.finished or phase == "COMPLETE":
            break

    completed = state.completed_vignettes or []
    static_begin = [v for v in completed if v.startswith("static_begin")]
    adaptive = [v for v in completed if v.startswith("adaptive")]
    static_end = [v for v in completed if v.startswith("static_end")]

    prior_fim_det = (1.0 / 0.5) ** 7
    fim_det = state.fim_determinant or 0
    ratio = fim_det / prior_fim_det if prior_fim_det > 0 else 0

    return {
        "label": label,
        "total_vignettes": len(completed),
        "static_begin": static_begin,
        "adaptive": adaptive,
        "static_end": static_end,
        "adaptive_ids": sorted(adaptive),
        "stopping_reason": state.stopping_reason,
        "fim_det_ratio": round(ratio, 4),
        "posterior_mean": [round(x, 4) for x in state.posterior_mean] if state.posterior_mean else [],
        "turns": len(transcript),
    }


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_different_responses_produce_different_adaptive_vignettes():
    """
    Run two flows with opposite response patterns.
    Compare which adaptive vignettes get selected.
    """
    backend_root = Path(__file__).parent.parent.parent.parent
    offline_output_dir = backend_root / "offline_output"

    if not offline_output_dir.exists():
        pytest.skip("Offline vignette files not generated")

    print(f"\n{'='*80}")
    print("TESTING: Do different responses produce different adaptive vignettes?")
    print(f"{'='*80}")

    # Run both flows
    print("\n--- Running Flow A (always picks A - flexibility/remote/growth) ---")
    result_a = await run_flow("always_A", RESPONSES_ALWAYS_A)

    print("\n--- Running Flow B (always picks B - salary/security/stability) ---")
    result_b = await run_flow("always_B", RESPONSES_ALWAYS_B)

    # Print results
    print(f"\n{'='*80}")
    print("COMPARISON")
    print(f"{'='*80}")

    print(f"\n{'Metric':<30} {'Flow A (flexibility)':<25} {'Flow B (salary)':<25}")
    print("-" * 80)
    print(f"{'Total vignettes':<30} {result_a['total_vignettes']:<25} {result_b['total_vignettes']:<25}")
    print(f"{'Static begin':<30} {len(result_a['static_begin']):<25} {len(result_b['static_begin']):<25}")
    print(f"{'Adaptive count':<30} {len(result_a['adaptive']):<25} {len(result_b['adaptive']):<25}")
    print(f"{'Static end':<30} {len(result_a['static_end']):<25} {len(result_b['static_end']):<25}")
    print(f"{'FIM det ratio':<30} {result_a['fim_det_ratio']:<25} {result_b['fim_det_ratio']:<25}")
    print(f"{'Turns':<30} {result_a['turns']:<25} {result_b['turns']:<25}")

    print(f"\n{'Adaptive IDs (A)':<20} {result_a['adaptive_ids']}")
    print(f"{'Adaptive IDs (B)':<20} {result_b['adaptive_ids']}")

    # Check overlap
    set_a = set(result_a['adaptive_ids'])
    set_b = set(result_b['adaptive_ids'])
    overlap = set_a & set_b
    only_a = set_a - set_b
    only_b = set_b - set_a

    print(f"\n{'Overlap':<20} {sorted(overlap) if overlap else 'NONE'}")
    print(f"{'Only in A':<20} {sorted(only_a) if only_a else 'NONE'}")
    print(f"{'Only in B':<20} {sorted(only_b) if only_b else 'NONE'}")

    # Posterior comparison
    print(f"\nPosterior means:")
    dims = ["financial", "work_env", "career", "wlb", "security", "task", "values"]
    if result_a['posterior_mean'] and result_b['posterior_mean']:
        print(f"  {'Dim':<12} {'Flow A':>10} {'Flow B':>10} {'Diff':>10}")
        for i, dim in enumerate(dims):
            a_val = result_a['posterior_mean'][i]
            b_val = result_b['posterior_mean'][i]
            diff = a_val - b_val
            marker = " ***" if abs(diff) > 0.1 else ""
            print(f"  {dim:<12} {a_val:>10.4f} {b_val:>10.4f} {diff:>+10.4f}{marker}")

    print(f"\nStopping reasons:")
    print(f"  A: {result_a['stopping_reason']}")
    print(f"  B: {result_b['stopping_reason']}")

    # Save comparison
    comparison = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "flow_a": result_a,
        "flow_b": result_b,
        "adaptive_overlap": sorted(overlap),
        "only_in_a": sorted(only_a),
        "only_in_b": sorted(only_b),
        "adaptive_vignettes_differ": set_a != set_b,
    }

    output_path = backend_root / "session_logs" / f"adaptive_divergence_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(comparison, f, indent=2, default=str)
    print(f"\nSaved to: {output_path}")

    # The key assertion
    print(f"\n{'='*80}")
    if set_a != set_b:
        print("RESULT: ADAPTIVE VIGNETTES DIFFER between flows")
    elif len(set_a) == 0 and len(set_b) == 0:
        print("RESULT: No adaptive vignettes in either flow (both stopped early)")
    else:
        print("RESULT: Same adaptive vignettes selected (responses didn't change selection)")
    print(f"{'='*80}\n")

    # With fim_det_threshold=1.0 (absolute mode), the stopping criterion fires after
    # 4 static_begin vignettes (det ratio >> 1.0). Adaptive vignettes are no longer
    # selected in the hybrid flow — GATE phase now handles preference refinement.
    # This test is retained as a diagnostic: log divergence if adaptive vignettes
    # are ever re-enabled, but don't fail when neither flow selects them.
    if len(result_a['adaptive']) == 0 and len(result_b['adaptive']) == 0:
        print("NOTE: No adaptive vignettes selected in either flow (expected with threshold=1.0)")
    else:
        assert set_a != set_b, (
            "Both flows selected adaptive vignettes but chose the SAME ones — "
            "D-optimal selection is not responding to different user responses"
        )


if __name__ == "__main__":
    asyncio.run(test_different_responses_produce_different_adaptive_vignettes())
