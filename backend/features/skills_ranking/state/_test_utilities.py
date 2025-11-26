from common_libs.test_utilities import get_random_printable_string
from common_libs.time_utilities import get_now, truncate_microseconds
from features.skills_ranking.state.services.type import (
    ApplicationWillingness,
    SkillsRankingPhaseName,
    SkillRankingExperimentGroup,
    SkillsRankingPhase,
    SkillsRankingState,
    ProcessMetadata,
    UserResponses,
    UserReassignmentMetadata,
)
from features.skills_ranking.types import SkillsRankingScore


def get_skills_ranking_state(
        session_id: int = 1,
        phase: SkillsRankingPhaseName = "INITIAL",
        correct_rotations: int = 1,
        experiment_group: SkillRankingExperimentGroup = SkillRankingExperimentGroup.GROUP_1,
        user_reassigned: UserReassignmentMetadata | None = None,
) -> SkillsRankingState:
    is_proof_of_value_phase = phase == "PROOF_OF_VALUE"

    return SkillsRankingState(
        session_id=session_id,
        phase=[SkillsRankingPhase(
            name=phase,
            time=truncate_microseconds(get_now())
        )],
        metadata=ProcessMetadata(
            experiment_group=experiment_group,
            started_at=truncate_microseconds(get_now()),
            completed_at=None,
            cancelled_after="Fooms",
            succeeded_after="Fooms",
            puzzles_solved=2 if is_proof_of_value_phase else None,
            correct_rotations=correct_rotations if is_proof_of_value_phase else None,
            clicks_count=10 if is_proof_of_value_phase else None,
            user_reassigned=user_reassigned,
        ),
        score=SkillsRankingScore(
            calculated_at=truncate_microseconds(get_now()),
            above_average_labels=[get_random_printable_string(8)],
            below_average_labels=[get_random_printable_string(8)],
            most_demanded_label=get_random_printable_string(8),
            most_demanded_percent=75.5,
            least_demanded_label=get_random_printable_string(8),
            least_demanded_percent=10.0,
            average_percent_for_jobseeker_skill_groups=50.0,
            average_count_for_jobseeker_skill_groups=250.0,
            province_used=get_random_printable_string(8),
            matched_skill_groups=5,
        ),
        user_responses=UserResponses(
            prior_belief_percentile=42.0,
            prior_belief_for_skill_percentile=55.0,
            perceived_rank_percentile=0.1,
            perceived_rank_for_skill_percentile=0.9,
            application_willingness=ApplicationWillingness(value=3, label="Maybe"),
            application_24h=5,
            opportunity_skill_requirement_percentile=60.0
        )
    )
