import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  getLatestPhaseName,
  SkillsRankingMetrics,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import RotateToSolvePuzzle, {
  RotateToSolvePuzzleMetricsReport,
} from "src/features/skillsRanking/components/rotateToSolve/RotateToSolvePuzzle";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import {
  EFFORT_METRICS_UPDATE_INTERVAL,
  getDefaultTypingDurationMs,
  getShortTypingDurationMs,
} from "src/features/skillsRanking/constants";

const uniqueId = "d08ec52d-cd41-4934-b62f-dcd10eadfb3c";

export const DATA_TEST_ID = {
  SKILLS_RANKING_EFFORT_CONTAINER: `skills-ranking-effort-container-${uniqueId}`,
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

const SkillsRankingProofOfValue: React.FC<SkillsRankingEffortProps> = ({ onFinish, skillsRankingState }) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = getLatestPhaseName(skillsRankingState);
  const isReplay = useMemo(() => currentPhase !== SkillsRankingPhase.PROOF_OF_VALUE, [currentPhase]);

  // Determine replay state for puzzle component
  const puzzleIsReplay = useMemo(() => isReplay, [isReplay]);
  const puzzleIsReplayFinished = useMemo(
    () => isReplay && !!skillsRankingState.metadata.succeeded_after,
    [isReplay, skillsRankingState.metadata.succeeded_after]
  );

  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();

  // State management
  const [hasFinished, setHasFinished] = useState(false);
  const [isTypingVisible, setIsTypingVisible] = useState(false);
  const [isUpdatingState, setIsUpdatingState] = useState(false);
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

  // Restore finished state from existing data
  useEffect(() => {
    if (skillsRankingState.metadata.cancelled_after || skillsRankingState.metadata.succeeded_after) {
      setHasFinished(true);
      hasFinishedRef.current = true;
    }
  }, [skillsRankingState]);

  // Create debounced updater once when component mounts
  useEffect(() => {
    if (activeSessionId && !isReplay) {
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
  }, [activeSessionId, isReplay]);

  // Reset hasFinishedRef when phase changes away from PROOF_OF_VALUE
  useEffect(() => {
    if (currentPhase !== SkillsRankingPhase.PROOF_OF_VALUE) {
      hasFinishedRef.current = false;
    }
  }, [currentPhase]);

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

      // Set start time on first interaction
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      // Use debounced updater for progress updates (only during PROOF_OF_VALUE phase)
      if (
        !isReplay &&
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
    [isReplay, currentPhase, activeSessionId]
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
        return "0s";
      };

      const getSucceededAfter = () => {
        if (state !== SkillsRankingEffortState.COMPLETED) return undefined;
        return puzzleMetrics?.time_spent_ms ? `${puzzleMetrics.time_spent_ms}ms` : undefined;
      };

      const metrics: SkillsRankingMetrics = {
        cancelled_after: getCancelledAfter(),
        succeeded_after: getSucceededAfter(),
      };

      try {
        setIsUpdatingState(true);
        hasFinishedRef.current = true;

        const newState = await SkillsRankingService.getInstance().updateSkillsRankingState(
          activeSessionId,
          SkillsRankingPhase.PRIOR_BELIEF,
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
    [isReplay, activeSessionId, isDisabled, puzzleMetrics, onFinish, enqueueSnackbar]
  );

  const handleComplete = useCallback(async () => {
    if (isReplay || isDisabled || hasFinishedRef.current) return;

    setIsTypingVisible(true);

    // brief typing animation before completing
    const delay = getDefaultTypingDurationMs();

    timeoutRef.current = setTimeout(async () => {
      setIsTypingVisible(false);
      await handleUpdateState(SkillsRankingEffortState.COMPLETED);
    }, delay);
  }, [isReplay, isDisabled, handleUpdateState]);

  const handleCancel = useCallback(async () => {
    if (isReplay || isDisabled || hasFinishedRef.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setHasFinished(true);
    setIsTypingVisible(true);

    timeoutRef.current = setTimeout(async () => {
      setIsTypingVisible(false);
      await handleUpdateState(SkillsRankingEffortState.CANCELLED);
    }, getShortTypingDurationMs());
  }, [handleUpdateState, isDisabled, isReplay]);

  // Handle puzzle success
  const handlePuzzleSuccess = useCallback(() => {
    if (isDisabled) return;
    // Flush any pending debounced metrics update before completing
    if (debouncedUpdaterRef.current && lastMetricsRef.current) {
      debouncedUpdaterRef.current.forceUpdate(lastMetricsRef.current);
    }
    // run a complete flow
    void handleComplete();
  }, [isDisabled, handleComplete]);

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_EFFORT_CONTAINER}
      ref={scrollRef}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <Box sx={{ width: "100%" }}>
        <ChatBubble message="" sender={ConversationMessageSender.COMPASS}>
          {Math.max(0, 6 - (skillsRankingState.metadata.puzzles_solved || 0)) === 0 && !isReplay ? (
            // If nothing remains and not in replay, immediately complete (no extra puzzle rendered)
            (handlePuzzleSuccess() as any)
          ) : (
            <RotateToSolvePuzzle
              puzzles={Math.max(0, 6 - (skillsRankingState.metadata.puzzles_solved || 0))}
              disabled={isDisabled}
              onSuccess={handlePuzzleSuccess}
              onReport={handlePuzzleMetricsUpdate}
              onCancel={handleCancel}
              isReplay={puzzleIsReplay}
              isReplayFinished={puzzleIsReplayFinished}
              initialPuzzlesSolved={skillsRankingState.metadata.puzzles_solved || 0}
              initialCorrectRotations={skillsRankingState.metadata.correct_rotations || 0}
              initialClicksCount={skillsRankingState.metadata.clicks_count || 0}
            />
          )}
        </ChatBubble>

        <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
          <Timestamp
            sentAt={
              skillsRankingState.phase[skillsRankingState.phase.length - 1]?.time || skillsRankingState.metadata.started_at
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
            <TypingChatMessage />
          </motion.div>
        )}
      </AnimatePresence>
    </MessageContainer>
  );
};

export default SkillsRankingProofOfValue;
