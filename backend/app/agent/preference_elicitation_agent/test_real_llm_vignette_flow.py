#!/usr/bin/env python3
"""
Real LLM integration test for vignette flow.

Uses REAL Gemini LLM calls (no mocking) to test the full preference elicitation
conversation from INTRO through VIGNETTES to WRAPUP. Loads actual offline
vignettes (static_beginning, adaptive, static_end) and simulates user responses.

Saves a full conversation transcript to session_logs/ for review.

Run:
    cd compass/backend
    poetry run pytest app/agent/preference_elicitation_agent/test_real_llm_vignette_flow.py -v -s

NOTE: Requires GOOGLE_API_KEY or equivalent env var for Gemini.
"""

import pytest
import asyncio
import json
import numpy as np
from pathlib import Path
from datetime import datetime, timezone

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


def create_test_experiences():
    """Create the same experiences from the real transcript."""
    return [
        ExperienceEntity(
            uuid="exp-1",
            experience_title="Contract Software Developer",
            company="Tabiya Organization",
            timeline=Timeline(start="11/2025", end="Present"),
            work_type=WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK
        )
    ]


# User responses keyed by phase. For VIGNETTES, these are the actual transcript choices.
VIGNETTE_RESPONSES = [
    "I would pick the Glovo guy job since its offering higher pay and less commute",
    "I would pick the remote Job for job security it offers",
    "In this instance I think Id pick the freelance at the startup for the shorter commute and higher pay",
    "Id pick the Junior Dev at Established firm for higher pay",
    "Id pick the Junior for opensource since the difference in pay is not that huge",
    "I want the stable job for security",
    "Id go with the flexible one",
    "Career growth is more important here",
    "Higher pay and career growth",
    "Better work environment and flexibility",
    "Job security is more important",
    "I prefer better career growth over higher pay",
]

EXPERIENCE_RESPONSES = [
    "I enjoyed the flexibility and being able to work on real problems. The pay was okay but the autonomy was great.",
    "The low predictability was frustrating. I would like more job security in my next role but still want career growth.",
    "I prefer jobs with good work-life balance and a reasonable salary. Commute matters to me too."
]

FOLLOW_UP_RESPONSES = [
    "I chose that because it offers better work-life balance and aligns with my values",
    "The pay difference was big enough to make a difference for me",
    "I care more about stability than a small salary bump",
]

BWS_RESPONSES = [
    # 12 BWS tasks - pick best/worst from 5 occupations each
    "best: 1, worst: 5",
    "best: 2, worst: 4",
    "best: 1, worst: 3",
    "best: 3, worst: 5",
    "best: 2, worst: 1",
    "best: 4, worst: 5",
    "best: 1, worst: 3",
    "best: 2, worst: 5",
    "best: 3, worst: 1",
    "best: 4, worst: 2",
    "best: 1, worst: 5",
    "best: 3, worst: 4",
]


def save_transcript(transcript: list[dict], state, output_path: Path):
    """Save full conversation transcript with diagnostics."""
    # Build diagnostics
    dims = [
        "financial_importance",
        "work_environment_importance",
        "career_growth_importance",
        "work_life_balance_importance",
        "job_security_importance",
        "task_preference_importance",
        "values_culture_importance"
    ]

    posterior_mean = np.array(state.posterior_mean) if state.posterior_mean else np.zeros(7)
    posterior_cov = np.array(state.posterior_covariance) if state.posterior_covariance else np.eye(7)
    fim = np.array(state.fisher_information_matrix) if state.fisher_information_matrix else np.zeros((7, 7))

    # FIM diagnostics
    eigenvalues = np.linalg.eigvalsh(fim)
    det = np.linalg.det(fim + np.eye(7) * 1e-8)
    prior_fim_det = 2.0 ** 7  # (1/0.5)^7 = 128
    det_ratio = det / prior_fim_det if prior_fim_det > 0 else 0

    # Posterior diagnostics
    posterior_diagnostics = {}
    for i, dim in enumerate(dims):
        mean = posterior_mean[i] if i < len(posterior_mean) else 0
        var = posterior_cov[i][i] if i < len(posterior_cov) else 0
        std = np.sqrt(var) if var > 0 else 0
        posterior_diagnostics[dim] = {
            "mean": round(float(mean), 4),
            "variance": round(float(var), 4),
            "std_dev": round(float(std), 4),
            "95_ci": [round(float(mean - 1.96 * std), 4), round(float(mean + 1.96 * std), 4)]
        }

    # Vignette breakdown
    completed = state.completed_vignettes or []
    static_begin = [v for v in completed if v.startswith("static_begin")]
    adaptive = [v for v in completed if v.startswith("adaptive")]
    static_end = [v for v in completed if v.startswith("static_end")]

    # Preference vector
    pv = state.preference_vector
    preference_summary = {
        "financial": pv.financial_importance,
        "work_environment": pv.work_environment_importance,
        "career_advancement": pv.career_advancement_importance,
        "work_life_balance": pv.work_life_balance_importance,
        "job_security": pv.job_security_importance,
        "task_preference": pv.task_preference_importance,
        "social_impact": pv.social_impact_importance,
        "confidence_score": pv.confidence_score,
        "n_vignettes_completed": pv.n_vignettes_completed,
    }

    output = {
        "test_run_timestamp": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_turns": len(transcript),
            "total_vignettes_completed": len(completed),
            "static_begin_count": len(static_begin),
            "adaptive_count": len(adaptive),
            "static_end_count": len(static_end),
            "adaptive_phase_complete": state.adaptive_phase_complete,
            "stopping_reason": state.stopping_reason,
            "final_phase": state.conversation_phase,
        },
        "vignette_ids": {
            "static_begin": static_begin,
            "adaptive": adaptive,
            "static_end": static_end,
        },
        "fim_diagnostics": {
            "determinant": round(float(det), 6),
            "det_ratio_over_prior": round(float(det_ratio), 4),
            "prior_fim_det": round(float(prior_fim_det), 2),
            "eigenvalues": [round(float(e), 6) for e in eigenvalues],
            "condition_number": round(float(eigenvalues.max() / eigenvalues.min()), 2) if eigenvalues.min() > 1e-10 else "inf",
        },
        "posterior_diagnostics": posterior_diagnostics,
        "preference_vector": preference_summary,
        "conversation_transcript": transcript,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False, default=str)

    return output


@pytest.mark.asyncio
@pytest.mark.evaluation_test
async def test_real_llm_vignette_flow():
    """
    Full integration test with real LLM calls.

    Runs the agent from INTRO through all phases using real Gemini calls.
    Saves transcript to session_logs/ for review.
    """
    backend_root = Path(__file__).parent.parent.parent.parent
    offline_output_dir = str(backend_root / "offline_output")

    if not Path(offline_output_dir).exists():
        pytest.skip("Offline vignette files not generated - run offline optimization first")

    # Create agent with REAL LLMs (no mocking)
    agent = PreferenceElicitationAgent(
        use_personalized_vignettes=False,
        use_offline_with_personalization=True,
        offline_output_dir=offline_output_dir
    )

    # Initialize state - start from INTRO
    prior_mean = np.array([0.5] * 7)
    prior_cov = np.eye(7) * 0.5
    initial_fim = (np.eye(7) / 0.5)

    state = PreferenceElicitationAgentState(
        session_id=77777,
        conversation_phase="INTRO",
        conversation_turn_count=0,
        initial_experiences_snapshot=create_test_experiences(),
        use_adaptive_selection=False,
        posterior_mean=prior_mean.tolist(),
        posterior_covariance=prior_cov.tolist(),
        fisher_information_matrix=initial_fim.tolist(),
    )
    agent.set_state(state)

    # Response pools indexed by phase
    vignette_idx = 0
    experience_idx = 0
    follow_up_idx = 0
    bws_idx = 0

    conversation_history = ConversationHistory()
    transcript = []

    current_phase = state.conversation_phase
    max_turns = 40  # Safety limit

    print(f"\n{'='*80}")
    print("REAL LLM VIGNETTE FLOW TEST")
    print(f"{'='*80}")

    for turn_num in range(max_turns):
        phase = state.conversation_phase

        # Track phase transitions
        if phase != current_phase:
            print(f"\n>> PHASE TRANSITION: {current_phase} -> {phase}")
            current_phase = phase

        # Pick user message based on phase
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
            user_message = VIGNETTE_RESPONSES[min(vignette_idx, len(VIGNETTE_RESPONSES) - 1)]
            vignette_idx += 1
            is_artificial = False
        elif phase == "FOLLOW_UP":
            user_message = FOLLOW_UP_RESPONSES[min(follow_up_idx, len(FOLLOW_UP_RESPONSES) - 1)]
            follow_up_idx += 1
            is_artificial = False
        elif phase == "WRAPUP":
            user_message = "yes that sounds right"
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

        print(f"\n--- Turn {turn_num + 1} [{phase}] ---")
        print(f"  User: {user_message[:80] if user_message else '(first turn)'}")

        try:
            output = await agent.execute(agent_input, context)
        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback
            traceback.print_exc()
            # Record error in transcript and break
            transcript.append({
                "turn": turn_num + 1,
                "phase": phase,
                "user": user_message,
                "agent": f"ERROR: {e}",
                "completed_vignettes": list(state.completed_vignettes),
            })
            break

        agent_msg = output.message_for_user
        print(f"  Agent: {agent_msg[:120]}...")
        print(f"  completed={len(state.completed_vignettes)}, "
              f"adaptive_complete={state.adaptive_phase_complete}, "
              f"fim_det={state.fim_determinant}")

        # Record in transcript
        transcript.append({
            "turn": turn_num + 1,
            "phase": phase,
            "user": user_message,
            "agent": agent_msg,
            "finished": output.finished,
            "completed_vignettes": list(state.completed_vignettes),
            "current_vignette_id": state.current_vignette_id,
            "adaptive_phase_complete": state.adaptive_phase_complete,
            "stopping_reason": state.stopping_reason,
            "fim_determinant": state.fim_determinant,
        })

        # Update conversation history
        conversation_turn = ConversationTurn(
            index=turn_num,
            input=agent_input,
            output=output
        )
        conversation_history.turns.append(conversation_turn)

        if output.finished or phase == "COMPLETE":
            print(f"\n>> CONVERSATION FINISHED at turn {turn_num + 1}")
            break

    # ========== SAVE TRANSCRIPT ==========
    transcript_path = backend_root / "session_logs" / f"test_real_llm_flow_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    result = save_transcript(transcript, state, transcript_path)

    # ========== PRINT SUMMARY ==========
    completed = state.completed_vignettes or []
    static_begin = [v for v in completed if v.startswith("static_begin")]
    adaptive = [v for v in completed if v.startswith("adaptive")]
    static_end = [v for v in completed if v.startswith("static_end")]

    print(f"\n{'='*80}")
    print("RESULTS")
    print(f"{'='*80}")
    print(f"  Total turns: {len(transcript)}")
    print(f"  Total vignettes completed: {len(completed)}")
    print(f"  Static begin: {len(static_begin)} {static_begin}")
    print(f"  Adaptive: {len(adaptive)} {adaptive}")
    print(f"  Static end: {len(static_end)} {static_end}")
    print(f"  adaptive_phase_complete: {state.adaptive_phase_complete}")
    print(f"  stopping_reason: {state.stopping_reason}")
    print(f"  Final phase: {state.conversation_phase}")

    if state.fim_determinant:
        prior_fim_det = (1.0 / 0.5) ** 7
        ratio = state.fim_determinant / prior_fim_det
        print(f"  FIM det: {state.fim_determinant:.2e}")
        print(f"  FIM det ratio: {ratio:.4f} (threshold: 10.0)")

    print(f"\n  Transcript saved to: {transcript_path}")

    # ========== ASSERTIONS ==========
    # At minimum: 4 static begin vignettes should complete
    assert len(completed) >= 4, (
        f"Expected at least 4 completed vignettes, got {len(completed)}"
    )

    # Static begin should be 4 (or close to it)
    assert len(static_begin) >= 3, (
        f"Expected at least 3 static_begin vignettes, got {len(static_begin)}"
    )

    # The adaptive phase should NOT be killed by FIM ratio after only static begin
    if state.adaptive_phase_complete and len(adaptive) == 0:
        if state.stopping_reason and "determinant ratio" in state.stopping_reason:
            pytest.fail(
                f"Adaptive phase killed by FIM ratio with 0 adaptive vignettes: "
                f"{state.stopping_reason}"
            )

    # Transcript should be saved
    assert transcript_path.exists(), "Transcript file was not saved"

    print(f"\n{'='*80}")
    print("ALL ASSERTIONS PASSED")
    print(f"{'='*80}\n")


if __name__ == "__main__":
    asyncio.run(test_real_llm_vignette_flow())
