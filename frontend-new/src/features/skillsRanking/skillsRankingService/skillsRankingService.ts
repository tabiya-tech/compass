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

// Throttled metrics updater for periodic updates during active work
const createThrottledMetricsUpdater = (
  sessionId: number,
  updateFunction: (sessionId: number, metrics: SkillsRankingMetrics) => Promise<any>,
  throttleInterval: number = 5000,
  debounceDelay: number = 2000
) => {
  let lastMetrics: SkillsRankingMetrics | null = null;
  let lastUpdateTime = 0;
  let throttleTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let debounceTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let isActive = false;

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
      lastUpdateTime = Date.now();
    } catch (err) {
      console.error("Failed to update metrics periodically", err);
    }
  };

  return {
    // Call this when user is actively working
    onActivity: (metrics: SkillsRankingMetrics) => {
      isActive = true;

      // Clear any pending debounce
      if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
        debounceTimeoutId = null;
      }

      const now = Date.now();

      // If enough time has passed since last update, send immediately
      if (now - lastUpdateTime >= throttleInterval) {
        sendUpdate(metrics);
      } else {
        // Schedule a throttled update
        if (throttleTimeoutId) {
          clearTimeout(throttleTimeoutId);
        }
        throttleTimeoutId = setTimeout(
          () => {
            if (isActive) {
              sendUpdate(metrics);
            }
          },
          throttleInterval - (now - lastUpdateTime)
        );
      }
    },

    // Call this when user stops working (for debouncing)
    onInactivity: (metrics: SkillsRankingMetrics) => {
      isActive = false;

      // Clear any pending throttle
      if (throttleTimeoutId) {
        clearTimeout(throttleTimeoutId);
        throttleTimeoutId = null;
      }

      // Debounce the final update
      if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
      }
      debounceTimeoutId = setTimeout(() => {
        sendUpdate(metrics);
      }, debounceDelay);
    },

    // Call this to force an immediate update (e.g., for cancellation)
    forceUpdate: (metrics: SkillsRankingMetrics) => {
      // Clear any pending timeouts
      if (throttleTimeoutId) {
        clearTimeout(throttleTimeoutId);
        throttleTimeoutId = null;
      }
      if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
        debounceTimeoutId = null;
      }

      sendUpdate(metrics);
    },

    // Clean up timeouts
    cleanup: () => {
      if (throttleTimeoutId) {
        clearTimeout(throttleTimeoutId);
        throttleTimeoutId = null;
      }
      if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
        debounceTimeoutId = null;
      }
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
    });

    const data = await response.json();
    if (data === null) {
      return null;
    }

    // Validate experiment group returned from the API.
    if (data.experiment_group && !isValidExperimentGroupKey(data.experiment_group)) {
      throw new SkillsRankingError(`Unknown experiment_group '${data.experiment_group}' from API`);
    }

    // REVIEW: Have a private function to convert the data to SkillsRankingState
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

    // Add metrics fields only for phases that allow them
    if (phase === SkillsRankingPhase.PROOF_OF_VALUE) {
      body.cancelled_after = metrics?.cancelled_after ?? null;
      body.succeeded_after = metrics?.succeeded_after ?? null;
      body.puzzles_solved = metrics?.puzzles_solved ?? null;
      body.correct_rotations = metrics?.correct_rotations ?? null;
      body.clicks_count = metrics?.clicks_count ?? null;
    }

    // Add rank fields for phases that allow them
    if (phase === SkillsRankingPhase.PERCEIVED_RANK) {
      body.perceived_rank_percentile = perceived_rank_percentile ?? null;
    }

    if (phase === SkillsRankingPhase.RETYPED_RANK) {
      body.retyped_rank_percentile = retyped_rank_percentile ?? null;
    }

    // Allow both rank fields when transitioning to COMPLETED
    if (phase === SkillsRankingPhase.COMPLETED) {
      body.perceived_rank_percentile = perceived_rank_percentile ?? null;
      body.retyped_rank_percentile = retyped_rank_percentile ?? null;
    }

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
      cancelled_after: data.cancelled_after ?? null,
      succeeded_after: data.succeeded_after ?? null,
      puzzles_solved: data.puzzles_solved ?? null,
      correct_rotations: data.correct_rotations ?? null,
      clicks_count: data.clicks_count ?? null,
      perceived_rank_percentile: data.perceived_rank_percentile ?? null,
      retyped_rank_percentile: data.retyped_rank_percentile ?? null,
      started_at: data.started_at,
      completed_at: data.completed_at ?? null,
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
   * Create a throttled function for updating metrics periodically.
   * This sends updates every interval while the user is working, rather than waiting for them to stop.
   *
   * @param sessionId - The ID of the session to update metrics for.
   * @param delay - The throttle delay in milliseconds (default: 2000ms).
   * @returns A throttled function that can be called with metrics to update.
   */
  createThrottledMetricsUpdater(sessionId: number, delay: number = 2000) {
    return createThrottledMetricsUpdater(sessionId, this.updateSkillsRankingMetrics.bind(this), 5000, delay);
  }

  public getConfig(): SkillsRankingConfig {
    return super.getConfig() as SkillsRankingConfig;
  }

  validateConfig(config: any): void {
    super.validateConfig(config);
    // check internal config properties inside the config.config
    if (!config.config.hasOwnProperty("airtimeBudget") || typeof config.config.airtimeBudget !== "string") {
      throw new SkillsRankingError(
        `Invalid configuration for feature ${this.featureId}: airtimeBudget must be a string`
      );
    }
    if (!config.config.hasOwnProperty("jobPlatformUrl") || typeof config.config.jobPlatformUrl !== "string") {
      throw new SkillsRankingError(
        `Invalid configuration for feature ${this.featureId}: jobPlatformUrl must be a string`
      );
    }
  }
}
