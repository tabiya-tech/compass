import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ChatBubble from "src/chat/chatMessage/components/chatBubble/ChatBubble";
import { MessageContainer } from "src/chat/chatMessage/compassChatMessage/CompassChatMessage";
import { ConversationMessageSender } from "src/chat/ChatService/ChatService.types";
import {
  SkillsRankingExperimentGroups,
  SkillsRankingPhase,
  SkillsRankingState,
} from "src/features/skillsRanking/types";
import { SkillsRankingService } from "src/features/skillsRanking/skillsRankingService/skillsRankingService";
import TypingChatMessage from "src/chat/chatMessage/typingChatMessage/TypingChatMessage";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoScrollOnChange } from "src/features/skillsRanking/hooks/useAutoScrollOnChange";
import { useTheme } from "@mui/material/styles";
import UserPreferencesStateService from "src/userPreferences/UserPreferencesStateService";
import { useSnackbar } from "src/theme/SnackbarProvider/SnackbarProvider";
import { SkillsRankingError } from "src/features/skillsRanking/errors";

const TYPING_DURATION_MS = 5000;

const uniqueId = "579104a2-f36b-4ca5-a0c5-b2b44aaa52e1";

export const DATA_TEST_ID = {
  SKILLS_RANKING_JOB_MARKET_DISCLOSURE_CONTAINER: `skills-ranking-job-market-disclosure-container-${uniqueId}`,
};

export const SKILLS_RANKING_JOB_MARKET_DISCLOSURE_MESSAGE_ID = `skills-ranking-job-market-disclosure-message-${uniqueId}`;

export interface SkillsRankingJobMarketDisclosureProps {
  onFinish: (skillsRankingState: SkillsRankingState) => Promise<void>;
  skillsRankingState: SkillsRankingState;
}

const SkillsRankingJobMarketDisclosure: React.FC<SkillsRankingJobMarketDisclosureProps> = ({
  onFinish,
  skillsRankingState,
}) => {
  const [step, setStep] = useState(0); // 0: message, 1: typing, 2: done
  const scrollRef = useAutoScrollOnChange(step);
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const activeSessionId = UserPreferencesStateService.getInstance().getActiveSessionId();
  const isReplay = useMemo(() => skillsRankingState.phase !== SkillsRankingPhase.MARKET_DISCLOSURE, [skillsRankingState.phase]);

  const shouldSkip =
    !isReplay &&
    (skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_2 ||
     skillsRankingState.experiment_group === SkillsRankingExperimentGroups.GROUP_4);

  const hasFinishedRef = useRef(false);

  const jobPlatformUrl = useMemo(
    () => SkillsRankingService.getInstance().getConfig().config.jobPlatformUrl,
    []
  );

  const handleContinue = useCallback(async () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;

    if (!activeSessionId) {
      throw new SkillsRankingError("Active session ID is not available.");
    }

    try {
      const newState = await SkillsRankingService.getInstance().updateSkillsRankingState(
        activeSessionId,
        SkillsRankingPhase.JOB_SEEKER_DISCLOSURE
      );
      await onFinish(newState);
    } catch (error) {
      console.error("Error updating skills ranking state:", error);
      enqueueSnackbar("Failed to update skills ranking state. Please try again later.", {
        variant: "error",
      });
    }
  }, [activeSessionId, onFinish, enqueueSnackbar]);

  useEffect(() => {
    if (shouldSkip) {
      handleContinue();
      return;
    }

    if (isReplay) return;

    const timers: NodeJS.Timeout[] = [];

    if (step === 0) {
      timers.push(setTimeout(() => setStep(1), TYPING_DURATION_MS));
    } else if (step === 1) {
      timers.push(setTimeout(() => {
        setStep(2);
        handleContinue();
      }, TYPING_DURATION_MS));
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [step, isReplay, shouldSkip, handleContinue]);

  if (shouldSkip) return null;

  return (
    <MessageContainer
      origin={ConversationMessageSender.COMPASS}
      data-testid={DATA_TEST_ID.SKILLS_RANKING_JOB_MARKET_DISCLOSURE_CONTAINER}
      ref={scrollRef}
      gap={theme.fixedSpacing(theme.tabiyaSpacing.md)}
    >
      <ChatBubble
        message={`With your current skillset you fulfill the required & most relevant skills of ${skillsRankingState.score.jobs_matching_rank}% of jobs on ${jobPlatformUrl}. This is quite some jobs!`}
        sender={ConversationMessageSender.COMPASS}
      />

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="typing-feedback"
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

export default SkillsRankingJobMarketDisclosure;
