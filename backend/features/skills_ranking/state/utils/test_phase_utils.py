from features.skills_ranking.state.services.type import SkillRankingExperimentGroup
from features.skills_ranking.state.utils.phase_utils import get_possible_next_phase


def test_get_possible_next_states_group1():
    assert get_possible_next_phase("INITIAL", SkillRankingExperimentGroup.GROUP_1) == ["INITIAL", "BRIEFING"]
    assert get_possible_next_phase("BRIEFING", SkillRankingExperimentGroup.GROUP_1) == ["BRIEFING", "PROOF_OF_VALUE"]
    assert get_possible_next_phase("PROOF_OF_VALUE", SkillRankingExperimentGroup.GROUP_1) == ["PROOF_OF_VALUE", "PRIOR_BELIEF"]
    assert get_possible_next_phase("PRIOR_BELIEF", SkillRankingExperimentGroup.GROUP_1) == ["PRIOR_BELIEF", "PRIOR_BELIEF_FOR_SKILL"]
    assert get_possible_next_phase("PRIOR_BELIEF_FOR_SKILL", SkillRankingExperimentGroup.GROUP_1) == [
        "PRIOR_BELIEF_FOR_SKILL",
        "OPPORTUNITY_SKILL_REQUIREMENT",
    ]
    assert get_possible_next_phase("OPPORTUNITY_SKILL_REQUIREMENT", SkillRankingExperimentGroup.GROUP_1) == [
        "OPPORTUNITY_SKILL_REQUIREMENT",
        "DISCLOSURE",
    ]
    assert get_possible_next_phase("DISCLOSURE", SkillRankingExperimentGroup.GROUP_1) == ["DISCLOSURE", "COMPLETED"]
    assert get_possible_next_phase("COMPLETED", SkillRankingExperimentGroup.GROUP_1) == ["COMPLETED"]


def test_get_possible_next_states_group2():
    assert get_possible_next_phase("INITIAL", SkillRankingExperimentGroup.GROUP_2) == ["INITIAL", "BRIEFING"]
    assert get_possible_next_phase("PRIOR_BELIEF_FOR_SKILL", SkillRankingExperimentGroup.GROUP_2) == [
        "PRIOR_BELIEF_FOR_SKILL",
        "DISCLOSURE",
    ]
    assert get_possible_next_phase("DISCLOSURE", SkillRankingExperimentGroup.GROUP_2) == [
        "DISCLOSURE",
        "APPLICATION_WILLINGNESS",
    ]
    assert get_possible_next_phase("APPLICATION_WILLINGNESS", SkillRankingExperimentGroup.GROUP_2) == [
        "APPLICATION_WILLINGNESS",
        "APPLICATION_24H",
    ]
    assert get_possible_next_phase("APPLICATION_24H", SkillRankingExperimentGroup.GROUP_2) == [
        "APPLICATION_24H",
        "PERCEIVED_RANK",
    ]
    assert get_possible_next_phase("PERCEIVED_RANK_FOR_SKILL", SkillRankingExperimentGroup.GROUP_2) == [
        "PERCEIVED_RANK_FOR_SKILL",
        "OPPORTUNITY_SKILL_REQUIREMENT",
    ]
    assert get_possible_next_phase("OPPORTUNITY_SKILL_REQUIREMENT", SkillRankingExperimentGroup.GROUP_2) == [
        "OPPORTUNITY_SKILL_REQUIREMENT",
        "COMPLETED",
    ]
    assert get_possible_next_phase("COMPLETED", SkillRankingExperimentGroup.GROUP_2) == ["COMPLETED"]
