import { useCallback, useRef } from "react";
import { SkillsRankingPhase } from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";

export const useSkillsRankingState = () => {
  const { enqueueSnackbar } = useSnackbar();
  const lastHandledState = useRef<SkillsRankingPhase | null>(null);

  const handleError = useCallback((error: Error) => {
    console.error(new SkillsRankingError("Error in skills ranking flow:", error));
    enqueueSnackbar("An error occurred while calculating your skills ranking. Please try again later.", {
      variant: "error",
    });
  }, [enqueueSnackbar]);

  const handleStateTransition = useCallback(async (newState: SkillsRankingPhase, rank?: string) => {
    const sessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
    if (!sessionId) return null;
    
    try {
      return await SkillsRankingService.getInstance().updateSkillsRankingState(
        sessionId,
        newState,
        rank
      );
    } catch (error) {
      handleError(error as Error);
      return null;
    }
  }, [handleError]);

  return {
    handleStateTransition,
    handleError,
    lastHandledState,
  };
}; 