import React, { useCallback, useContext, useEffect, useRef, useState, useMemo } from "react";
import { useTheme } from "@mui/material";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import CancellableTypingChatMessage from "src/features/skillsRanking/components/cancellableTypingChatMessage/CancellableTypingChatMessage";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import RotateToSolvePuzzle, {
  RotateToSolvePuzzleMetricsReport,
} from "../rotateToSolve/RotateToSolvePuzzle";
import { SkillsRankingError } from "src/features/skillsRanking/errors";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { IsOnlineContext } from "src/app/isOnlineProvider/IsOnlineProvider";
import { AnimatePresence, motion } from "framer-motion";
import { EffortType } from "src/features/skillsRanking/components/skillsRankingProofOfValue/types";
import { SkillsRankingMetrics } from "src/features/skillsRanking/skillsRankingService/types";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import ChatMessageFooterLayout from "src/chat/chatMessage/components/chatMessageFooter/ChatMessageFooterLayout";
import Timestamp from "src/chat/chatMessage/components/chatMessageFooter/components/timestamp/Timestamp";
import { Box } from "@mui/material";

const CALCULATION_DELAY = 5000;

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

const SkillsRankingProofOfValue: React.FC<SkillsRankingEffortProps> = ({
  onFinish,
  skillsRankingState,
}) => {
  const theme = useTheme();
  const isOnline = useContext(IsOnlineContext);
  const { enqueueSnackbar } = useSnackbar();

  const currentPhase = skillsRankingState.phase[skillsRankingState.phase.length - 1]?.name;
  const isReplay = useMemo(() => currentPhase !== SkillsRankingPhase.PROOF_OF_VALUE, [currentPhase]);
  const effortType = getEffortTypeForGroup(skillsRankingState.experiment_group);
  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();

  const [hasCompletedPuzzles, setHasCompletedPuzzles] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [isTypingVisible, setIsTypingVisible] = useState(false);
  const [puzzleMetrics, setPuzzleMetrics] = useState<RotateToSolvePuzzleMetricsReport | null>(null);
  const [isUpdatingState, setIsUpdatingState] = useState(false);

  const scrollRef = useAutoScrollOnChange(isTypingVisible ? 1 : 0);
  const startTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effortMessage =
    effortType === EffortType.TIME_BASED
      ? "Please wait while I run the calculations... or click cancel if you want to continue the conversation without the information."
      : "";

  const handleUpdateState = useCallback(
    async (state: SkillsRankingEffortState) => {
      if (isReplay || !activeSessionId) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const metrics: SkillsRankingMetrics = {
        cancelled_after:
          state === SkillsRankingEffortState.CANCELLED && startTimeRef.current
            ? `${Math.round((Date.now() - startTimeRef.current) / 1000)}s`
            : undefined,
        succeeded_after:
          effortType === EffortType.TIME_BASED
            ? `${CALCULATION_DELAY}ms`
            : puzzleMetrics?.time_spent_ms
            ? `${puzzleMetrics.time_spent_ms}ms`
            : undefined,
        correct_rotations: puzzleMetrics?.correct_rotations,
        puzzles_solved: puzzleMetrics?.puzzles_solved,
        clicks_count: puzzleMetrics?.clicks_count,
      };

      try {
        const newState = await SkillsRankingService.getInstance().updateSkillsRankingState(
          activeSessionId,
          state === SkillsRankingEffortState.COMPLETED
            ? SkillsRankingPhase.MARKET_DISCLOSURE
            : SkillsRankingPhase.CANCELLED,
          undefined,
          undefined,
          metrics
        );
        onFinish(newState);
      } catch (err) {
        console.error("Failed to update state", err);
        enqueueSnackbar("Failed to update skills ranking state. Please try again later.", {
          variant: "error",
        });
      }
    },
    [activeSessionId, isReplay, onFinish, effortType, puzzleMetrics, enqueueSnackbar]
  );

  const handleComplete = useCallback(async () => {
    if (isReplay) return;

    setIsUpdatingState(true);
    setIsTypingVisible(true);

    setTimeout(async () => {
      setIsTypingVisible(false);
      await handleUpdateState(SkillsRankingEffortState.COMPLETED);
      setIsUpdatingState(false);
    }, CALCULATION_DELAY);
  }, [handleUpdateState, isReplay]);

  const handleCancel = useCallback(async () => {
    if (isReplay) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setIsUpdatingState(true);
    setHasFinished(true);
    await handleUpdateState(SkillsRankingEffortState.CANCELLED);
    setIsTypingVisible(false);
  }, [handleUpdateState, isReplay]);

  useEffect(() => {
    if (isReplay || effortType !== EffortType.TIME_BASED) return;

    startTimeRef.current = Date.now();
    setIsTypingVisible(true);

    timeoutRef.current = setTimeout(() => {
      if (!hasFinished) {
        setIsTypingVisible(false);
        handleUpdateState(SkillsRankingEffortState.COMPLETED);
      }
    }, CALCULATION_DELAY);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [effortType, handleUpdateState, hasFinished, isReplay]);

  useEffect(() => {
    if (isReplay || !hasCompletedPuzzles) return;

    setIsTypingVisible(true);
    setTimeout(() => {
      setIsTypingVisible(false);
      handleComplete();
    }, CALCULATION_DELAY);
  }, [hasCompletedPuzzles, handleComplete, isReplay]);

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
              disabled={!isOnline || hasFinished || isUpdatingState || isReplay}
              onSuccess={() => setHasCompletedPuzzles(true)}
              onReport={(report) => setPuzzleMetrics(report)}
              onCancel={handleCancel}
            />
          )}
        </ChatBubble>

        <ChatMessageFooterLayout sender={ConversationMessageSender.COMPASS}>
          <Timestamp sentAt={skillsRankingState.phase[skillsRankingState.phase.length - 1]?.time || skillsRankingState.started_at} />
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
                onCancel={handleCancel}
                disabled={isUpdatingState || isReplay}
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
