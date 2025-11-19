import { FeatureConfig } from "src/features/featuresService/FeaturesService";

export enum SkillsRankingExperimentGroups {
  /**
   * Group 1: Control
   * - Opportunity skill requirements are shown before disclosure.
   */
  GROUP_1 = "Group 1: Control",
  /**
   * Group 2: Treatment A
   * - Participants see disclosure before application willingness questions.
   * - Participants see only above average skills ranking results in disclosure
   */
  GROUP_2 = "Group 2: Treatment A",
  /**
   * Group 3: Treatment B
   * - Same flow as Group 2 but may differ in messaging/experience.
   * - Participants see both above and below average skills ranking results in disclosure
   */
  GROUP_3 = "Group 3: Treatment B",
}

/**
 * Validates if a value is a valid experiment group key.
 * @param value - The value to validate
 * @returns True if the value is a valid experiment group key
 */
export function isValidExperimentGroupKey(value: unknown): value is keyof typeof SkillsRankingExperimentGroups {
  return typeof value === "string" && Object.keys(SkillsRankingExperimentGroups).includes(value);
}

export enum SkillsRankingPhase {
  INITIAL = "INITIAL",
  BRIEFING = "BRIEFING",
  PROOF_OF_VALUE = "PROOF_OF_VALUE",
  PRIOR_BELIEF = "PRIOR_BELIEF",
  PRIOR_BELIEF_FOR_SKILL = "PRIOR_BELIEF_FOR_SKILL",
  DISCLOSURE = "DISCLOSURE",
  APPLICATION_WILLINGNESS = "APPLICATION_WILLINGNESS",
  APPLICATION_24H = "APPLICATION_24H",
  PERCEIVED_RANK = "PERCEIVED_RANK",
  PERCEIVED_RANK_FOR_SKILL = "PERCEIVED_RANK_FOR_SKILL",
  OPPORTUNITY_SKILL_REQUIREMENT = "OPPORTUNITY_SKILL_REQUIREMENT",
  COMPLETED = "COMPLETED",
}

export interface SkillsRankingPhaseWithTime {
  name: SkillsRankingPhase;
  time: string;
}

export interface SkillsRankingScore {
  /**
   * Skill group labels where the participant outperforms the job market average.
   */
  above_average_labels: string[];

  /**
   * Skill group labels where the participant underperforms compared to the job market average.
   */
  below_average_labels: string[];

  /**
   * Skill group with the highest demand in the participant's profile.
   */
  most_demanded_label: string;

  /**
   * Demand percentage for the most demanded skill group.
   */
  most_demanded_percent: number;

  /**
   * Skill group with the lowest demand in the participant's profile.
   */
  least_demanded_label: string;

  /**
   * Demand percentage for the least demanded skill group.
   */
  least_demanded_percent: number;

  /**
   * Average demand percentage across the participant's matched skill groups.
   */
  average_percent_for_jobseeker_skillgroups: number;

  /**
   * Average job count across the participant's matched skill groups.
   */
  average_count_for_jobseeker_skillgroups: number;

  /**
   * Province reference used for the demand comparison.
   */
  province_used: string;

  /**
   * Number of skill groups matched to the participant.
   */
  matched_skillgroups: number;

  /**
   * The time the score was calculated, in ISO format, in UTC.
   */
  calculated_at: string;
}

export interface SkillsRankingMetadata {
  session_id: number;
  experiment_group: SkillsRankingExperimentGroups;
  started_at: string;
  completed_at?: string;
  cancelled_after?: string;
  succeeded_after?: string;
  puzzles_solved?: number;
  correct_rotations?: number;
  clicks_count?: number;
}

export interface ApplicationWillingness {
  value: number;
  label: string;
}

export interface SkillsRankingUserResponses {
  prior_belief_percentile?: number;
  prior_belief_for_skill_percentile?: number;
  perceived_rank_percentile?: number;
  perceived_rank_for_skill_percentile?: number;
  application_willingness?: ApplicationWillingness;
  application_24h?: number;
  opportunity_skill_requirement_percentile?: number;
}

export interface SkillsRankingState {
  phase: SkillsRankingPhaseWithTime[];
  score: SkillsRankingScore;
  metadata: SkillsRankingMetadata;
  user_responses: SkillsRankingUserResponses;
}

/**
 * Represents the type of effort required for the skills ranking task.
 */
export enum EffortType {
  TIME_BASED = "time_based",
  WORK_BASED = "work_based",
}

/**
 * Metrics collected during the skills ranking process.
 * Used for tracking user behavior and performance.
 */
export type SkillsRankingMetrics = {
  cancelled_after?: string;
  succeeded_after?: string;
  puzzles_solved?: number;
  correct_rotations?: number;
  clicks_count?: number;
};

export interface SkillsRankingConfig extends FeatureConfig {
  config: {
    /**
     * The amount of compensation (perhaps in airtime) the user will receive for completing the skills ranking process.
     */
    compensationAmount: string;
    /**
     * The minimum time in seconds the user must spend on the skills ranking process.
     */
    jobPlatformUrl: string;
    /**
     * Short typing duration in milliseconds for quick transitions.
     */
    shortTypingDurationMs: number;
    /**
     * Default typing duration in milliseconds for standard transitions.
     */
    defaultTypingDurationMs: number;
    /**
     * Long typing duration in milliseconds for extended transitions.
     */
    longTypingDurationMs: number;
  };
}

/**
 * Utility function to get the latest phase from a skills ranking state.
 * @param state - The skills ranking state
 * @returns The latest phase or undefined if no phases exist
 */
export function getLatestPhase(state: SkillsRankingState): SkillsRankingPhaseWithTime | undefined {
  return state.phase[state.phase.length - 1];
}

/**
 * Utility function to get the latest phase name from a skills ranking state.
 * @param state - The skills ranking state
 * @returns The latest phase name or undefined if no phases exist
 */
export function getLatestPhaseName(state: SkillsRankingState): SkillsRankingPhase | undefined {
  return getLatestPhase(state)?.name;
}
