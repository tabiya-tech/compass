import { FeatureConfig } from "src/features/featuresService/FeaturesService";

export enum SkillsRankingExperimentGroups {
  /**
   * Group 1: High Difference/Greater
   * - time based effort task
   * - see ranking results.
   * - confirm they've seen the ranking results
   */
  GROUP_1 = "Group 1: High Difference/Greater",
  /**
   * Group 2: High Difference/Smaller
   * - work based effort task
   *
   *  Note: original: not see ranking results.
   *
   *  95%
   *    not see ranking results.
   *  5%
   *    if solved _30_ characters:-
   *       - see the result
   *    else:
   *      - not see the result
   */
  GROUP_2 = "Group 2: High Difference/Smaller",
  /**
   * Group 3: Underconfidence/Yes
   * - work based effort task
   *
   * Note: original: see ranking results.
   *  95%
   *    see ranking results.
   *  5%
   *    if solved _30_ characters:-
   *       - see the result
   *    else:
   *      - not see the result
   */
  GROUP_3 = "Group 3: Underconfidence/Yes",
  /**
   * Group 4: Underconfidence/No
   * - time based effort task
   * - not see ranking results.
   */
  GROUP_4 = "Group 4: Underconfidence/No",
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
  MARKET_DISCLOSURE = "MARKET_DISCLOSURE",
  JOB_SEEKER_DISCLOSURE = "JOB_SEEKER_DISCLOSURE",
  PERCEIVED_RANK = "PERCEIVED_RANK",
  RETYPED_RANK = "RETYPED_RANK",
  COMPLETED = "COMPLETED",
}

export interface SkillsRankingPhaseWithTime {
  name: SkillsRankingPhase;
  time: string;
}

export interface SkillsRankingScore {
  /**
   * The rank of the user as compared to the job market.
   */

  jobs_matching_rank: number;

  /**
   * The rank of the user as compared to other job seekers.
   */
  comparison_rank: number;

  /**
   * The label of the comparison rank, LOWEST, SECOND_LOWEST, MIDDLE, SECOND_HIGHEST, HIGHEST.
   */
  comparison_label: string;

  /**
   * The time the score was calculated, in ISO format, in UTC.
   */
  calculated_at: string;
}

export interface SkillsRankingState {
  session_id: number;
  /**
   * session id - the session ranking will be made on
   */
  experiment_group: SkillsRankingExperimentGroups;
  /**
   * the group the user is assigned for each experiment branch
   */
  /**
   * The full phase history of the skills ranking process.
   * Note: This is a stack structure where the last element is the most recent phase.
   * The phases are ordered chronologically with the most recent phase at the end.
   */
  phases: SkillsRankingPhaseWithTime[];

  /**
   * The score given to the user as compared to other job seekers and the job market.
   */
  score: SkillsRankingScore;

  /**
   * Represents the time in ms spent by the user before they cancelled the skills ranking process.
   * Only available for GROUP_2 and GROUP_3 (work-based effort tasks).
   */
  cancelled_after?: string;

  /**
   * Represents the time in ms spent by the user before they finished the skills ranking process.
   * Only available for GROUP_2 and GROUP_3 (work-based effort tasks).
   */
  succeeded_after?: string;

  /**
   * The number of puzzles the user solved for the proof_of_value task during the skills ranking process.
   * Only relevant for the work-based proof_of_value task (GROUP_2 and GROUP_3).
   */
  puzzles_solved?: number;

  /**
   * The number of characters the user rotated correctly for the proof_of_value task during the skills ranking process.
   * Only relevant for the time-based proof_of_value task (GROUP_1 and GROUP_4).
   */
  correct_rotations?: number;

  /**
   * The number of clicks the user made during the proof_of_value task.
   * Includes character selection and rotation [clockwise/counter-clockwise].
   * Only relevant for the time-based proof_of_value task (GROUP_1 and GROUP_4).
   */
  clicks_count?: number;

  /**
   * The percentile rank the user thinks they have (0-100).
   * Only available for groups that see ranking results.
   */
  perceived_rank_percentile?: number;

  /**
   * The rank the user retyped to confirm they saw it correctly (0-100).
   * Only available for groups that see ranking results.
   */
  retyped_rank_percentile?: number;

  /**
   * The time the skills ranking process started, in ISO format, in UTC.
   */
  started_at: string;

  /**
   * The time the skills ranking process completed, in ISO format, in UTC.
   */
  completed_at?: string;
  /**
   * The time the skills ranking process completed, in ISO format, in UTC.
   */
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
  return state.phases[state.phases.length - 1];
}

/**
 * Utility function to get the latest phase name from a skills ranking state.
 * @param state - The skills ranking state
 * @returns The latest phase name or undefined if no phases exist
 */
export function getLatestPhaseName(state: SkillsRankingState): SkillsRankingPhase | undefined {
  return state.phases[state.phases.length - 1]?.name;
}
