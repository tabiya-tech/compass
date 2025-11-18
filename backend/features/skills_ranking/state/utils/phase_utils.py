from features.skills_ranking.state.services.type import (
    SkillRankingExperimentGroup,
    SkillsRankingPhaseName,
)

_GROUP_PHASE_SEQUENCE: dict[SkillRankingExperimentGroup, list[SkillsRankingPhaseName]] = {
    SkillRankingExperimentGroup.GROUP_1: [
        "INITIAL",
        "BRIEFING",
        "PROOF_OF_VALUE",
        "PRIOR_BELIEF",
        "PRIOR_BELIEF_FOR_SKILL",
        "OPPORTUNITY_SKILL_REQUIREMENT",
        "DISCLOSURE",
        "COMPLETED",
    ],
    SkillRankingExperimentGroup.GROUP_2: [
        "INITIAL",
        "BRIEFING",
        "PROOF_OF_VALUE",
        "PRIOR_BELIEF",
        "PRIOR_BELIEF_FOR_SKILL",
        "DISCLOSURE",
        "APPLICATION_WILLINGNESS",
        "APPLICATION_24H",
        "PERCEIVED_RANK",
        "PERCEIVED_RANK_FOR_SKILL",
        "OPPORTUNITY_SKILL_REQUIREMENT",
        "COMPLETED",
    ],
    SkillRankingExperimentGroup.GROUP_3: [
        "INITIAL",
        "BRIEFING",
        "PROOF_OF_VALUE",
        "PRIOR_BELIEF",
        "PRIOR_BELIEF_FOR_SKILL",
        "DISCLOSURE",
        "APPLICATION_WILLINGNESS",
        "APPLICATION_24H",
        "PERCEIVED_RANK",
        "PERCEIVED_RANK_FOR_SKILL",
        "OPPORTUNITY_SKILL_REQUIREMENT",
        "COMPLETED",
    ],
}


def get_possible_next_phase(current_phase: SkillsRankingPhaseName,
                            experiment_group: SkillRankingExperimentGroup) -> list[SkillsRankingPhaseName]:
    """
    Returns the list of possible next phases based on the current phase and experiment group.
    Includes the current phase to allow metrics-only updates.
    """
    sequence = _GROUP_PHASE_SEQUENCE.get(experiment_group, [])
    if not sequence or current_phase not in sequence:
        return []

    current_index = sequence.index(current_phase)
    if current_index == len(sequence) - 1:
        # Terminal state
        return [current_phase]

    next_phase = sequence[current_index + 1]
    return [current_phase, next_phase]