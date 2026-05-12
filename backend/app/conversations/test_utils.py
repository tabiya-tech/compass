import logging

import pytest

from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.agent.experience import WorkType, ExperienceEntity
from app.agent.explore_experiences_agent_director import ExperienceState, DiveInPhase
from app.application_state import ApplicationState
from app.conversations.constants import BEGINNING_CONVERSATION_PERCENTAGE, FINISHED_CONVERSATION_PERCENTAGE, \
    COLLECT_EXPERIENCES_PERCENTAGE, DIVE_IN_EXPERIENCES_PERCENTAGE, PREFERENCE_ELICITATION_PERCENTAGE, \
    RECOMMENDATION_PERCENTAGE
from app.conversations.types import ConversationPhaseResponse, CurrentConversationPhaseResponse
from app.conversations.utils import get_current_conversation_phase_response
from app.agent.explore_experiences_agent_director import ConversationPhase as CounselingConversationPhase
from common_libs.test_utilities import get_random_session_id

logger = logging.getLogger(__name__)

all_work_types = [
    WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT,
    WorkType.SELF_EMPLOYMENT,
    WorkType.FORMAL_SECTOR_UNPAID_TRAINEE_WORK,
    WorkType.UNSEEN_UNPAID
]


def _get_experience_entity() -> ExperienceEntity:
    return ExperienceEntity(
        experience_title="Foo",
    )


class TestConversationPhase:
    def test_new_conversation(self):
        # GIVEN a random session id
        given_session_id = get_random_session_id()

        # AND a brand-new application sate
        application_state = ApplicationState.new_state(session_id=given_session_id)

        # WHEN the conversation phase is calculated
        conversation_phase = get_current_conversation_phase_response(application_state, logger)

        # THEN the conversation phase is the initial phase, and the percentage is zero.
        assert conversation_phase == ConversationPhaseResponse(
            phase=CurrentConversationPhaseResponse.INTRO,
            percentage=BEGINNING_CONVERSATION_PERCENTAGE
        )

    def test_completed_conversation(self):
        # GIVEN a random session id
        given_session_id = get_random_session_id()

        # AND a completed conversation state
        application_state = ApplicationState.new_state(session_id=given_session_id)
        application_state.agent_director_state.current_phase = ConversationPhase.ENDED

        # WHEN the conversation phase is calculated
        conversation_phase = get_current_conversation_phase_response(application_state, logger)

        # THEN the conversation phase is the finished phase, and the percentage is 100.
        assert conversation_phase == ConversationPhaseResponse(
            phase=CurrentConversationPhaseResponse.ENDED,
            percentage=FINISHED_CONVERSATION_PERCENTAGE
        )

    @pytest.mark.parametrize("explored_work_types, expected_percentage", [
        (0, COLLECT_EXPERIENCES_PERCENTAGE),
        (1, COLLECT_EXPERIENCES_PERCENTAGE + 9),  # (1/4) * (40 - 5)
        (2, COLLECT_EXPERIENCES_PERCENTAGE + 17),  # (2/4) * (40 - 5)
        (3, COLLECT_EXPERIENCES_PERCENTAGE + 26),  # (3/4) * (40 - 5)
        (4, DIVE_IN_EXPERIENCES_PERCENTAGE)
    ])
    def test_n_explored_work_types(self, explored_work_types: int, expected_percentage: int):
        # GIVEN a random session id
        given_session_id = get_random_session_id()

        # AND a collect experiences phase with n explored work types
        application_state = ApplicationState.new_state(session_id=given_session_id)
        application_state.agent_director_state.current_phase = ConversationPhase.COUNSELING
        application_state.collect_experience_state.explored_types = all_work_types[:explored_work_types]

        # GUARD the unexplored work types are the rest of the work types.
        application_state.collect_experience_state.unexplored_types = [
            item for item in all_work_types if item not in application_state.collect_experience_state.explored_types
        ]

        # WHEN the conversation phase is calculated
        conversation_phase = get_current_conversation_phase_response(application_state, logger)

        # THEN the conversation phase is the collect experiences phase, and changed based on the explored work types.
        expected_current_work_type = explored_work_types + 1
        if expected_current_work_type > len(all_work_types):
            # if we have explored all work types, we should not count the current work type.
            expected_current_work_type = len(all_work_types)

        assert conversation_phase == ConversationPhaseResponse(
            phase=CurrentConversationPhaseResponse.COLLECT_EXPERIENCES,
            percentage=expected_percentage,
            current=expected_current_work_type,
            total=len(all_work_types)
        )

    @pytest.mark.parametrize("explored, total, expected_percentage", [
        (0, 10, DIVE_IN_EXPERIENCES_PERCENTAGE),
        (1, 10, DIVE_IN_EXPERIENCES_PERCENTAGE + 3),  # (1/10) * (70 - 40)
        (3, 10, DIVE_IN_EXPERIENCES_PERCENTAGE + 9),  # (3/10) * (70 - 40)
        (5, 10, DIVE_IN_EXPERIENCES_PERCENTAGE + 15),  # (5/10) * (70 - 40)
        (7, 10, DIVE_IN_EXPERIENCES_PERCENTAGE + 21),  # (7/10) * (70 - 40)
        (10, 10, PREFERENCE_ELICITATION_PERCENTAGE)  # Dive-in ends at preference elicitation phase
    ])
    def test_n_explored_experiences(self, explored: int, total: int, expected_percentage: int):
        # GIVEN a random session id
        given_session_id = get_random_session_id()

        # AND n experiences are already explored
        given_experiences_state = dict()
        for i in range(explored):
            given_experiences_state[f"explored_experience_{i}"] = ExperienceState(
                dive_in_phase=DiveInPhase.PROCESSED,
                experience=_get_experience_entity()
            )

        # AND (total - explored) experiences are unexplored
        for i in range(total - explored):
            given_experiences_state[f"not_explored_experience_{i}"] = ExperienceState(
                dive_in_phase=DiveInPhase.NOT_STARTED,
                experience=_get_experience_entity()
            )

        # and we are in dive in phase with n explored and (10 - n) unexplored experiences.
        application_state = ApplicationState.new_state(session_id=given_session_id)
        application_state.agent_director_state.current_phase = ConversationPhase.COUNSELING
        application_state.explore_experiences_director_state.conversation_phase = CounselingConversationPhase.DIVE_IN
        application_state.explore_experiences_director_state.experiences_state = given_experiences_state

        # WHEN the conversation phase is calculated
        conversation_phase = get_current_conversation_phase_response(application_state, logger)

        # THEN the conversation phase is the collect experiences phase, and changed based on the explored work types.
        # Current is capped at total to prevent showing "11/10 experiences"
        expected_current = explored + 1
        if expected_current > total:
            expected_current = total

        assert conversation_phase == ConversationPhaseResponse(
            phase=CurrentConversationPhaseResponse.DIVE_IN,
            percentage=expected_percentage,
            current=expected_current,
            total=total
        )


def _dive_in_state_with_pref_active() -> ApplicationState:
    """
    Build a state in COUNSELING/DIVE_IN with one fully-processed experience
    so the preference-elicitation branch becomes reachable when its sub-phase
    is something other than 'INTRO' / 'COMPLETE'.
    """
    session_id = get_random_session_id()
    state = ApplicationState.new_state(session_id=session_id)
    state.agent_director_state.current_phase = ConversationPhase.COUNSELING
    state.explore_experiences_director_state.conversation_phase = (
        CounselingConversationPhase.DIVE_IN
    )
    state.explore_experiences_director_state.experiences_state = {
        "exp_1": ExperienceState(
            dive_in_phase=DiveInPhase.PROCESSED,
            experience=_get_experience_entity(),
        )
    }
    return state


class TestPreferenceElicitationProgress:
    """
    Progress-bar correctness inside the PREFERENCE_ELICITATION journey phase.

    The percentage is partitioned across sub-phase bands within
    [PREFERENCE_ELICITATION_PERCENTAGE .. RECOMMENDATION_PERCENTAGE]:

        EXPERIENCE_QUESTIONS:  70
        VIGNETTES / FOLLOW_UP: 72 → 78  (each completed vignette = +0.5pp, capped at 12)
        GATE:                  78 → 80
        BWS:                   80 → 84
        WRAPUP:                85  (== RECOMMENDATION_PERCENTAGE — meets next phase)

    These tests pin the band boundaries and assert monotonicity across the
    end-to-end sub-phase sequence so the bar never jumps backward, especially
    on the transition out of WRAPUP into RECOMMENDATION.
    """

    def test_never_exceeds_recommendation_percentage(self):
        """
        Regression: the old formula used FINISHED_CONVERSATION_PERCENTAGE (100)
        as the band ceiling, so the bar could reach 100% during
        PREFERENCE_ELICITATION and then jump backward to 85% when
        RECOMMENDATION started. Ceiling must be RECOMMENDATION_PERCENTAGE.
        """
        state = _dive_in_state_with_pref_active()
        # Saturate every counter the formula reads, in every sub-phase.
        state.preference_elicitation_agent_state.completed_vignettes = [
            f"v{i}" for i in range(20)  # well past the cap of 12
        ]
        state.preference_elicitation_agent_state.gate_interventions_completed = 10
        state.preference_elicitation_agent_state.bws_tasks_completed = 20
        state.preference_elicitation_agent_state.categories_covered = [
            "financial", "work_environment", "job_security",
            "career_advancement", "work_life_balance", "task_preferences",
        ]
        state.preference_elicitation_agent_state.bws_phase_complete = True

        for sub in ("EXPERIENCE_QUESTIONS", "VIGNETTES", "FOLLOW_UP", "GATE", "BWS", "WRAPUP"):
            state.preference_elicitation_agent_state.conversation_phase = sub
            resp = get_current_conversation_phase_response(state, logger)
            assert resp.percentage <= RECOMMENDATION_PERCENTAGE, (
                f"sub-phase {sub} produced {resp.percentage}% — exceeds "
                f"RECOMMENDATION_PERCENTAGE ({RECOMMENDATION_PERCENTAGE})"
            )

    @pytest.mark.parametrize("sub_phase, expected_percentage", [
        ("EXPERIENCE_QUESTIONS", PREFERENCE_ELICITATION_PERCENTAGE),  # 70
        ("WRAPUP", RECOMMENDATION_PERCENTAGE),  # 85 — meets next phase
    ])
    def test_band_endpoints(self, sub_phase: str, expected_percentage: int):
        """
        EXPERIENCE_QUESTIONS sits at the lower band edge (70%); WRAPUP sits at
        the upper band edge (85%, == RECOMMENDATION_PERCENTAGE).
        """
        state = _dive_in_state_with_pref_active()
        state.preference_elicitation_agent_state.conversation_phase = sub_phase

        resp = get_current_conversation_phase_response(state, logger)

        assert resp.phase == CurrentConversationPhaseResponse.PREFERENCE_ELICITATION.value
        assert resp.percentage == expected_percentage
        assert resp.sub_phase == sub_phase

    @pytest.mark.parametrize("completed, expected_percentage", [
        (0, 72),   # band start
        (6, 75),   # mid-band: 72 + 6/12 * 6 = 75
        (12, 78),  # band end
        (20, 78),  # over-cap stays at band end
    ])
    def test_vignettes_band(self, completed: int, expected_percentage: int):
        state = _dive_in_state_with_pref_active()
        state.preference_elicitation_agent_state.conversation_phase = "VIGNETTES"
        state.preference_elicitation_agent_state.completed_vignettes = [f"v{i}" for i in range(completed)]

        resp = get_current_conversation_phase_response(state, logger)

        assert resp.percentage == expected_percentage
        assert resp.current is None
        assert resp.total is None

    def test_follow_up_does_not_double_count(self):
        """
        FOLLOW_UP shares the VIGNETTES band: it is a quality-refinement on the
        last vignette, not a new progress unit. Same completed_vignettes →
        same percentage whether we're in VIGNETTES or FOLLOW_UP.
        """
        state = _dive_in_state_with_pref_active()
        state.preference_elicitation_agent_state.completed_vignettes = ["v0", "v1", "v2"]

        state.preference_elicitation_agent_state.conversation_phase = "VIGNETTES"
        in_vignettes = get_current_conversation_phase_response(state, logger).percentage

        state.preference_elicitation_agent_state.conversation_phase = "FOLLOW_UP"
        in_follow_up = get_current_conversation_phase_response(state, logger).percentage

        assert in_vignettes == in_follow_up

    @pytest.mark.parametrize("interventions, expected_percentage", [
        (0, 78),
        (1, 79),  # 78 + 1/3 * 2 ≈ 78.67 → round(78.67) = 79
        (3, 80),
        (5, 80),  # over-cap stays at band end
    ])
    def test_gate_band(self, interventions: int, expected_percentage: int):
        state = _dive_in_state_with_pref_active()
        state.preference_elicitation_agent_state.conversation_phase = "GATE"
        state.preference_elicitation_agent_state.gate_interventions_completed = interventions

        resp = get_current_conversation_phase_response(state, logger)

        assert resp.percentage == expected_percentage

    @pytest.mark.parametrize("tasks, expected_percentage", [
        (0, 80),
        (6, 82),  # 80 + 6/12 * 4 = 82
        (12, 84),
        (20, 84),  # over-cap stays at band end
    ])
    def test_bws_band(self, tasks: int, expected_percentage: int):
        state = _dive_in_state_with_pref_active()
        state.preference_elicitation_agent_state.conversation_phase = "BWS"
        state.preference_elicitation_agent_state.bws_tasks_completed = tasks

        resp = get_current_conversation_phase_response(state, logger)

        assert resp.percentage == expected_percentage
        assert resp.current == min(tasks, 12)
        assert resp.total == 12

    def test_monotonic_across_full_sub_phase_sequence(self):
        """
        Walk the full sub-phase sequence and assert the percentage never
        decreases. Catches any future regression that re-introduces the
        BWS-transition jump or the WRAPUP→RECOMMENDATION jump-back.
        """
        state = _dive_in_state_with_pref_active()
        pref = state.preference_elicitation_agent_state

        timeline: list[tuple[str, float]] = []  # (label, percentage)

        # EXPERIENCE_QUESTIONS
        pref.conversation_phase = "EXPERIENCE_QUESTIONS"
        timeline.append(("EQ", get_current_conversation_phase_response(state, logger).percentage))

        # VIGNETTES — accumulate one vignette at a time, interleaving FOLLOW_UP
        pref.conversation_phase = "VIGNETTES"
        for i in range(12):
            pref.completed_vignettes.append(f"v{i}")
            timeline.append((f"VIGNETTE {i+1}",
                             get_current_conversation_phase_response(state, logger).percentage))
            # FOLLOW_UP turn: same completed_vignettes count → percentage must not drop
            pref.conversation_phase = "FOLLOW_UP"
            timeline.append((f"FOLLOW_UP {i+1}",
                             get_current_conversation_phase_response(state, logger).percentage))
            pref.conversation_phase = "VIGNETTES"

        # GATE
        pref.conversation_phase = "GATE"
        for n in range(3):
            pref.gate_interventions_completed = n + 1
            timeline.append((f"GATE {n+1}",
                             get_current_conversation_phase_response(state, logger).percentage))

        # BWS
        pref.conversation_phase = "BWS"
        for n in range(12):
            pref.bws_tasks_completed = n + 1
            timeline.append((f"BWS {n+1}",
                             get_current_conversation_phase_response(state, logger).percentage))

        # WRAPUP — meets RECOMMENDATION at 85
        pref.conversation_phase = "WRAPUP"
        timeline.append(("WRAPUP", get_current_conversation_phase_response(state, logger).percentage))

        # Next journey phase: RECOMMENDATION must NOT be lower than WRAPUP.
        state.agent_director_state.skip_to_phase = None
        state.agent_director_state.current_phase = ConversationPhase.ENDED
        timeline.append(("ENDED", get_current_conversation_phase_response(state, logger).percentage))

        # Assert strictly non-decreasing.
        previous_label, previous_pct = timeline[0]
        for label, pct in timeline[1:]:
            assert pct >= previous_pct, (
                f"progress went backward: {previous_label}={previous_pct}% -> {label}={pct}%\n"
                f"timeline: {timeline}"
            )
            previous_label, previous_pct = label, pct

        # And the WRAPUP percentage must equal RECOMMENDATION_PERCENTAGE so
        # the transition into the next journey phase is seamless.
        wrapup_pct = next(p for label, p in timeline if label == "WRAPUP")
        assert wrapup_pct == RECOMMENDATION_PERCENTAGE
