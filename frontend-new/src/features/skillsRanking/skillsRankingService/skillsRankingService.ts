import { getBackendUrl } from "src/envService";
import { customFetch } from "src/utils/customFetch/customFetch";
import { StatusCodes } from "http-status-codes";
import {
  SkillsRankingPhase,
  SkillsRankingState,
  SkillRankingExperimentGroups,
  SkillsRankingResult,
} from "src/features/skillsRanking/types";
import { FeaturesService } from "src/features/featuresService/FeaturesService";

/**
 * Service to manage the skills ranking feature.
 */
export class SkillsRankingService {
  private static instance: SkillsRankingService;
  readonly skillsRankingEndpointUrl: string;
  readonly apiServerUrl: string;

  private constructor() {
    this.apiServerUrl = getBackendUrl();
    this.skillsRankingEndpointUrl = `${this.apiServerUrl}/conversations`;
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
    try {
      const features = FeaturesService.getInstance().isFeatureEnabled("skills_ranking");
      return features;
    } catch (error) {
      console.warn("Could not parse configuration for Skills Ranking feature")
      return false;
    }
  }

  /**
   * Validate the experiment groups.
   * @param experimentGroups - The experiment groups to validate.
   * @throws {Error} If the experiment groups are invalid.
   */
  _validateExperimentGroups(experimentGroups: SkillRankingExperimentGroups): void {
    if (!experimentGroups) {
      throw new Error("Experiment groups are required");
    }

    if (!experimentGroups.compare_against || (experimentGroups.compare_against !== "against_other_job_seekers" && experimentGroups.compare_against !== "against_job_market")) {
      throw new Error("Experiment groups must have a valid compare_against value");
    }

    if (!experimentGroups.button_order || (experimentGroups.button_order !== "skip_button_first" && experimentGroups.button_order !== "view_button_first")) {
      throw new Error("Experiment groups must have a valid button_order value");
    }
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
    this._validateExperimentGroups(data.experiment_groups);
    return {
      session_id: data.session_id,
      experiment_groups: {
        compare_against: data.experiment_groups.compare_against,
        button_order: data.experiment_groups.button_order,
        delayed_results: data.experiment_groups.delayed_results,
      },
      phase: data.phase,
      ranking: data.ranking,
      self_ranking: data.self_ranking,
    };
  }

  /**
   * Update the ranking state for a given session.
   *
   * @param sessionId - The ID of the session to update the ranking state for.
   * @param phase - The new current phase.
   * @param self_ranking - The new ranking.
   * @returns {Promise<SkillsRankingState>} The updated ranking state for the session.
   */
  async updateSkillsRankingState(
    sessionId: number,
    phase: SkillsRankingPhase,
    self_ranking?: string
  ): Promise<SkillsRankingState> {
    const url = `${this.skillsRankingEndpointUrl}/${sessionId}/skills-ranking/state`;
    
    const response = await customFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.ACCEPTED,
      serviceName: "SkillsRankingService",
      serviceFunction: "updateSkillsRankingState",
      failureMessage: `Failed to update skills ranking state for session ${sessionId}`,
      body: JSON.stringify({
        phase: phase,
        self_ranking: self_ranking
      }),
      expectedContentType: "application/json",
    });

    const data = await response.json();

    this._validateExperimentGroups(data.experiment_groups);

    return {
      session_id: data.session_id,
      experiment_groups: {
        compare_against: data.experiment_groups.compare_against,
        button_order: data.experiment_groups.button_order,
        delayed_results: data.experiment_groups.delayed_results,
      },
      phase: data.phase,
      ranking: data.ranking,
      self_ranking: data.self_ranking,
    };
  }

  /**
   * Get the ranking for a given session.
   *
   * @param sessionId - The ID of the session to get the ranking for.
   * @param signal - Optional AbortSignal to cancel the request.
   * @returns {Promise<string>} The ranking class for the session.
   */
  async getRanking(sessionId: number, signal?: AbortSignal): Promise<SkillsRankingResult> {
    const url = `${this.skillsRankingEndpointUrl}/${sessionId}/skills-ranking/ranking`;
    
    const response = await customFetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      expectedStatusCode: StatusCodes.OK,
      serviceName: "SkillsRankingService",
      serviceFunction: "getRanking",
      failureMessage: `Failed to get ranking for session ${sessionId}`,
      expectedContentType: "application/json",
      signal,
    });

    const data = await response.json();

    return {
      ranking: data.ranking,
    };
  }
}
