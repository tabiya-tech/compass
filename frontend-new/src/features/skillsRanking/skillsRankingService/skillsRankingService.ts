import { getBackendUrl } from "src/envService";
import { customFetch } from "src/utils/customFetch/customFetch";
import { StatusCodes } from "http-status-codes";
import {
  SkillsRankingConfig,
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
  isExperimentGroupKey
} from "src/features/skillsRanking/types";
import { FeaturesService } from "src/features/featuresService/FeaturesService";
import { SKILLS_RANKING_FEATURE_ID } from "src/features/skillsRanking/constants";
import { SkillsRankingError } from "../errors";
import { SkillsRankingMetrics } from "./types";

/**
 * Service to manage the skills ranking feature.
 */
export class SkillsRankingService extends FeaturesService{
  private static instance: SkillsRankingService;
  readonly skillsRankingEndpointUrl: string;
  readonly apiServerUrl: string;
  readonly featureId = SKILLS_RANKING_FEATURE_ID

  private constructor() {
    super();
    this.apiServerUrl = getBackendUrl();
    this.skillsRankingEndpointUrl = `${this.apiServerUrl}/${super.getFeatureAPIPrefix(this.featureId)}/conversations`;
  }

  /**
   * Get the singleton instance of the SkillsRankingService.
   * @returns {SkillsRankingService} The singleton instance of the SkillsRankingService.
   */
  static getInstance(): SkillsRankingService {
    if (!SkillsRankingService.instance) {
      SkillsRankingService.instance = new SkillsRankingService();
    }
    return SkillsRankingService.instance;
  }

  /**
   * Check if the skills ranking feature is enabled.
   */
  isSkillsRankingFeatureEnabled(): boolean {
      return super.isFeatureEnabled(this.featureId);
  }

  /**
   * Get the ranking state for a given session.
   *
   * @param sessionId - The ID of the session to get the ranking state for.
   * @returns {Promise<SkillsRankingState | null>} The ranking state for the session, or null if none exists.
   */
  async getSkillsRankingState(sessionId: number): Promise<SkillsRankingState | null> {
    const url = `${this.skillsRankingEndpointUrl}/${sessionId}/skills-ranking/state`;
    
    const response = await customFetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.OK,
      serviceName: "SkillsRankingService",
      serviceFunction: "getSkillsRankingState",
      failureMessage: `Failed to get skills ranking state for session ${sessionId}`,
      expectedContentType: "application/json",
    });

    const data = await response.json();
    if (data === null) {
      return null;
    }
    if (data.experiment_group && isExperimentGroupKey(data.experiment_group)){
      throw new SkillsRankingError(
        `Unknown experiment_group '${data.experiment_group}' from API`
      );
    }
    return {
      session_id: data.session_id,
      experiment_group: SkillsRankingExperimentGroups[data.experiment_group as keyof typeof SkillsRankingExperimentGroups],
      phase: data.phase,
      score: data.score,
      cancelled_after: data.cancelled_after ?? null,
      perceived_rank_percentile: data.perceived_rank_percentile ?? null,
      retyped_rank_percentile: data.retyped_rank_percentile ?? null,
      started_at: data.started_at,
      completed_at: data.completed_at ?? null,
    };
  }

  /**
   * Update the ranking state for a given session.
   *
   * @param sessionId - The ID of the session to update the ranking state for.
   * @param phase - The new current phase.
   *   This is only relevant for the effort-based proof_of_value task.
   *   This is only relevant for the time-based proof_of_value task.
   *     This is only relevant for the time-based proof_of_value task.
   * @param perceived_rank_percentile - Optional parameter indicating the user's perceived rank percentile (0-100).
   * @param retyped_rank_percentile - Optional parameter indicating the rank the user retyped to confirm they saw it correctly (0-100).
   * @param metrics
   * @returns {Promise<SkillsRankingState>} The updated ranking state for the session.
   */
  async updateSkillsRankingState(
    sessionId: number,
    phase: SkillsRankingPhase,
    perceived_rank_percentile?: number,
    retyped_rank_percentile?: number,
    metrics?: SkillsRankingMetrics
  ): Promise<SkillsRankingState> {
    const url = `${this.skillsRankingEndpointUrl}/${sessionId}/skills-ranking/state`;
    
    const response = await customFetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.ACCEPTED,
      serviceName: "SkillsRankingService",
      serviceFunction: "updateSkillsRankingState",
      failureMessage: `Failed to update skills ranking state for session ${sessionId}`,
      body: JSON.stringify({
        phase: phase,
        cancelled_after: metrics?.cancelled_after ?? null,
        perceived_rank_percentile: perceived_rank_percentile ?? null,
        retyped_rank_percentile: retyped_rank_percentile ?? null,
        succeeded_after: metrics?.succeeded_after ?? null,
        puzzles_solved: metrics?.puzzles_solved ?? null,
        correct_rotations: metrics?.correct_rotations ?? null,
        clicks_count: metrics?.clicks_count ?? null
      }),
      expectedContentType: "application/json",
    });

    const data = await response.json();

    if (data.experiment_group && isExperimentGroupKey(data.experiment_group)){
      throw new SkillsRankingError(
        `Unknown experiment_group '${data.experiment_group}' from API`
      );
    }

    return {
      session_id: data.session_id,
      experiment_group: SkillsRankingExperimentGroups[data.experiment_group as keyof typeof SkillsRankingExperimentGroups],
      phase: data.phase,
      score: data.score,
      cancelled_after: data.cancelled_after ?? null,
      perceived_rank_percentile: data.perceived_rank_percentile ?? null,
      retyped_rank_percentile: data.retyped_rank_percentile ?? null,
      started_at: data.started_at,
      completed_at: data.completed_at ?? null,
    };
  }

  public getConfig(): SkillsRankingConfig {
    return super.getConfig(this.featureId) as SkillsRankingConfig;
  }

  validateConfig (config: any): void {
    super.validateConfig(config);
    // check internal config properties inside the config.config
    if (!config.config.hasOwnProperty("airtimeBudget") || typeof config.config.airtimeBudget !== "string") {
      throw new Error(`Invalid configuration for feature ${this.featureId}: airtimeBudget must be a string`);
    }
    if (!config.config.hasOwnProperty("jobPlatformUrl") || typeof config.config.jobPlatformUrl !== "string") {
      throw new Error(`Invalid configuration for feature ${this.featureId}: jobPlatformUrl must be a string`);
    }
  }
}
