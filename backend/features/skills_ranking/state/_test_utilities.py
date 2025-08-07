from common_libs.time_utilities import get_now, truncate_microseconds
from features.skills_ranking.state.services.type import SkillsRankingPhaseName, SkillRankingExperimentGroup, \
    SkillsRankingState, SkillsRankingPhase
from features.skills_ranking.types import SkillsRankingScore


def get_skills_ranking_state(
        session_id: int = 1,
        phase: SkillsRankingPhaseName = "INITIAL",
        correct_rotations=1,
        experiment_group: SkillRankingExperimentGroup = SkillRankingExperimentGroup.GROUP_1
) -> SkillsRankingState:
    return SkillsRankingState(
        session_id=session_id,
        phase=[SkillsRankingPhase(
            name=phase,
            time=truncate_microseconds(get_now())
        )],
        experiment_group=experiment_group,
        score=SkillsRankingScore(
            calculated_at=truncate_microseconds(get_now()),
            jobs_matching_rank=0.0,
            comparison_rank=0.0,
            comparison_label="LOWEST"
        ),
        started_at=truncate_microseconds(get_now()),
        completed_at=None,
        cancelled_after="Fooms",
        succeeded_after="Fooms",
        puzzles_solved=2 if phase == "PROOF_OF_VALUE" and (
                    experiment_group == SkillRankingExperimentGroup.GROUP_2 or experiment_group == SkillRankingExperimentGroup.GROUP_3) else None,
        correct_rotations=correct_rotations if phase == "PROOF_OF_VALUE" and (
                    experiment_group == SkillRankingExperimentGroup.GROUP_2 or experiment_group == SkillRankingExperimentGroup.GROUP_3) else None,
        clicks_count=10 if phase == "PROOF_OF_VALUE" and (
                    experiment_group == SkillRankingExperimentGroup.GROUP_2 or experiment_group == SkillRankingExperimentGroup.GROUP_3) else None,
        perceived_rank_percentile=0.1,
        retyped_rank_percentile=0.9
    )
