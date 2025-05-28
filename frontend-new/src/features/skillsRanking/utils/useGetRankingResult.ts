import { useCallback, useState } from "react";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";

export const useGetRankingResult = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [ranking, setRanking] = useState<string>("");
  const { enqueueSnackbar } = useSnackbar();

  const handleError = useCallback((error: Error) => {
    console.error(new SkillsRankingError("Error in skills ranking flow:", error));
    enqueueSnackbar("An error occurred while calculating your skills ranking. Please try again later.", {
      variant: "error",
    });
  }, [enqueueSnackbar]);

  const getRankingResult = useCallback(async (signal: AbortSignal) => {
    setIsLoading(true);
    try {
      const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
      if (sessionId === null) {
        throw new Error("No active session found");
      }
      const skillsRankingService = SkillsRankingService.getInstance();
      const result = await skillsRankingService.getRanking(sessionId, signal);
      setRanking(result.ranking);
      return result.ranking;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.info('Ranking fetch was aborted');
        return null;
      }
      handleError(error as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  return {
    fetchRanking: getRankingResult,
    isLoading,
    ranking,
  };
}; 