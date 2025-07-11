import { SkillsRankingPhase } from "../types";

export const skillsRankingHappyPath = [
  SkillsRankingPhase.INITIAL,
  SkillsRankingPhase.BRIEFING,
  SkillsRankingPhase.EFFORT,
  SkillsRankingPhase.DISCLOSURE,
  SkillsRankingPhase.PERCEIVED_RANK,
  SkillsRankingPhase.RETYPED_RANK,
  SkillsRankingPhase.COMPLETED
]

export const skillsRankingSadPath = [
  SkillsRankingPhase.INITIAL,
  SkillsRankingPhase.BRIEFING,
  SkillsRankingPhase.EFFORT,
  SkillsRankingPhase.CANCELLED
]