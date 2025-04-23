import { getSkillsRankingEnabled } from "src/envService";
import {
  ExperimentGroup,
  SkillsRankingState,
  SkillsRankingStateResponse,
} from "src/chat/chatMessage/skillsRanking/types";

/**
 * Service to manage the skills ranking feature.
 */
export class SkillsRankingService {
  private static instance: SkillsRankingService;

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
    return getSkillsRankingEnabled().toLowerCase() === "true";
  }

  /**
   * Get the ranking state for a given session.
   *
   * @param sessionId - The ID of the session to get the ranking state for.
   * @returns {Promise<SkillsRankingStateResponse>} The ranking state for the session.
   */
  async getSkillsRankingState(sessionId: number): Promise<SkillsRankingStateResponse> {
    return {
      session_id: sessionId,
      experiment_group: ExperimentGroup.GROUP_A,
      current_state: SkillsRankingState.INITIAL,
      ranking: "80%",
      self_ranking: null,
    };
  }

  /**
   * Update the ranking state for a given session.
   *
   * @param sessionId - The ID of the session to update the ranking state for.
   * @param currentState - The new current state.
   * @param self_ranking - The new ranking.
   * @returns {Promise<SkillsRankingStateResponse>} The updated ranking state for the session.
   */
  async updateSkillsRankingState(
    sessionId: number,
    currentState: SkillsRankingState,
    self_ranking: string
  ): Promise<SkillsRankingStateResponse> {
    return {
      session_id: sessionId,
      experiment_group: ExperimentGroup.GROUP_A,
      current_state: currentState,
      ranking: "80%",
      self_ranking: self_ranking,
    };
  }

  /**
   * Get the ranking for a given session.
   *
   * @param sessionId - The ID of the session to get the ranking for.
   * @returns {Promise<string>} The ranking class for the session.
   */
  async getRanking(sessionId: number): Promise<string> {
    return "foo";
  }
}
