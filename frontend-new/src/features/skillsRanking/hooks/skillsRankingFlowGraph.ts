import { SkillsRankingPhase, SkillsRankingExperimentGroups } from "../types";
import { SkillsRankingError } from "../errors";

// Flow path for Group 1 (Control): Opportunity skill requirements shown before disclosure
export const skillsRankingGroup1Path = [
  SkillsRankingPhase.INITIAL,
  SkillsRankingPhase.BRIEFING,
  SkillsRankingPhase.PROOF_OF_VALUE,
  SkillsRankingPhase.PRIOR_BELIEF,
  SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL,
  SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT,
  SkillsRankingPhase.DISCLOSURE,
  SkillsRankingPhase.COMPLETED
];

// Flow path for Groups 2 & 3 (Treatment A & B): Disclosure before application willingness questions
export const skillsRankingGroup2And3Path = [
  SkillsRankingPhase.INITIAL,
  SkillsRankingPhase.BRIEFING,
  SkillsRankingPhase.PROOF_OF_VALUE,
  SkillsRankingPhase.PRIOR_BELIEF,
  SkillsRankingPhase.PRIOR_BELIEF_FOR_SKILL,
  SkillsRankingPhase.DISCLOSURE,
  SkillsRankingPhase.APPLICATION_WILLINGNESS,
  SkillsRankingPhase.APPLICATION_24H,
  SkillsRankingPhase.PERCEIVED_RANK,
  SkillsRankingPhase.PERCEIVED_RANK_FOR_SKILL,
  SkillsRankingPhase.OPPORTUNITY_SKILL_REQUIREMENT,
  SkillsRankingPhase.COMPLETED
];

// Helper function to get the correct flow path for an experiment group
export const getFlowPathForGroup = (experimentGroup: SkillsRankingExperimentGroups) => {
  switch (experimentGroup) {
    case SkillsRankingExperimentGroups.GROUP_1:
      return skillsRankingGroup1Path;
    case SkillsRankingExperimentGroups.GROUP_2:
    case SkillsRankingExperimentGroups.GROUP_3:
      return skillsRankingGroup2And3Path;
    default:
      console.error(new SkillsRankingError("Invalid experiment group: " + experimentGroup));
      return skillsRankingGroup1Path;
  }
};
