import { FeatureConfig } from "../featuresService/FeaturesService";

export enum SkillsRankingExperimentGroups {
  GROUP_1 = "Group 1: High Difference/Greater",
  /**
   * Group 1: High Difference/Greater
   * - time based effort task
   * - see ranking results.
   * - confirm they've seen the ranking results
   */
  GROUP_2 = "Group 2: High Difference/Smaller",
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
  GROUP_3 = "Group 3: Underconfidence/Yes",

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
  GROUP_4 = "Group 4: Underconfidence/No"
  /**
   * Group 4: Underconfidence/No
   * - time based effort task
   * - not see ranking results.
   */
}

// REVIEW: isExperimentGroupValid()
export function isExperimentGroupKey(
  value: unknown
): value is keyof typeof SkillsRankingExperimentGroups {
  return (
    typeof value === "string" &&
    value in Object.keys(SkillsRankingExperimentGroups)
  );
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
  // REVIEW: phases, it should be clear on how the order looks like, And how to get the most recent phase.
    //       in the comments, add that the last phase is the most recent one. it is a Stack (Inverse Stack) structure.
  phase: SkillsRankingPhaseWithTime[];

  /**
   * The full phase history of the skills ranking process.
   */
  score: SkillsRankingScore;

  /**
   * The score given to the user as compared to other job seekers and the job market.
   */
  // REVIEW: Suggestion not ideal: move these metrics in an object which can be null on GROUP_1 and GROUP_4 and be available on GROUP_2 and GROUP_3
  // Like we did for the `SkillsRankingScore`, perhaps this is a major change.
  // so that it is clear on how validation might work on backend or when analysing data.

  // REVIEW: Clarify why undefined | null, in this case. I think we can keep (undefined) for better type safety, but null is not needed I think.
  cancelled_after?: string;
  /**
   * Represents the time in ms spent by the user before they cancelled the skills ranking process.
   */
  succeeded_after?: string;
  /**
   * Represents the time in ms spent by the user before they finishing the skills ranking process.
   */
  puzzles_solved?:number,
  /**
   * The number of puzzles the user solved for the proof_of_value task during the skills ranking process.
   *     This is only relevant for the effort-based proof_of_value task.
   */
  correct_rotations?:number,
  /**
   * The number of characters the user rotated correctly for the proof_of_value task during the skills ranking process.
   *     This is only relevant for the time-based proof_of_value task.
   */
  clicks_count?:number,
  /**
   * The number of clicks the user made during the proof_of_value task. character selection, rotation [clockwise/counter-clockwise]
   *     This is only relevant for the time-based proof_of_value task.
   */

  perceived_rank_percentile?: number;
  /**
   * The percentile rank the user thinks they have (0-100)
   */
  retyped_rank_percentile?: number;
  /**
   * The rank the user retyped to confirm they saw it correctly (0-100)
   */
  started_at: string;
  /**
   * The time the skills ranking process started, in ISO format, in UTC.
   */
  completed_at?: string | null;
  /**
   * The time the skills ranking process completed, in ISO format, in UTC.
   */
}

export interface SkillsRankingConfig extends FeatureConfig{
  config: {
    /**
     * The amount of airtime the user will receive for completing the skills ranking process.
     */
    airtimeBudget: string;
    /**
     * The minimum time in seconds the user must spend on the skills ranking process.
     */
    jobPlatformUrl: string;
  }
}