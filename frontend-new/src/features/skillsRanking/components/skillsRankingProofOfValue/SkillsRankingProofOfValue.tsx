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

  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();

  // State management
  const [hasCompletedPuzzles, setHasCompletedPuzzles] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [isTypingVisible, setIsTypingVisible] = useState(false);
  const [isUpdatingState, setIsUpdatingState] = useState(false);
  const [puzzleMetrics, setPuzzleMetrics] = useState<RotateToSolvePuzzleMetricsReport | null>(null);

  // Refs for tracking
  const scrollRef = useAutoScrollOnChange(isTypingVisible ? 1 : 0);
  const startTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const throttledMetricsUpdaterRef = useRef<{
    onActivity: (metrics: SkillsRankingMetrics) => void;
    onInactivity: (metrics: SkillsRankingMetrics) => void;
    forceUpdate: (metrics: SkillsRankingMetrics) => void;
    cleanup: () => void;
  } | null>(null);
  const lastMetricsRef = useRef<SkillsRankingMetrics | null>(null);

  // Restore state from existing data
  useEffect(() => {
    if (skillsRankingState.puzzles_solved && skillsRankingState.puzzles_solved > 0) {
      setHasCompletedPuzzles(true);
    }
    if (skillsRankingState.cancelled_after || skillsRankingState.succeeded_after) {
      setHasFinished(true);
    }
  }, [skillsRankingState]);

  // Cleanup throttled updater on unmount
  useEffect(() => {
    return () => {
      if (throttledMetricsUpdaterRef.current) {
        throttledMetricsUpdaterRef.current.cleanup();
      }
    };
  }, []);

  // Initialize throttled metrics updater
  useEffect(() => {
    if (activeSessionId && !isReplay && effortType === EffortType.WORK_BASED) {
      throttledMetricsUpdaterRef.current = SkillsRankingService.getInstance().createThrottledMetricsUpdater(
        activeSessionId,
        EFFORT_METRICS_UPDATE_INTERVAL
      );
    }

    // Cleanup throttled updater when component unmounts or phase changes
    return () => {
      if (throttledMetricsUpdaterRef.current) {
        throttledMetricsUpdaterRef.current.cleanup();
        throttledMetricsUpdaterRef.current = null;
      }
    };
  }, [activeSessionId, isReplay, effortType]);

  const effortMessage =
    effortType === EffortType.TIME_BASED ? (
      <>
        Please wait while I run the calculations, or click <strong>cancel</strong> if you want to continue the
        conversation without the information.
      </>
    ) : (
      ""
    );

  // Determine if component should be disabled
  const isDisabled = useMemo(() => {
    return (
      !isOnline || hasFinished || isUpdatingState || isReplay || currentPhase !== SkillsRankingPhase.PROOF_OF_VALUE
    );
  }, [isOnline, hasFinished, isUpdatingState, isReplay, currentPhase]);

  // Handle puzzle metrics update with throttled periodic updates
  const handlePuzzleMetricsUpdate = useCallback(
    (report: RotateToSolvePuzzleMetricsReport) => {
      setPuzzleMetrics(report);

      // Set start time on first interaction for work-based tasks
      if (effortType === EffortType.WORK_BASED && !startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      // Use throttled updater for periodic progress updates (only during PROOF_OF_VALUE phase)
      if (
        throttledMetricsUpdaterRef.current &&
        !isReplay &&
        effortType === EffortType.WORK_BASED &&
        currentPhase === SkillsRankingPhase.PROOF_OF_VALUE
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
          // Report activity (this will trigger throttled updates)
          throttledMetricsUpdaterRef.current.onActivity(metrics);
        }
      }
    },
    [effortType, isReplay, currentPhase]
  );

  const handleUpdateState = useCallback(
    async (state: SkillsRankingEffortState) => {
      if (isReplay || !activeSessionId || isDisabled) return;
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
        // Always transition to MARKET_DISCLOSURE, cancellation is just a flag
        const newState = await SkillsRankingService.getInstance().updateSkillsRankingState(
          activeSessionId,
          SkillsRankingPhase.MARKET_DISCLOSURE,
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
      } finally {
        setIsUpdatingState(false);
      }
    },
    [isReplay, activeSessionId, isDisabled, puzzleMetrics, effortType, onFinish, enqueueSnackbar]
  );

  const handleComplete = useCallback(async () => {
    if (isReplay || isDisabled) return;

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
    if (isReplay || isDisabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Force final metrics update before cancelling
    if (throttledMetricsUpdaterRef.current && puzzleMetrics) {
      const metrics: SkillsRankingMetrics = {
        puzzles_solved: puzzleMetrics.puzzles_solved,
        correct_rotations: puzzleMetrics.correct_rotations,
        clicks_count: puzzleMetrics.clicks_count,
      };
      throttledMetricsUpdaterRef.current.forceUpdate(metrics);
    }

    setHasFinished(true);
    setIsTypingVisible(true);

    setTimeout(async () => {
      setIsTypingVisible(false);
      await handleUpdateState(SkillsRankingEffortState.CANCELLED);
    }, TYPING_DURATION_MS);
  }, [handleUpdateState, isDisabled, isReplay, puzzleMetrics]);

  // Handle puzzle success
  const handlePuzzleSuccess = useCallback(() => {
    if (isDisabled) return;
    setHasCompletedPuzzles(true);
  }, [isDisabled]);

  // Time-based flow
  useEffect(() => {
    if (isReplay || effortType !== EffortType.TIME_BASED || isDisabled) return;

    startTimeRef.current = Date.now();
    setIsTypingVisible(true);

    timeoutRef.current = setTimeout(() => {
      if (!hasFinished) {
        setIsTypingVisible(false);
        handleUpdateState(SkillsRankingEffortState.COMPLETED).then();
      }
    }, CALCULATION_DELAY);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [effortType, handleUpdateState, hasFinished, isReplay, isDisabled]);

  // Work-based completion flow
  useEffect(() => {
    if (isReplay || !hasCompletedPuzzles || isDisabled) return;

    setIsTypingVisible(true);
    setTimeout(() => {
      setIsTypingVisible(false);
      handleComplete().then();
    }, TYPING_DURATION_MS);
  }, [hasCompletedPuzzles, handleComplete, isReplay, isDisabled]);

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
              puzzles={5}
              disabled={isDisabled}
              onSuccess={handlePuzzleSuccess}
              onReport={handlePuzzleMetricsUpdate}
              onCancel={handleCancel}
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
              <CancellableTypingChatMessage onCancel={handleCancel} disabled={isDisabled} />
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
