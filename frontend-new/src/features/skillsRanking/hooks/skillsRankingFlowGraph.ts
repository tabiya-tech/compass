import { SkillsRankingPhase, SkillsRankingExperimentGroups } from "../types";
import { SkillsRankingError } from "../errors";

// Flow path for groups that see market disclosure and retyped rank (groups 1 & 3)
export const skillsRankingHappyPathFull = [
  SkillsRankingPhase.INITIAL,
  SkillsRankingPhase.BRIEFING,
  SkillsRankingPhase.PROOF_OF_VALUE,
  SkillsRankingPhase.MARKET_DISCLOSURE,
  SkillsRankingPhase.JOB_SEEKER_DISCLOSURE,
  SkillsRankingPhase.PERCEIVED_RANK,
  SkillsRankingPhase.RETYPED_RANK,
  SkillsRankingPhase.COMPLETED,
];

// Flow path for groups that skip market disclosure and retyped rank (groups 2 & 4)
export const skillsRankingHappyPathSkipped = [
  SkillsRankingPhase.INITIAL,
  SkillsRankingPhase.BRIEFING,
  SkillsRankingPhase.PROOF_OF_VALUE,
  SkillsRankingPhase.JOB_SEEKER_DISCLOSURE,
  SkillsRankingPhase.PERCEIVED_RANK,
  SkillsRankingPhase.COMPLETED,
];

// Helper function to get the correct flow path for an experiment group
export const getFlowPathForGroup = (experimentGroup: SkillsRankingExperimentGroups) => {
  switch (experimentGroup) {
    case SkillsRankingExperimentGroups.GROUP_1:
    case SkillsRankingExperimentGroups.GROUP_3:
      return skillsRankingHappyPathFull;
    case SkillsRankingExperimentGroups.GROUP_2:
    case SkillsRankingExperimentGroups.GROUP_4:
      return skillsRankingHappyPathSkipped;
    default:
      console.error(new SkillsRankingError("Invalid experiment group." + experimentGroup));
      return skillsRankingHappyPathFull;
  }
};
