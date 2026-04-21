"""
Transcript replay test — CORE-309.

Replays the vignette phase of the real user session from the transcript
(misc/ai_conversation_transcript - CORE 309.txt) using Victor's profile
(Software Developer at Tabiya) and the same user responses.

Asserts that the fixes hold:
1. Vignette categories are diverse across the session (not all the same).
2. A transition sentence appears whenever the category changes between vignettes.
3. Option titles are not all anchored on "Tabiya" / the user's current employer.

Marked llm_integration — skipped automatically in CI (no LLM credentials available):
    poetry run pytest -m "not llm_integration"

Run manually (requires GCP / Gemini credentials):
    poetry run pytest app/agent/preference_elicitation_agent/test_transcript_replay.py -v -s

A full conversation transcript is written to transcript_replay_output.md in this
directory after each run so you can read the complete agent responses.
"""

import pytest
from pathlib import Path
from typing import Optional

from app.agent.preference_elicitation_agent.agent import PreferenceElicitationAgent
from app.agent.preference_elicitation_agent.state import PreferenceElicitationAgentState
from app.agent.agent_types import AgentInput
from app.conversation_memory.conversation_memory_types import (
    ConversationContext,
    ConversationHistory,
    ConversationTurn,
)
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.experience import WorkType, Timeline


# ── Transcript inputs (vignette phase only) ───────────────────────────────────
# Taken verbatim from CORE-309 transcript, starting from the first preference
# question through the final GATE answer.

TRANSCRIPT_INPUTS = [
    "",                         # turn 0: automatic start
    "Let's start!",             # welcome / intro
    "And our task that I really enjoyed while doing software engineering was investigating the product and writing the code.",
    "They were very productive, and I like challenges that force me to think and solve problems",
    "I don't have a conclusive answer for that right now",
    # vignette responses (6 in transcript)
    "I think I would pick the engineer developer role because of job security and flexibility",
    "I'd keep the junior dev role for job security.",
    "I think I have to keep day training at that point, mostly because of the better career growth. The second option with fixed hours isn't really good for me.",
    "I guess in this option the second job, the freelance one, is a bit better, but I don't know about the freelancing part because you have to get your own clients. With a shorter commute and higher wage, I can tolerate the lower job security",
    "I think I would have taken the Junior Developer role because it's more secure, um, stable, and, yeah, positive company culture or something",
    "I'll go with the second option, Higher pay",
    # GATE responses
    "I think I'd pick the less secure job with a higher salary",
    "What's important to me right now is earning more money.",
    "Uh, not as important",
]


# ── Victor's experience (from transcript) ────────────────────────────────────

def victor_experiences() -> list[ExperienceEntity]:
    return [
        ExperienceEntity(
            uuid="exp-victor-1",
            experience_title="Software Developer",
            company="Tabiya",
            location="Remote",
            timeline=Timeline(start="2025-12", end="Present"),
            work_type=WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
        )
    ]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_agent() -> PreferenceElicitationAgent:
    offline_dir = str(Path(__file__).parent.parent.parent.parent / "offline_output")
    return PreferenceElicitationAgent(
        use_offline_with_personalization=True,
        offline_output_dir=offline_dir,
    )


def _make_state() -> PreferenceElicitationAgentState:
    return PreferenceElicitationAgentState(
        session_id=309,
        initial_experiences_snapshot=victor_experiences(),
        use_db6_for_fresh_data=False,
        use_adaptive_selection=False,
    )


# ── Test ──────────────────────────────────────────────────────────────────────

@pytest.mark.llm_integration
@pytest.mark.asyncio
async def test_vignette_phase_is_diverse_and_has_transitions():
    """
    Replay the CORE-309 transcript and assert that our fixes hold.

    We run until the agent finishes the VIGNETTES phase or exhausts
    the transcript inputs, then inspect the collected vignette turns.
    """
    agent = _make_agent()
    state = _make_state()
    agent.set_state(state)

    history = ConversationHistory()
    vignette_turns: list[dict] = []   # {category, message, previous_category}
    previous_category: Optional[str] = None
    transcript_lines: list[str] = [
        "# CORE-309 Transcript Replay\n",
        "Victor's profile: Software Developer at Tabiya (entry-level)\n",
        "---\n",
    ]

    for idx, user_text in enumerate(TRANSCRIPT_INPUTS):
        agent_input = AgentInput(message=user_text, is_artificial=(idx == 0))
        context = ConversationContext(
            all_history=history,
            history=history,
            summary="",
        )

        output = await agent.execute(agent_input, context)

        history.turns.append(
            ConversationTurn(index=idx, input=agent_input, output=output)
        )

        phase = state.conversation_phase
        msg   = output.message_for_user

        # Record full turn in transcript
        transcript_lines.append(f"## Turn {idx} — Phase: {phase}\n")
        if user_text:
            transcript_lines.append(f"**User:** {user_text}\n\n")
        transcript_lines.append(f"**Agent:**\n\n{msg}\n\n")
        transcript_lines.append("---\n")

        # Capture every turn that's in the vignette / follow-up phase
        if phase in ("VIGNETTES", "FOLLOW_UP"):
            # Only record turns where a new vignette was just selected
            # (message contains "Which would you prefer")
            if "Which would you prefer" in msg:
                current_category = state.current_vignette_id and (
                    agent._vignette_engine.get_vignette_by_id(state.current_vignette_id)
                )
                cat = current_category.category if current_category else "unknown"
                vignette_turns.append({
                    "category": cat,
                    "message": msg,
                    "previous_category": previous_category,
                })
                previous_category = cat

        # Print each turn so you can read the replay
        print(f"\n[Turn {idx}] Phase={phase}")
        print(f"  User : {user_text[:80]}")
        print(f"  Agent: {msg[:200]}")

        if output.finished or phase == "COMPLETE":
            break

    # Write full transcript to a file next to this test
    transcript_path = Path(__file__).parent / "transcript_replay_output.md"
    transcript_path.write_text("\n".join(transcript_lines), encoding="utf-8")
    print(f"\nFull transcript written to: {transcript_path}")

    # ── Assertion 1: categories are diverse ──────────────────────────────────
    # With the category rotation fix, the 5 beginning vignettes should span
    # at least 3 distinct categories (before the fix they were all the same).
    if len(vignette_turns) >= 3:
        categories_seen = {t["category"] for t in vignette_turns}
        assert len(categories_seen) >= 3, (
            f"Expected at least 3 distinct vignette categories, got: {categories_seen}. "
            "Category rotation fix may not have taken effect."
        )

    # ── Assertion 2: transition sentences appear on category change ───────────
    # Every time the category changes, the message should contain "We've covered".
    for turn in vignette_turns:
        prev = turn["previous_category"]
        curr = turn["category"]
        msg  = turn["message"]

        if prev and prev != curr:
            assert "We've covered" in msg, (
                f"Expected transition sentence when moving from '{prev}' to '{curr}', "
                f"but message started with: {msg[:120]!r}"
            )

    # ── Assertion 3: not all options anchor on "Tabiya" ───────────────────────
    # With Bug 2 fixed, "Tabiya" should appear in at most 1 vignette's options.
    tabiya_count = sum(
        1 for t in vignette_turns
        if "tabiya" in t["message"].lower()
    )
    if len(vignette_turns) >= 3:
        assert tabiya_count <= 1, (
            f"'Tabiya' appeared in {tabiya_count}/{len(vignette_turns)} vignette messages. "
            "LLM is still anchoring on the user's current employer."
        )
