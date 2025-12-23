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
      retryOnFailedToFetch: true,
    });

    const data = await response.json();
    if (data === null) {
      return null;
    }

    // Validate experiment group returned from the API.
    if (data.experiment_group && !isValidExperimentGroupKey(data.experiment_group)) {
      throw new SkillsRankingError(`Unknown experiment_group '${data.experiment_group}' from API`);
    }

    return {
      session_id: data.session_id,
      experiment_group:
        SkillsRankingExperimentGroups[data.experiment_group as keyof typeof SkillsRankingExperimentGroups],
      phases: data.phase,
      score: data.score,
      cancelled_after: data.cancelled_after,
      succeeded_after: data.succeeded_after,
      puzzles_solved: data.puzzles_solved,
      correct_rotations: data.correct_rotations,
      clicks_count: data.clicks_count,
      perceived_rank_percentile: data.perceived_rank_percentile,
      retyped_rank_percentile: data.retyped_rank_percentile,
      started_at: data.started_at,
      completed_at: data.completed_at,
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

    // Build request body based on phase validation rules
    const body: any = {
      phase: phase,
    };

    body.cancelled_after = metrics?.cancelled_after ?? undefined;
    body.succeeded_after = metrics?.succeeded_after ?? undefined;
    body.puzzles_solved = metrics?.puzzles_solved ?? undefined;
    body.correct_rotations = metrics?.correct_rotations ?? undefined;
    body.clicks_count = metrics?.clicks_count ?? undefined;
    body.perceived_rank_percentile = perceived_rank_percentile ?? undefined;
    body.retyped_rank_percentile = retyped_rank_percentile ?? undefined;

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

    if (data.experiment_group && !isValidExperimentGroupKey(data.experiment_group)) {
      throw new SkillsRankingError(`Unknown experiment_group '${data.experiment_group}' from API`);
    }

    return {
      session_id: data.session_id,
      experiment_group:
        SkillsRankingExperimentGroups[data.experiment_group as keyof typeof SkillsRankingExperimentGroups],
      phases: data.phase,
      score: data.score,
      cancelled_after: data.cancelled_after ?? undefined,
      succeeded_after: data.succeeded_after ?? undefined,
      puzzles_solved: data.puzzles_solved ?? undefined,
      correct_rotations: data.correct_rotations ?? undefined,
      clicks_count: data.clicks_count ?? undefined,
      perceived_rank_percentile: data.perceived_rank_percentile ?? undefined,
      retyped_rank_percentile: data.retyped_rank_percentile ?? undefined,
      started_at: data.started_at,
      completed_at: data.completed_at ?? undefined,
    };
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
      body: JSON.stringify(metrics),
      expectedContentType: "application/json",
    });

    const data = await response.json();

    if (data.experiment_group && !isValidExperimentGroupKey(data.experiment_group)) {
      throw new SkillsRankingError(`Unknown experiment_group '${data.experiment_group}' from API`);
    }

    return {
      session_id: data.session_id,
      experiment_group:
        SkillsRankingExperimentGroups[data.experiment_group as keyof typeof SkillsRankingExperimentGroups],
      phases: data.phase,
      score: data.score,
      cancelled_after: data.cancelled_after,
      succeeded_after: data.succeeded_after,
      puzzles_solved: data.puzzles_solved,
      correct_rotations: data.correct_rotations,
      clicks_count: data.clicks_count,
      perceived_rank_percentile: data.perceived_rank_percentile,
      retyped_rank_percentile: data.retyped_rank_percentile,
      started_at: data.started_at,
      completed_at: data.completed_at,
    };
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
    if (
      !config.config.hasOwnProperty("shortTypingDurationMs") ||
      typeof config.config.shortTypingDurationMs !== "number"
    ) {
      throw new SkillsRankingError(
        `Invalid configuration for feature ${this.featureId}: shortTypingDurationMs must be a number`
      );
    }
    if (
      !config.config.hasOwnProperty("defaultTypingDurationMs") ||
      typeof config.config.defaultTypingDurationMs !== "number"
    ) {
      throw new SkillsRankingError(
        `Invalid configuration for feature ${this.featureId}: defaultTypingDurationMs must be a number`
      );
    }
    if (
      !config.config.hasOwnProperty("longTypingDurationMs") ||
      typeof config.config.longTypingDurationMs !== "number"
    ) {
      throw new SkillsRankingError(
        `Invalid configuration for feature ${this.featureId}: longTypingDurationMs must be a number`
      );
    }
  }
}
