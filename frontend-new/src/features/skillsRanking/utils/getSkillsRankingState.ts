import { SkillsRankingExperimentGroups, SkillsRankingPhase, SkillsRankingScore, SkillsRankingState } from "../types";
import { getRandomString } from "src/_test_utilities/specialCharacters";
import { jobSeekerComparisonLabels } from "../components/skillsRankingDisclosure/types";

export const getRandomSkillsRankingState = (phase?: SkillsRankingPhase, experimentGroup?: SkillsRankingExperimentGroups) : SkillsRankingState => {
  return {
    phase: phase ?? getRandomSkillsRankingPhase(),
    session_id: getRandomSessionID(),
    score: getRandomScore(),
    experiment_group: experimentGroup ?? getRandomExperimentGroup(),
    cancelled_after: phase === SkillsRankingPhase.CANCELLED ? getRandomString(10) : null, // Random string or null
    succeeded_after: phase === SkillsRankingPhase.CANCELLED ? getRandomString(10) : null,
    puzzles_solved: 0,
    correct_rotations: 0,
    clicks_count:0,
    perceived_rank_percentile: Math.random() < 0.5 ? Math.floor(Math.random() * 100) + 1 : null, // Random percentile or null
    retyped_rank_percentile: Math.random() < 0.5 ? Math.floor(Math.random() * 100) + 1 : null, // Random percentile or null
    started_at: new Date().toISOString(), // Current time in ISO format
    completed_at: phase === SkillsRankingPhase.COMPLETED ? new Date().toISOString() : null, // Set completed_at if phase is COMPLETED

  };
}

export const getRandomSkillsRankingPhase = (): SkillsRankingPhase => {
  const phases = Object.values(SkillsRankingPhase);
  return phases[Math.floor(Math.random() * phases.length)];
}

export const getRandomExperimentGroup = () : SkillsRankingExperimentGroups => {
  const groups = Object.values(SkillsRankingExperimentGroups);
  return groups[Math.floor(Math.random() * groups.length)];
}

export const getRandomScore = () : SkillsRankingScore => {
  return {
    jobs_matching_rank: Math.floor(Math.random() * 100) + 1, // Random rank between 1 and 100
    comparison_rank: Math.floor(Math.random() * 100) + 1, // Random comparison rank between 1 and 100
    comparison_label: getRandomComparisonLabel(), // Random label from the predefined set
    calculated_at: new Date().toISOString(), // Current time in ISO format
  };
}

export const getRandomComparisonLabel = (): string => {
  return jobSeekerComparisonLabels[Math.floor(Math.random() * jobSeekerComparisonLabels.length)];
}

export function getRandomSessionID(): number {
  return Math.floor(Math.random() * 100000000) + 1; // Generates a random session ID between 1 and 100000000
}