import { SkillsRankingExperimentGroups, SkillsRankingPhase, SkillsRankingScore, SkillsRankingState } from "../types";
import { getRandomString } from "src/_test_utilities/specialCharacters";

export const getRandomSkillsRankingState = (
  phase?: SkillsRankingPhase,
  experimentGroup?: SkillsRankingExperimentGroups
): SkillsRankingState => {
  const selectedPhase = phase ?? getRandomSkillsRankingPhase();
  const experiment_group = experimentGroup ?? getRandomExperimentGroup();
  const started_at = new Date().toISOString();
  const completed_at = selectedPhase === SkillsRankingPhase.COMPLETED ? new Date().toISOString() : undefined;
  const cancelled_after = Math.random() < 0.3 ? getRandomString(10) : undefined;
  const succeeded_after = Math.random() < 0.3 ? getRandomString(10) : undefined;
  const puzzles_solved = 0;
  const correct_rotations = 0;
  const clicks_count = 0;
  const prior_belief_percentile = Math.random() < 0.5 ? Math.floor(Math.random() * 100) : undefined;
  const prior_belief_for_skill_percentile = Math.random() < 0.5 ? Math.floor(Math.random() * 100) : undefined;
  const perceived_rank_percentile = Math.random() < 0.5 ? Math.floor(Math.random() * 100) : undefined;
  const perceived_rank_for_skill_percentile = Math.random() < 0.5 ? Math.floor(Math.random() * 100) : undefined;
  const application_willingness =
    Math.random() < 0.5 ? { value: Math.floor(Math.random() * 6) + 1, label: "Test Label" } : undefined;
  const application_24h = Math.random() < 0.5 ? Math.floor(Math.random() * 25) : undefined;
  const opportunity_skill_requirement_percentile = Math.random() < 0.5 ? Math.floor(Math.random() * 100) : undefined;
  const session_id = getRandomSessionID();
  const phaseHistory = [
    {
      name: selectedPhase,
      time: new Date().toISOString(),
    },
  ];

  const metadata: SkillsRankingState["metadata"] = {
    session_id,
    experiment_group,
    started_at,
  };
  if (completed_at) metadata.completed_at = completed_at;
  if (cancelled_after) metadata.cancelled_after = cancelled_after;
  if (succeeded_after) metadata.succeeded_after = succeeded_after;
  if (puzzles_solved) metadata.puzzles_solved = puzzles_solved;
  if (correct_rotations) metadata.correct_rotations = correct_rotations;
  if (clicks_count) metadata.clicks_count = clicks_count;

  const user_responses: SkillsRankingState["user_responses"] = {};
  if (prior_belief_percentile !== undefined) user_responses.prior_belief_percentile = prior_belief_percentile;
  if (prior_belief_for_skill_percentile !== undefined)
    user_responses.prior_belief_for_skill_percentile = prior_belief_for_skill_percentile;
  if (perceived_rank_percentile !== undefined) user_responses.perceived_rank_percentile = perceived_rank_percentile;
  if (perceived_rank_for_skill_percentile !== undefined)
    user_responses.perceived_rank_for_skill_percentile = perceived_rank_for_skill_percentile;
  if (application_willingness) user_responses.application_willingness = application_willingness;
  if (application_24h !== undefined) user_responses.application_24h = application_24h;
  if (opportunity_skill_requirement_percentile !== undefined)
    user_responses.opportunity_skill_requirement_percentile = opportunity_skill_requirement_percentile;

  return {
    phase: phaseHistory,
    metadata,
    user_responses,
    score: getRandomScore(),
  };
};

export const getRandomSkillsRankingPhase = (): SkillsRankingPhase => {
  const phases = Object.values(SkillsRankingPhase);
  return phases[Math.floor(Math.random() * phases.length)];
};

export const getRandomExperimentGroup = (): SkillsRankingExperimentGroups => {
  const groups = Object.values(SkillsRankingExperimentGroups);
  return groups[Math.floor(Math.random() * groups.length)];
};

export const getRandomScore = (): SkillsRankingScore => {
  return {
    above_average_labels: [getRandomString(10), getRandomString(10)],
    below_average_labels: [getRandomString(10)],
    most_demanded_label: getRandomString(10),
    most_demanded_percent: Math.random() * 100,
    least_demanded_label: getRandomString(10),
    least_demanded_percent: Math.random() * 100,
    average_percent_for_jobseeker_skillgroups: Math.random() * 100,
    average_count_for_jobseeker_skillgroups: Math.random() * 1000,
    province_used: getRandomString(10),
    matched_skillgroups: Math.floor(Math.random() * 10) + 1,
    calculated_at: new Date().toISOString(), // Current time in ISO format
  };
};

export function getRandomSessionID(): number {
  return Math.floor(Math.random() * 100000000) + 1; // Generates a random session ID between 1 and 100000000
}
