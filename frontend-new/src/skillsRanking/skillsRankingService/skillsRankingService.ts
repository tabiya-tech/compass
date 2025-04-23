import { getSkillsRankingEnabled } from "src/envService";

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
    return getSkillsRankingEnabled().toLowerCase() === "true"
  }

  /**
   * Get the ranking for a given session.
   *
   * @param sessionId - The ID of the session to get the ranking for.
   * @returns {Promise<string>} The ranking class for the session.
   */
  async getRanking(sessionId: string): Promise<string> {
    return "foo"
  }
}
