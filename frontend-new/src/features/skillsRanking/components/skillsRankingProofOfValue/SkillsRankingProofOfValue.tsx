import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  EffortType,
  getLatestPhaseName,
  SkillsRankingExperimentGroups,
  SkillsRankingMetrics,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import CancellableTypingChatMessage from "src/features/skillsRanking/components/cancellableTypingChatMessage/CancellableTypingChatMessage";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import RotateToSolvePuzzle, {
  RotateToSolvePuzzleMetricsReport,
} from "src/features/skillsRanking/components/rotateToSolve/RotateToSolvePuzzle";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import {
  CALCULATION_DELAY,
  EFFORT_METRICS_UPDATE_INTERVAL,
  TYPING_DURATION_MS,
} from "src/features/skillsRanking/constants";
import { shouldSkipMarketDisclosure } from "src/features/skillsRanking/utils/createMessages";

const uniqueId = "d08ec52d-cd41-4934-b62f-dcd10eadfb3c";

export const DATA_TEST_ID = {
  SKILLS_RANKING_EFFORT_CONTAINER: `skills-ranking-effort-container-${uniqueId}`,
  SKILLS_RANKING_EFFORT_CANCEL_BUTTON: `skills-ranking-effort-cancel-button-${uniqueId}`,
  SKILLS_RANKING_EFFORT_CONTINUE_BUTTON: `skills-ranking-effort-continue-button-${uniqueId}`,
  SKILLS_RANKING_EFFORT_PROGRESS_ICON: `skills-ranking-effort-progress-icon-${uniqueId}`,
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

// here since this is the only place where we use this check
// if another place arises, we can move it to a common utils file
const getEffortTypeForGroup = (group: SkillsRankingExperimentGroups): EffortType => {
  switch (group) {
    case SkillsRankingExperimentGroups.GROUP_1:
    case SkillsRankingExperimentGroups.GROUP_4:
      return EffortType.TIME_BASED;
    case SkillsRankingExperimentGroups.GROUP_2:
    case SkillsRankingExperimentGroups.GROUP_3:
      return EffortType.WORK_BASED;
    default:
      throw new SkillsRankingError("Invalid experiment group", group);
  }
};

const SkillsRankingProofOfValue: React.FC<SkillsRankingEffortProps> = ({ onFinish, skillsRankingState }) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const isReplay = useMemo(() => currentPhase !== SkillsRankingPhase.PROOF_OF_VALUE, [currentPhase]);
  const effortType = getEffortTypeForGroup(skillsRankingState.experiment_group);

  // Determine replay state for puzzle component
  const puzzleIsReplay = useMemo(() => isReplay, [isReplay]);
  const puzzleIsReplayFinished = useMemo(
    () => isReplay && !!skillsRankingState.succeeded_after,
    [isReplay, skillsRankingState.succeeded_after]
  );

  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();

  // State management
  const [hasFinished, setHasFinished] = useState(false);
  const [isTypingVisible, setIsTypingVisible] = useState(false);
  const [isUpdatingState, setIsUpdatingState] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [puzzleMetrics, setPuzzleMetrics] = useState<RotateToSolvePuzzleMetricsReport | null>(null);

  // Refs for tracking
  const scrollRef = useAutoScrollOnChange(isTypingVisible ? 1 : 0);
  const startTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFinishedRef = useRef<boolean>(false);
  const lastMetricsRef = useRef<SkillsRankingMetrics | null>(null);
  const debouncedUpdaterRef = useRef<{
    update: (metrics: SkillsRankingMetrics) => void;
    forceUpdate: (metrics: SkillsRankingMetrics) => void;
    abort: () => void;
    cleanup: () => void;
  } | null>(null);

  // Restore state from existing data
  useEffect(() => {
    if (skillsRankingState.cancelled_after || skillsRankingState.succeeded_after) {
      setHasFinished(true);
      hasFinishedRef.current = true;
    }
  }, [skillsRankingState]);

  // Create debounced updater once when component mounts
  useEffect(() => {
    if (activeSessionId && !isReplay && effortType === EffortType.WORK_BASED) {
      debouncedUpdaterRef.current = SkillsRankingService.getInstance().createDebouncedMetricsUpdater(
        activeSessionId,
        EFFORT_METRICS_UPDATE_INTERVAL
      );
    }

    // Cleanup on unmount
    return () => {
      if (debouncedUpdaterRef.current) {
        debouncedUpdaterRef.current.cleanup();
        debouncedUpdaterRef.current = null;
      }
    };
  }, [activeSessionId, isReplay, effortType]);

  // Reset hasFinishedRef when phase changes away from PROOF_OF_VALUE
  useEffect(() => {
    if (currentPhase !== SkillsRankingPhase.PROOF_OF_VALUE) {
      hasFinishedRef.current = false;
    }
  }, [currentPhase]);

  const effortMessage =
    effortType === EffortType.TIME_BASED ? (
      <>
        Please wait while I run the calculations, or click <strong>cancel</strong> at any time if you do not want to
        wait any longer for the information.
      </>
    ) : (
      ""
    );

  // Determine if component should be disabled
  const isDisabled = useMemo(() => {
    return (
      !isOnline ||
      hasFinished ||
      hasFinishedRef.current ||
      isUpdatingState ||
      isReplay ||
      currentPhase !== SkillsRankingPhase.PROOF_OF_VALUE
    );
  }, [isOnline, hasFinished, isUpdatingState, isReplay, currentPhase]);

  // Handle puzzle metrics update with debounced updates
  const handlePuzzleMetricsUpdate = useCallback(
    (report: RotateToSolvePuzzleMetricsReport) => {
      setPuzzleMetrics(report);

      // Set start time on first interaction for work-based tasks
      if (effortType === EffortType.WORK_BASED && !startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      // Use debounced updater for progress updates (only during PROOF_OF_VALUE phase)
      if (
        !isReplay &&
        effortType === EffortType.WORK_BASED &&
        currentPhase === SkillsRankingPhase.PROOF_OF_VALUE &&
        !hasFinishedRef.current &&
        activeSessionId
      ) {
        const metrics: SkillsRankingMetrics = {
          puzzles_solved: report.puzzles_solved,
          correct_rotations: report.correct_rotations,
          clicks_count: report.clicks_count,
        };

        // Check if metrics have changed
        const lastMetrics = lastMetricsRef.current;
        const hasChanged =
          !lastMetrics ||
          lastMetrics.puzzles_solved !== metrics.puzzles_solved ||
          lastMetrics.correct_rotations !== metrics.correct_rotations ||
          lastMetrics.clicks_count !== metrics.clicks_count;

        if (hasChanged) {
          lastMetricsRef.current = metrics;

          // Use the stored debounced updater
          if (debouncedUpdaterRef.current) {
            debouncedUpdaterRef.current.update(metrics);
          }
        }
      }
    },
    [effortType, isReplay, currentPhase, activeSessionId]
  );

  const handleUpdateState = useCallback(
    async (state: SkillsRankingEffortState) => {
      if (isReplay || !activeSessionId || isDisabled || hasFinishedRef.current) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const getCancelledAfter = () => {
        if (state !== SkillsRankingEffortState.CANCELLED) return undefined;
        if (startTimeRef.current) {
          return `${Math.round((Date.now() - startTimeRef.current) / 1000)}s`;
        }
        return effortType === EffortType.TIME_BASED ? `${CALCULATION_DELAY}ms` : "0s";
      };

      const getSucceededAfter = () => {
        if (state !== SkillsRankingEffortState.COMPLETED) return undefined;
        if (effortType === EffortType.TIME_BASED) {
          return `${CALCULATION_DELAY}ms`;
        }
        return puzzleMetrics?.time_spent_ms ? `${puzzleMetrics.time_spent_ms}ms` : undefined;
      };

      const metrics: SkillsRankingMetrics = {
        cancelled_after: getCancelledAfter(),
        succeeded_after: getSucceededAfter(),
        correct_rotations: puzzleMetrics?.correct_rotations,
        puzzles_solved: puzzleMetrics?.puzzles_solved,
        clicks_count: puzzleMetrics?.clicks_count,
      };

      try {
        setIsUpdatingState(true);
        hasFinishedRef.current = true;

        // Determine the next phase based on experiment group
        const nextPhase = shouldSkipMarketDisclosure(skillsRankingState.experiment_group)
          ? SkillsRankingPhase.JOB_SEEKER_DISCLOSURE
          : SkillsRankingPhase.MARKET_DISCLOSURE;

        const newState = await SkillsRankingService.getInstance().updateSkillsRankingState(
          activeSessionId,
          nextPhase,
          undefined,
          undefined,
          metrics
        );
        await onFinish(newState);
      } catch (err) {
        console.error("Failed to update state", err);
        enqueueSnackbar("Failed to update skills ranking state. Please try again later.", {
          variant: "error",
        });
        hasFinishedRef.current = false; // Reset on error
      } finally {
        setIsUpdatingState(false);
      }
    },
    [
      isReplay,
      activeSessionId,
      isDisabled,
      puzzleMetrics,
      effortType,
      onFinish,
      enqueueSnackbar,
      skillsRankingState.experiment_group,
    ]
  );

  const handleComplete = useCallback(async () => {
    if (isReplay || isDisabled || hasFinishedRef.current) return;

    setIsTypingVisible(true);

    // Use TYPING_DURATION_MS for work-based users (who completed puzzles)
    // Use CALCULATION_DELAY for time-based users (who just waited)
    const delay = effortType === EffortType.WORK_BASED ? TYPING_DURATION_MS : CALCULATION_DELAY;

    setTimeout(async () => {
      setIsTypingVisible(false);
      await handleUpdateState(SkillsRankingEffortState.COMPLETED);
    }, delay);
  }, [isReplay, isDisabled, effortType, handleUpdateState]);

  const handleCancel = useCallback(async () => {
    if (isReplay || isDisabled || hasFinishedRef.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setHasFinished(true);
    setIsCancelling(true);
    setIsTypingVisible(true);

    setTimeout(async () => {
      setIsTypingVisible(false);
      await handleUpdateState(SkillsRankingEffortState.CANCELLED);
    }, TYPING_DURATION_MS);
  }, [handleUpdateState, isDisabled, isReplay]);

  // Handle puzzle success
  const handlePuzzleSuccess = useCallback(() => {
    if (isDisabled) return;
    // Immediately trigger completion when all puzzles are done
    handleComplete().then();
  }, [isDisabled, handleComplete]);

  // Time-based flow
  useEffect(() => {
    if (isReplay || effortType !== EffortType.TIME_BASED || isDisabled || hasFinishedRef.current) return;

    startTimeRef.current = Date.now();
    setIsTypingVisible(true);

    timeoutRef.current = setTimeout(() => {
      if (!hasFinishedRef.current && currentPhase === SkillsRankingPhase.PROOF_OF_VALUE) {
        setIsTypingVisible(false);
        handleUpdateState(SkillsRankingEffortState.COMPLETED).then();
      }
    }, CALCULATION_DELAY);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [effortType, handleUpdateState, isReplay, isDisabled, currentPhase]);

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_EFFORT_CONTAINER}
      ref={scrollRef}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <Box sx={{ width: "100%" }}>
        <ChatBubble message={effortMessage} sender={ConversationMessageSender.COMPASS}>
          {effortType === EffortType.WORK_BASED && (
            <RotateToSolvePuzzle
              puzzles={Math.max(1, 5 - (skillsRankingState.puzzles_solved || 0))}
              disabled={isDisabled}
              onSuccess={handlePuzzleSuccess}
              onReport={handlePuzzleMetricsUpdate}
              onCancel={handleCancel}
              isReplay={puzzleIsReplay}
              isReplayFinished={puzzleIsReplayFinished}
              initialPuzzlesSolved={skillsRankingState.puzzles_solved || 0}
              initialCorrectRotations={skillsRankingState.correct_rotations || 0}
              initialClicksCount={skillsRankingState.clicks_count || 0}
            />
          )}
        </ChatBubble>

        <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
          <Timestamp
            sentAt={
              skillsRankingState.phases[skillsRankingState.phases.length - 1]?.time || skillsRankingState.started_at
            }
          />
        </ChatMessageFooterLayout>
      </Box>

      <AnimatePresence mode="wait">
        {isTypingVisible && !isReplay && (
          <motion.div
            key="typing-message"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {effortType === EffortType.TIME_BASED ? (
              <CancellableTypingChatMessage
                message={isCancelling ? "Cancelling" : "Calculating"}
                onCancel={handleCancel}
                disabled={isDisabled}
              />
            ) : (
              <TypingChatMessage />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </MessageContainer>
  );
};

export default SkillsRankingProofOfValue;
