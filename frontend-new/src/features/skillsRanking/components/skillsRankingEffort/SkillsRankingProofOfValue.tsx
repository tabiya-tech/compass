import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, useTheme } from "@mui/material";
import CircularProgress from "@mui/material/CircularProgress";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import PrimaryButton from "src/theme/PrimaryButton/PrimaryButton";
import { EffortType } from "src/features/skillsRanking/components/skillsRankingEffort/types";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import SecondaryButton from "src/theme/SecondaryButton/SecondaryButton";
import { SkillsRankingService } from "../../skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "../../../../userPreferences/UserPreferencesStateService";
import { useSnackbar } from "../../../../theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineContext } from "../../../../app/isOnlineProvider/IsOnlineProvider";
import RotateToSolvePuzzle, { RotateToSolvePuzzleMetricsReport } from "../rotateToSolve/RotateToSolvePuzzle";
import { SkillsRankingMetrics } from "../../skillsRankingService/types";

const CALCULATION_DELAY = 5000;

const uniqueId = "d08ec52d-cd41-4934-b62f-dcd10eadfb3c";

export const DATA_TEST_ID = {
  SKILLS_RANKING_EFFORT_CONTAINER: `skills-ranking-effort-container-${uniqueId}`,
  SKILLS_RANKING_EFFORT_CANCEL_BUTTON: `skills-ranking-effort-cancel-button-${uniqueId}`,
  SKILLS_RANKING_EFFORT_CONTINUE_BUTTON: `skills-ranking-effort-continue-button-${uniqueId}`,
  SKILLS_RANKING_EFFORT_PROGRESS_ICON: `skills-ranking-effort-progress-icon-${uniqueId}`
};

export enum SkillsRankingEffortState {
  CANCELLED = "cancelled",
  COMPLETED = "completed",
}

export interface SkillsRankingEffortProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

export const SKILLS_RANKING_EFFORT_MESSAGE_ID = `skills-ranking-effort-message-${uniqueId}`;

const getEffortTypeForGroup = (group: SkillsRankingExperimentGroups): EffortType => {
  switch (group) {
    case SkillsRankingExperimentGroups.GROUP_1:
    case SkillsRankingExperimentGroups.GROUP_4:
      return EffortType.TIME_BASED;
    case SkillsRankingExperimentGroups.GROUP_2:
    case SkillsRankingExperimentGroups.GROUP_3:
      return EffortType.WORK_BASED;
    default:
      throw new SkillsRankingError("Invalid experiment group for effort type calculation.", group);
  }
};

const SkillsRankingProofOfValue: React.FC<Readonly<SkillsRankingEffortProps>> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const effortType = getEffortTypeForGroup(skillsRankingState.experiment_group);

  const [hasFinished, setHasFinished] = useState(false);
  const [hasCompletedPuzzles, setHasCompletedPuzzles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<SkillsRankingEffortState | null>();
  const [puzzleMetrics, setPuzzleMetrics] = useState<RotateToSolvePuzzleMetricsReport|null>(null)
  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
  const { enqueueSnackbar } = useSnackbar();
  const isOnline = useContext(IsOnlineContext);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const effortMessage = useMemo(() =>
    effortType === EffortType.TIME_BASED
      ? "Please wait while I run the calculations... or click cancel if you want to continue the conversation without the information."
      : "To continue, please solve the following puzzles:"
    , [effortType]);

  const handleUpdateState = useCallback(async (state: SkillsRankingEffortState) => {
    if (skillsRankingState.phase === SkillsRankingPhase.PROOF_OF_VALUE) {
      if (!activeSessionId) {
        throw new SkillsRankingError("Active session ID is not available.");
      }
      setIsSubmitting(state)
      if(timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      
      let cancelledAfter: string | undefined;
      if (state === SkillsRankingEffortState.CANCELLED && startTimeRef.current) {
        const timeSpent = Date.now() - startTimeRef.current;
        cancelledAfter = `${Math.round(timeSpent / 1000)}s`;
      }

      const metricsToUpdate: SkillsRankingMetrics = {
        cancelled_after: cancelledAfter,
        succeeded_after: effortType === EffortType.TIME_BASED ? CALCULATION_DELAY.toString() + "ms" : puzzleMetrics?.time_spent_ms.toString() + "ms",
        correct_rotations: effortType === EffortType.WORK_BASED ? puzzleMetrics?.correct_rotations : undefined,
        puzzles_solved: effortType === EffortType.WORK_BASED ? puzzleMetrics?.puzzles_solved : undefined,
        clicks_count: effortType === EffortType.WORK_BASED ? puzzleMetrics?.clicks_count : undefined
      }
      
      try {
        const newSkillsRankingState = await SkillsRankingService.getInstance().updateSkillsRankingState(
          activeSessionId,
          state === SkillsRankingEffortState.COMPLETED ? SkillsRankingPhase.DISCLOSURE : SkillsRankingPhase.CANCELLED,
          undefined,
          undefined,
          metricsToUpdate
        );
        onFinish(newSkillsRankingState);
      } catch (error) {
        console.error("Error updating skills ranking state:", error);
        enqueueSnackbar("Failed to update skills ranking state. Please try again later.", {
          variant: "error",
        });
      } finally {
        setIsSubmitting(null)
      }
    }
  }, [effortType, activeSessionId, onFinish, enqueueSnackbar])

  useEffect(() => {
    if (effortType === EffortType.TIME_BASED && skillsRankingState.phase === SkillsRankingPhase.PROOF_OF_VALUE) {
      startTimeRef.current = Date.now();
      timeoutIdRef.current = setTimeout(async () => {
        setHasFinished(true);
        handleUpdateState(SkillsRankingEffortState.COMPLETED).then()
      }, CALCULATION_DELAY);
      return () => {if(timeoutIdRef.current) clearTimeout(timeoutIdRef.current)};
    }
  }, [effortType, handleUpdateState, skillsRankingState.phase]);


  const handleCancel = async () => {
    if (!hasFinished) {
      setHasFinished(true);
      await handleUpdateState(SkillsRankingEffortState.CANCELLED);
    }
  };

  const handleContinue = async () => {
    if (!hasFinished && hasCompletedPuzzles) {
      setHasFinished(true);
      await handleUpdateState(SkillsRankingEffortState.COMPLETED);
    }
  };

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_EFFORT_CONTAINER}
    >
      <ChatBubble message={effortMessage} sender={ConversationMessageSender.COMPASS}>
        <Box display="flex" flexDirection={"row"} justifyContent="flex-end" padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)}>
          {effortType === EffortType.TIME_BASED ? (
              <PrimaryButton
                onClick={handleCancel}
                data-testid={DATA_TEST_ID.SKILLS_RANKING_EFFORT_CANCEL_BUTTON}
                disabled={skillsRankingState.phase != SkillsRankingPhase.PROOF_OF_VALUE || !isOnline || hasFinished}
              >
                Cancel calculation
              </PrimaryButton>
          ) : (
            <Box width={"100%"} height={"100%"} gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}>
              <RotateToSolvePuzzle disabled={hasCompletedPuzzles || hasFinished || skillsRankingState.phase !== SkillsRankingPhase.PROOF_OF_VALUE || !isOnline} onSuccess={() => setHasCompletedPuzzles(true)} onReport={(report) => setPuzzleMetrics(report)} puzzles={5}/>
              <Box display="flex" padding={theme.fixedSpacing(theme.tabiyaSpacing.sm)} gap={theme.fixedSpacing(theme.tabiyaSpacing.sm)} flexDirection="row" justifyContent="flex-end">
                <SecondaryButton
                  onClick={handleCancel}
                  disabled={skillsRankingState.phase !== SkillsRankingPhase.PROOF_OF_VALUE || !isOnline || hasFinished}
                  data-testid={DATA_TEST_ID.SKILLS_RANKING_EFFORT_CANCEL_BUTTON}
                  startIcon={isSubmitting === SkillsRankingEffortState.CANCELLED && <CircularProgress
                    sx={{ color: theme.palette.tabiyaBlue.main, marginRight: theme.fixedSpacing(theme.tabiyaSpacing.xs) }}
                    size={theme.spacing(3)}
                    data-testid={DATA_TEST_ID.SKILLS_RANKING_EFFORT_PROGRESS_ICON}
                  /> }
                >
                  Cancel
                </SecondaryButton>
                <PrimaryButton
                  onClick={handleContinue}
                  disabled={!hasCompletedPuzzles || hasFinished || skillsRankingState.phase !== SkillsRankingPhase.PROOF_OF_VALUE || !isOnline}
                  data-testid={DATA_TEST_ID.SKILLS_RANKING_EFFORT_CONTINUE_BUTTON}
                  startIcon={isSubmitting == SkillsRankingEffortState.COMPLETED && <CircularProgress
                    sx={{ color: theme.palette.tabiyaBlue.main, marginRight: theme.fixedSpacing(theme.tabiyaSpacing.xs) }}
                    size={theme.spacing(3)}
                    data-testid={DATA_TEST_ID.SKILLS_RANKING_EFFORT_PROGRESS_ICON}
                  /> }
                >
                  Continue
                </PrimaryButton>
              </Box>
            </Box>
          )}
        </Box>
      </ChatBubble>
    </MessageContainer>
  );
};

export default SkillsRankingProofOfValue;
