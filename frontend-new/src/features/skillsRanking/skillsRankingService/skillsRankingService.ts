import { getBackendUrl } from "src/envService";
import { customFetch } from "src/utils/customFetch/customFetch";
import { StatusCodes } from "http-status-codes";
import {
  isValidExperimentGroupKey,
  SkillsRankingConfig,
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { FeaturesService } from "src/features/featuresService/FeaturesService";
import { SKILLS_RANKING_FEATURE_ID } from "src/features/skillsRanking/constants";
import { SkillsRankingError } from "../errors";
import { SkillsRankingMetrics } from "../types";
import debounce from "lodash.debounce";

// Simple debounced metrics updater
const createDebouncedMetricsUpdater = (
  sessionId: number,
  updateFunction: (sessionId: number, metrics: SkillsRankingMetrics) => Promise<any>,
  debounceDelay: number = 2000
) => {
  let lastMetrics: SkillsRankingMetrics | null = null;

  const sendUpdate = async (metrics: SkillsRankingMetrics) => {
    // Don't send if metrics haven't changed
    if (
      lastMetrics &&
      lastMetrics.puzzles_solved === metrics.puzzles_solved &&
      lastMetrics.correct_rotations === metrics.correct_rotations &&
      lastMetrics.clicks_count === metrics.clicks_count
    ) {
      return;
    }

    try {
      await updateFunction(sessionId, metrics);
      lastMetrics = { ...metrics };
    } catch (err) {
      console.error("Failed to update metrics", err);
    }
  };

  const debouncedUpdate = debounce(sendUpdate, debounceDelay);

  return {
    update: (metrics: SkillsRankingMetrics) => {
      debouncedUpdate(metrics);
    },

    forceUpdate: (metrics: SkillsRankingMetrics) => {
      debouncedUpdate.flush();
      sendUpdate(metrics);
    },

    abort: () => {
      debouncedUpdate.cancel();
    },

    cleanup: () => {
      debouncedUpdate.cancel();
    },
  };
};

/**
 * Service to manage the skills ranking feature.
 */
export class SkillsRankingService extends FeaturesService {
  private static instance: SkillsRankingService;
  readonly skillsRankingEndpointUrl: string;
  readonly apiServerUrl: string;
  readonly featureId = SKILLS_RANKING_FEATURE_ID;

  private constructor() {
    super(SKILLS_RANKING_FEATURE_ID);
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
   * Check if the skills ranking feature is enabled
   */
  isSkillsRankingFeatureEnabled(): boolean {
    return super.isFeatureEnabled();
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
      retryOnFailedToFetch: true
    });

    const data = await response.json();
    if (data === null) {
      return null;
    }

    return this.mapStateResponse(data);
  }

  /**
   * Update the ranking state for a given session.
   *
   * @param sessionId - The ID of the session to update the ranking state for.
   * @param phase - The new current phase.
   * @param options - Optional parameters for updating the state.
   * @param options.perceived_rank_percentile - Optional parameter indicating the user's perceived rank percentile (0-100).
   * @param options.perceived_rank_for_skill - Optional parameter indicating the user's perceived rank for a specific skill (0-100).
   * @param options.prior_belief - Optional parameter indicating the user's prior belief (0-100).
   * @param options.prior_belief_for_skill - Optional parameter indicating the user's prior belief for a specific skill (0-100).
   * @param options.application_willingness - Optional parameter indicating the user's application willingness (value + label).
   * @param options.application_24h - Optional parameter indicating number of applications willing to submit within 24 hours (0-24).
   * @param options.opportunity_skill_requirement - Optional parameter indicating required skill percentile for the opportunity (0-100).
   * @param metrics - Optional metrics for effort task tracking.
   * @returns {Promise<SkillsRankingState>} The updated ranking state for the session.
   */
  async updateSkillsRankingState(
    sessionId: number,
    phase: SkillsRankingPhase,
    options?: {
      perceived_rank_percentile?: number;
      perceived_rank_for_skill?: number;
      prior_belief?: number;
      prior_belief_for_skill?: number;
      application_willingness?: { value: number; label: string };
      application_24h?: number;
      opportunity_skill_requirement?: number;
    },
    metrics?: SkillsRankingMetrics
  ): Promise<SkillsRankingState> {
    const url = `${this.skillsRankingEndpointUrl}/${sessionId}/skills-ranking/state`;

    // Build request body based on phase validation rules
    const body: Record<string, unknown> = {
      phase,
    };

    const metadataPayload = {
      cancelled_after: metrics?.cancelled_after,
      succeeded_after: metrics?.succeeded_after,
      puzzles_solved: metrics?.puzzles_solved,
      correct_rotations: metrics?.correct_rotations,
      clicks_count: metrics?.clicks_count,
    };
    body.metadata = metadataPayload;

    const userResponsesPayload = {
      perceived_rank_percentile: options?.perceived_rank_percentile,
      perceived_rank_for_skill_percentile: options?.perceived_rank_for_skill,
      prior_belief_percentile: options?.prior_belief,
      prior_belief_for_skill_percentile: options?.prior_belief_for_skill,
      application_willingness: options?.application_willingness,
      application_24h: options?.application_24h,
      opportunity_skill_requirement_percentile: options?.opportunity_skill_requirement,
    };
    body.user_responses = userResponsesPayload;

    const response = await customFetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.ACCEPTED,
      serviceName: "SkillsRankingService",
      serviceFunction: "updateSkillsRankingState",
      failureMessage: `Failed to update skills ranking state for session ${sessionId}`,
      body: JSON.stringify(body),
      expectedContentType: "application/json",
    });

    const data = await response.json();

    return this.mapStateResponse(data);
  }

  /**
   * Update only the metrics for a given session without changing the phase.
   * This is used for periodic progress updates.
   *
   * @param sessionId - The ID of the session to update the metrics for.
   * @param metrics - The metrics to update.
   * @returns {Promise<SkillsRankingState>} The updated ranking state for the session.
   */
  async updateSkillsRankingMetrics(sessionId: number, metrics: SkillsRankingMetrics): Promise<SkillsRankingState> {
    const url = `${this.skillsRankingEndpointUrl}/${sessionId}/skills-ranking/state`;

    const response = await customFetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.ACCEPTED,
      serviceName: "SkillsRankingService",
      serviceFunction: "updateSkillsRankingMetrics",
      failureMessage: `Failed to update skills ranking metrics for session ${sessionId}`,
      body: JSON.stringify({
        metadata: {
          cancelled_after: metrics.cancelled_after,
          succeeded_after: metrics.succeeded_after,
          puzzles_solved: metrics.puzzles_solved,
          correct_rotations: metrics.correct_rotations,
          clicks_count: metrics.clicks_count,
        },
      }),
      expectedContentType: "application/json",
    });

    const data = await response.json();

    return this.mapStateResponse(data);
  }

  /**
   * Create a debounced function for updating metrics.
   * This waits for the specified delay after the last call before sending an update.
   *
   * @param sessionId - The ID of the session to update metrics for.
   * @param delay - The debounce delay in milliseconds (default: 2000ms).
   * @returns A debounced function that can be called with metrics to update.
   */
  createDebouncedMetricsUpdater(sessionId: number, delay: number) {
    return createDebouncedMetricsUpdater(sessionId, this.updateSkillsRankingMetrics.bind(this), delay);
  }

  public getConfig(): SkillsRankingConfig {
    return super.getConfig() as SkillsRankingConfig;
  }

  validateConfig(config: any): void {
    super.validateConfig(config);
    // check internal config properties inside the config.config
    if (!config.config.hasOwnProperty("compensationAmount") || typeof config.config.compensationAmount !== "string") {
      throw new SkillsRankingError(
        `Invalid configuration for feature ${this.featureId}: compensationAmount must be a string`
      );
    }
    if (!config.config.hasOwnProperty("jobPlatformUrl") || typeof config.config.jobPlatformUrl !== "string") {
      throw new SkillsRankingError(
        `Invalid configuration for feature ${this.featureId}: jobPlatformUrl must be a string`
      );
    }
    if (!config.config.hasOwnProperty("shortTypingDurationMs") || typeof config.config.shortTypingDurationMs !== "number") {
      throw new SkillsRankingError(
        `Invalid configuration for feature ${this.featureId}: shortTypingDurationMs must be a number`
      );
    }
    if (!config.config.hasOwnProperty("defaultTypingDurationMs") || typeof config.config.defaultTypingDurationMs !== "number") {
      throw new SkillsRankingError(
        `Invalid configuration for feature ${this.featureId}: defaultTypingDurationMs must be a number`
      );
    }
    if (!config.config.hasOwnProperty("longTypingDurationMs") || typeof config.config.longTypingDurationMs !== "number") {
      throw new SkillsRankingError(
        `Invalid configuration for feature ${this.featureId}: longTypingDurationMs must be a number`
      );
    }
  }

  private parseExperimentGroup(value: string): SkillsRankingExperimentGroups {
    if (!isValidExperimentGroupKey(value)) {
      throw new SkillsRankingError(`Unknown experiment_group '${value}' from API`);
    }
    return SkillsRankingExperimentGroups[value];
  }

  private mapStateResponse(data: any): SkillsRankingState {
    if (!data?.metadata || !data?.score) {
      throw new SkillsRankingError("Malformed skills ranking state response from API");
    }

    const phaseHistory = Array.isArray(data.phase) ? data.phase : [];
    const experiment_group = this.parseExperimentGroup(data.metadata.experiment_group);
    const metadata = {
      session_id: data.metadata.session_id,
      experiment_group,
      started_at: data.metadata.started_at,
      completed_at: data.metadata.completed_at ?? undefined,
      cancelled_after: data.metadata.cancelled_after ?? undefined,
      succeeded_after: data.metadata.succeeded_after ?? undefined,
      puzzles_solved: data.metadata.puzzles_solved ?? undefined,
      correct_rotations: data.metadata.correct_rotations ?? undefined,
      clicks_count: data.metadata.clicks_count ?? undefined,
    };

    const user_responses = {
      prior_belief_percentile: data.user_responses?.prior_belief_percentile ?? undefined,
      prior_belief_for_skill_percentile: data.user_responses?.prior_belief_for_skill_percentile ?? undefined,
      perceived_rank_percentile: data.user_responses?.perceived_rank_percentile ?? undefined,
      perceived_rank_for_skill_percentile: data.user_responses?.perceived_rank_for_skill_percentile ?? undefined,
      application_willingness: data.user_responses?.application_willingness ?? undefined,
      application_24h: data.user_responses?.application_24h ?? undefined,
      opportunity_skill_requirement_percentile:
        data.user_responses?.opportunity_skill_requirement_percentile ?? undefined,
    };

    return {
      phase: phaseHistory,
      score: data.score,
      metadata,
      user_responses,
    };
  }
}
